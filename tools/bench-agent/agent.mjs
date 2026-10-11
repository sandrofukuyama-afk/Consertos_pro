// Agente de bancada do ConsertosPro: le e grava BIOS com o gravador USB a
// pedido do app. Configuracao em bench-agent.env (ao lado deste arquivo).
//
// Uso: node agent.mjs            (fica rodando)
//      node agent.mjs --once     (processa a fila uma vez e sai)

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDriver } from "./drivers.mjs";

const VERSION = "1.0.0";
const here = path.dirname(fileURLToPath(import.meta.url));

async function loadConfig() {
  const config = { ...process.env };
  const text = await readFile(path.join(here, "bench-agent.env"), "utf8").catch(() => "");
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !line.trim().startsWith("#")) config[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return config;
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const log = (...args) => console.log(new Date().toLocaleString("sv-SE"), ...args);

async function main() {
  const config = await loadConfig();
  const appUrl = (config.APP_URL || "https://consertos-pro.vercel.app").replace(/\/$/, "");
  const token = config.BENCH_AGENT_TOKEN;
  const agentName = config.AGENT_NAME || os.hostname();
  const pollMs = Number(config.POLL_MS || 3000);
  const workDir = config.WORK_DIR || path.join(os.tmpdir(), "consertospro-bench");

  if (!token) throw new Error("Defina BENCH_AGENT_TOKEN em bench-agent.env.");
  const driver = createDriver(config);
  await mkdir(workDir, { recursive: true });

  async function api(method, route, body) {
    const response = await fetch(`${appUrl}/api/bench-agent${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Agent-Name": agentName,
        "X-Agent-Version": VERSION,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status} em ${route}`);
    return payload;
  }

  const report = (jobId, fields) => api("POST", `/jobs/${jobId}`, fields).catch((error) => log("aviso:", error.message));

  /** Le o chip duas vezes e so aceita se as duas leituras forem iguais. */
  async function readStable(jobId, label) {
    const first = path.join(workDir, `${randomUUID()}.bin`);
    const second = path.join(workDir, `${randomUUID()}.bin`);
    try {
      await report(jobId, { progress: `${label}: leitura 1 de 2…` });
      await driver.read(first);
      await report(jobId, { progress: `${label}: leitura 2 de 2…` });
      await driver.read(second);
      const [a, b] = await Promise.all([readFile(first), readFile(second)]);
      if (sha256(a) !== sha256(b)) {
        throw new Error("As duas leituras deram diferentes: mau contato na garra/soquete. Reposicione e tente de novo.");
      }
      return a;
    } finally {
      await Promise.all([rm(first, { force: true }), rm(second, { force: true })]);
    }
  }

  async function uploadDump(jobId, bytes, kind, fileName, chip) {
    const { path: storagePath, signedUrl } = await api("POST", `/jobs/${jobId}/upload-url`);
    const put = await fetch(signedUrl, { method: "PUT", body: bytes, headers: { "Content-Type": "application/octet-stream" } });
    if (!put.ok) throw new Error(`Falha ao enviar o dump (${put.status}).`);
    return api("POST", `/jobs/${jobId}/dumps`, {
      path: storagePath,
      fileName,
      kind,
      sha256: sha256(bytes),
      chip,
      programmer: driver.name,
    });
  }

  async function handleRead(job) {
    await report(job.id, { status: "running", progress: "Detectando o chip…" });
    const { chip } = await driver.detect();
    const bytes = await readStable(job.id, "Lendo");
    await report(job.id, { progress: "Enviando o dump…" });
    const saved = await uploadDump(job.id, bytes, "leitura", `leitura-${new Date().toLocaleDateString("sv-SE")}.bin`, chip);
    await report(job.id, {
      status: "done",
      progress: "Leitura concluída.",
      result: { chip, sha256: sha256(bytes), tamanho: bytes.length, resumo: saved.summary, avisos: saved.warnings },
    });
  }

  async function handleWrite(job) {
    await report(job.id, { status: "running", progress: "Baixando o arquivo a gravar…" });
    const download = await fetch(job.source.url);
    if (!download.ok) throw new Error(`Falha ao baixar o arquivo (${download.status}).`);
    const image = Buffer.from(await download.arrayBuffer());
    if (sha256(image) !== job.source.sha256) throw new Error("O arquivo baixado não confere (hash). Nada foi gravado.");

    await report(job.id, { progress: "Detectando o chip…" });
    const { chip, sizeBytes } = await driver.detect();
    if (sizeBytes && sizeBytes !== image.length) {
      throw new Error(
        `Tamanho não confere: chip ${Math.round(sizeBytes / 1024)} KB, arquivo ${Math.round(image.length / 1024)} KB. Nada foi gravado.`,
      );
    }

    // Backup obrigatorio antes de qualquer gravacao.
    const backup = await readStable(job.id, "Backup antes de gravar");
    await report(job.id, { progress: "Enviando o backup…" });
    await uploadDump(job.id, backup, "backup", `backup-antes-de-gravar-${new Date().toLocaleDateString("sv-SE")}.bin`, chip);

    const imageFile = path.join(workDir, `${randomUUID()}.bin`);
    try {
      await writeFile(imageFile, image);
      await report(job.id, { progress: "Gravando (apagar + gravar)… não desconecte." });
      await driver.write(imageFile);
    } finally {
      await rm(imageFile, { force: true });
    }

    const verify = await readStable(job.id, "Verificando");
    const ok = sha256(verify) === job.source.sha256;
    await report(job.id, { progress: "Enviando a leitura de verificação…" });
    await uploadDump(job.id, verify, "verificado", `verificado-${new Date().toLocaleDateString("sv-SE")}.bin`, chip);

    if (!ok) {
      throw new Error("A verificação falhou: o conteúdo lido depois de gravar é diferente do arquivo. O backup está salvo no caso.");
    }
    await report(job.id, {
      status: "done",
      progress: "Gravado e verificado.",
      result: { chip, gravado: job.source.fileName, sha256: job.source.sha256, verificado: true },
    });
  }

  log(`agente "${agentName}" v${VERSION} • ${driver.name} • ${appUrl}`);

  do {
    try {
      const { job } = await api("GET", "/jobs/next");
      if (job) {
        log(`trabalho ${job.kind} • ${job.diagnosticLabel ?? job.id}`);
        try {
          if (job.kind === "read") await handleRead(job);
          else await handleWrite(job);
          log("concluido");
        } catch (error) {
          log("falhou:", error.message);
          await report(job.id, { status: "failed", error: error.message });
        }
        continue;
      }
    } catch (error) {
      log("sem contato com o app:", error.message);
    }
    if (!process.argv.includes("--once")) await new Promise((resolve) => setTimeout(resolve, pollMs));
  } while (!process.argv.includes("--once"));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
