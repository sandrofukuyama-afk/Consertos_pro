// Drivers de gravador de BIOS usados pelo agente de bancada.
// Cada driver implementa: detect() -> { chip, sizeBytes|null }, read(arquivo), write(arquivo).

import { execFile } from "node:child_process";
import { copyFile, stat } from "node:fs/promises";

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

export function createDriver(config) {
  switch ((config.DRIVER || "simulado").toLowerCase()) {
    case "flashrom":
      return flashromDriver(config);
    case "minipro":
      return miniproDriver(config);
    case "simulado":
      return simulatedDriver(config);
    default:
      throw new Error(`DRIVER desconhecido: ${config.DRIVER}. Use simulado, flashrom ou minipro.`);
  }
}
