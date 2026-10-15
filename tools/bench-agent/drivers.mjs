// Drivers de gravador de BIOS usados pelo agente de bancada.
// Cada driver implementa: detect(ctx) -> { chip, sizeBytes|null }, read(arquivo, ctx), write(arquivo, ctx).
// ctx = { label, say(mensagem) }: say mostra a mensagem no caso (app) e no console da bancada.

import { execFile } from "node:child_process";
import { copyFile, mkdir, readdir, rename, stat } from "node:fs/promises";
import path from "node:path";

function run(command, args, timeoutMs = 15 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      const output = `${stdout ?? ""}\n${stderr ?? ""}`;
      if (error) {
        reject(new Error(`${command} falhou: ${output.trim().split("\n").slice(-6).join(" | ") || error.message}`));
        return;
      }
      resolve(output);
    });
  });
}

/** Chip de mentira num arquivo: para testar o fluxo sem hardware. */
function simulatedDriver(config) {
  const chipFile = config.SIM_CHIP_FILE;
  if (!chipFile) throw new Error("Defina SIM_CHIP_FILE (arquivo que faz o papel do chip).");
  return {
    name: "simulado",
    async detect() {
      const info = await stat(chipFile);
      return { chip: `SIMULADO (${Math.round(info.size / 1024)} KB)`, sizeBytes: info.size };
    },
    async read(outFile) {
      await copyFile(chipFile, outFile);
    },
    async write(inFile) {
      await copyFile(inFile, chipFile);
    },
  };
}

/** flashrom: CH341A (ch341a_spi), FT2232 (ft2232_spi), Raspberry Pi (linux_spi)... */
function flashromDriver(config) {
  const exe = config.FLASHROM_PATH || "flashrom";
  const programmer = config.FLASHROM_PROGRAMMER || "ch341a_spi";
  const base = () => ["-p", programmer, ...(config.FLASHROM_CHIP ? ["-c", config.FLASHROM_CHIP] : [])];

  return {
    name: `flashrom (${programmer})`,
    async detect() {
      const output = await run(exe, ["-p", programmer], 120000).catch((error) => error.message);
      if (/Multiple flash chip definitions match/i.test(output) && !config.FLASHROM_CHIP) {
        const options = [...output.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
        throw new Error(
          `Mais de um modelo de chip combina (${options.join(", ")}). Leia o nome no chip e defina FLASHROM_CHIP.`,
        );
      }
      const found = /Found (.+?) flash chip "([^"]+)" \((\d+) kB/i.exec(output);
      if (!found) {
        throw new Error("Nenhum chip encontrado: confira a garra (pino 1 no ponto vermelho), o encaixe e o USB.");
      }
      return { chip: `${found[1]} ${found[2]}`, sizeBytes: Number(found[3]) * 1024 };
    },
    async read(outFile) {
      await run(exe, [...base(), "-r", outFile]);
    },
    async write(inFile) {
      // flashrom apaga, grava e verifica sozinho; falha com codigo != 0.
      await run(exe, [...base(), "-w", inFile]);
    },
  };
}

/** minipro: XGecu T48 / T56 / TL866II+. Precisa do nome do chip (ex.: "W25Q64BV@SOIC8"). */
function miniproDriver(config) {
  const exe = config.MINIPRO_PATH || "minipro";
  const chip = config.MINIPRO_CHIP;
  if (!chip) throw new Error("Defina MINIPRO_CHIP com o modelo do chip (ex.: W25Q64BV@SOIC8).");

  return {
    name: "minipro",
    async detect() {
      await run(exe, ["-p", chip, "-D"], 120000);
      return { chip, sizeBytes: null };
    },
    async read(outFile) {
      await run(exe, ["-p", chip, "-r", outFile]);
    },
    async write(inFile) {
      // minipro verifica depois de gravar por padrao.
      await run(exe, ["-p", chip, "-w", inFile]);
    },
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * EZP2023+ (modo assistido): o gravador so funciona pelo programa dele no Windows,
 * sem linha de comando. O agente diz no app o que fazer e espera o arquivo:
 * - leitura: o tecnico le no EZP2023 e salva o .bin em "1-Leituras";
 * - gravacao: o agente coloca o arquivo em "2-Para gravar"; o tecnico grava no EZP2023.
 * As regras continuam: duas leituras iguais, backup antes, leitura de verificacao depois.
 */
function ezpDriver(config) {
  const base = config.EZP_PASTA || "C:\\ConsertosPro-EZP";
  const readsDir = path.join(base, "1-Leituras");
  const writeDir = path.join(base, "2-Para gravar");
  const doneDir = path.join(base, "3-Processados");
  const waitMs = Number(config.EZP_ESPERA_MIN || 20) * 60 * 1000;
  let pendingWrite = null;

  /** Espera aparecer em 1-Leituras um arquivo novo (depois de `since`) com tamanho parado. */
  async function waitForNewFile(since) {
    const deadline = Date.now() + waitMs;
    const sizes = new Map();
    while (Date.now() < deadline) {
      const names = await readdir(readsDir).catch(() => []);
      for (const name of names) {
        if (/\.(tmp|part)$/i.test(name)) continue;
        const full = path.join(readsDir, name);
        const info = await stat(full).catch(() => null);
        if (!info?.isFile() || info.mtimeMs < since || info.size === 0) continue;
        if (sizes.get(full) === info.size) return full;
        sizes.set(full, info.size);
      }
      await sleep(1500);
    }
    throw new Error(`Nenhum arquivo novo em ${readsDir} em ${Math.round(waitMs / 60000)} min. Peça de novo no app.`);
  }

  async function archive(file) {
    const target = path.join(doneDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${path.basename(file)}`);
    await rename(file, target).catch(() => {});
  }

  return {
    name: "EZP2023+ (assistido)",
    async detect() {
      await Promise.all([readsDir, writeDir, doneDir].map((dir) => mkdir(dir, { recursive: true })));
      // O EZP2023 nao informa o chip ao agente: o tamanho e conferido pela leitura de backup.
      return { chip: config.EZP_CHIP || "EZP2023+ (chip escolhido no programa do gravador)", sizeBytes: null };
    },
    async read(outFile, ctx) {
      const since = Date.now();
      const before = pendingWrite
        ? `No EZP2023, grave o arquivo "${path.basename(pendingWrite)}" (pasta 2-Para gravar) com Auto (apagar + gravar + verificar). Depois `
        : "No EZP2023, ";
      ctx?.say(`${ctx?.label ?? "Leitura"}: ${before}clique em Ler (Read) e salve o arquivo em ${readsDir}.`);
      const file = await waitForNewFile(since);
      await copyFile(file, outFile);
      await archive(file);
      if (pendingWrite) {
        await archive(pendingWrite);
        pendingWrite = null;
      }
    },
    async write(inFile) {
      await mkdir(writeDir, { recursive: true });
      pendingWrite = path.join(writeDir, `GRAVAR-${new Date().toLocaleDateString("sv-SE")}-${Date.now() % 100000}.bin`);
      await copyFile(inFile, pendingWrite);
      // A gravacao em si e feita pelo tecnico; a leitura de verificacao seguinte confirma o resultado.
    },
  };
}

export function createDriver(config) {
  switch ((config.DRIVER || "simulado").toLowerCase()) {
    case "flashrom":
      return flashromDriver(config);
    case "minipro":
      return miniproDriver(config);
    case "ezp":
    case "ezp2023":
      return ezpDriver(config);
    case "simulado":
      return simulatedDriver(config);
    default:
      throw new Error(`DRIVER desconhecido: ${config.DRIVER}. Use ezp2023, simulado, flashrom ou minipro.`);
  }
}
