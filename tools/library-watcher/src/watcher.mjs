// Vigia de pasta da biblioteca tecnica do ConsertosPro.
//
// A cada POLL_SECONDS olha INBOX_DIR. Cada item solto la (arquivo ou pasta)
// que esteja ha STABLE_SECONDS sem mudar e processado: compactados sao
// extraidos, cada arquivo tecnico e classificado e enviado (repetidos pelo
// SHA-256 sao pulados) e o item original vai para DONE_DIR/<data> ou, se algo
// falhar, para ERROR_DIR com um .txt explicando. Um resumo vai pro Telegram.

import { createHash, randomUUID } from "node:crypto";
import { appendFile, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { aiClassify, isAiClassifyEnabled } from "./ai-classify.mjs";
import { ARCHIVE_EXT, extractArchive } from "./archive.mjs";
import { classifyFile } from "./classify.mjs";
import { createLibraryImporter } from "./importer.mjs";
import { notifyTelegram } from "./notify.mjs";

const config = {
  supabaseUrl: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  uploaderEmail: process.env.UPLOADER_EMAIL,
  inbox: process.env.INBOX_DIR || "/inbox",
  done: process.env.DONE_DIR || "/enviados",
  errors: process.env.ERROR_DIR || "/erros",
  pollSeconds: Number(process.env.POLL_SECONDS || 120),
  stableSeconds: Number(process.env.STABLE_SECONDS || 60),
  dryRun: process.env.DRY_RUN === "1",
  once: process.argv.includes("--once"),
};

const MAX_ARCHIVE_DEPTH = 2;
const MAX_FILE_BYTES = 200 * 1024 * 1024;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

/** Tamanho total e modificacao mais recente de um arquivo ou pasta. */
async function fingerprint(target) {
  const info = await stat(target);
  if (!info.isDirectory()) return { size: info.size, mtime: info.mtimeMs };
  let size = 0;
  let mtime = info.mtimeMs;
  for (const file of await walk(target)) {
    const fileInfo = await stat(file);
    size += fileInfo.size;
    mtime = Math.max(mtime, fileInfo.mtimeMs);
  }
  return { size, mtime };
}

/** Lista os arquivos de um item, abrindo .zip/.rar (inclusive aninhados). */
async function collectFiles(itemPath, tempRoot, problems) {
  const collected = [];

  async function visit(filePath, relativePath, depth) {
    const ext = path.extname(filePath).toLowerCase();
    if (ARCHIVE_EXT.has(ext) && depth < MAX_ARCHIVE_DEPTH) {
      const dest = path.join(tempRoot, randomUUID());
      try {
        await extractArchive(filePath, dest);
      } catch (error) {
        problems.push(`${relativePath}: nao consegui abrir o compactado (${error.reason ?? error.message})`);
        return;
      }
      for (const inner of await walk(dest)) {
        await visit(inner, `${relativePath}/${path.relative(dest, inner).replace(/\\/g, "/")}`, depth + 1);
      }
      return;
    }
    collected.push({ filePath, relativePath });
  }

  const info = await stat(itemPath);
  const base = path.basename(itemPath);
  if (info.isDirectory()) {
    for (const file of await walk(itemPath)) {
      await visit(file, `${base}/${path.relative(itemPath, file).replace(/\\/g, "/")}`, 0);
    }
  } else {
    await visit(itemPath, base, 0);
  }
  return collected;
}

/** Move entre discos/volumes diferentes (rename falha com EXDEV). */
async function moveTo(source, targetDir) {
  await mkdir(targetDir, { recursive: true });
  const parsed = path.parse(source);
  let target = path.join(targetDir, parsed.base);
  for (let n = 2; await stat(target).then(() => true, () => false); n += 1) {
    target = path.join(targetDir, `${parsed.name} (${n})${parsed.ext}`);
  }
  try {
    await rename(source, target);
  } catch (error) {
    if (error.code !== "EXDEV") throw error;
    await cp(source, target, { recursive: true });
    await rm(source, { recursive: true, force: true });
  }
  return target;
}

async function processItem(itemPath, importer) {
  const tempRoot = path.join(os.tmpdir(), "consertospro-watcher", randomUUID());
  const report = { imported: [], skipped: 0, ignored: 0, problems: [] };

  try {
    const files = await collectFiles(itemPath, tempRoot, report.problems);

    for (const { filePath, relativePath } of files) {
      const size = (await stat(filePath)).size;
      if (size === 0 || size > MAX_FILE_BYTES) {
        report.ignored += 1;
        continue;
      }

      let item = classifyFile(relativePath, size);
      if (!item) {
        report.ignored += 1;
        continue;
      }

      const bytes = await readFile(filePath);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (await importer.hasHash(sha256)) {
        report.skipped += 1;
        continue;
      }

      if (item.incompleto && isAiClassifyEnabled()) {
        const guess = await aiClassify(relativePath, item.tipo);
        if (guess) {
          item = {
            ...item,
            fabricante: item.fabricante || guess.fabricante,
            categoria: guess.categoria || item.categoria,
            modelo: item.modelo || guess.modelo,
            placa: item.placa || guess.placa,
          };
          item.nome_exibicao = [item.nome_exibicao.split(" ")[0], item.fabricante, item.modelo, item.placa]
            .filter(Boolean)
            .join(" ");
        }
      }

      try {
        const target = await importer.ensureTargets(item);
        await importer.importFile(
          {
            ...item,
            bytes,
            sha256,
            ext: path.extname(relativePath).toLowerCase(),
            fileName: path.basename(relativePath),
            origin: `Pasta de envio: ${relativePath}`,
          },
          target,
          "pasta_monitorada",
        );
        report.imported.push(item.nome_exibicao);
        log("enviado:", relativePath, "=>", item.nome_exibicao);
      } catch (error) {
        report.problems.push(`${relativePath}: ${error.message}`);
      }
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }

  return report;
}

async function runOnce(getImporter, seen) {
  const entries = (await readdir(config.inbox, { withFileTypes: true })).filter(
    (entry) => !entry.name.startsWith(".") && (entry.isFile() || entry.isDirectory()),
  );
  const summary = { imported: [], skipped: 0, ignored: 0, problems: [] };

  for (const entry of entries) {
    const itemPath = path.join(config.inbox, entry.name);
    const print = await fingerprint(itemPath);
    const previous = seen.get(entry.name);
    seen.set(entry.name, print);

    // Espera a copia terminar: mesmo tamanho na rodada anterior e sem mudancas recentes.
    const settled =
      previous && previous.size === print.size && Date.now() - print.mtime > config.stableSeconds * 1000;
    if (!settled && !config.once) {
      continue;
    }

    log("processando:", entry.name);
    const report = await processItem(itemPath, await getImporter());
    seen.delete(entry.name);

    summary.imported.push(...report.imported);
    summary.skipped += report.skipped;
    summary.ignored += report.ignored;
    summary.problems.push(...report.problems);

    if (config.dryRun) {
      continue;
    }

    const failed = report.problems.length > 0 && report.imported.length === 0 && report.skipped === 0;
    const destination = failed ? config.errors : path.join(config.done, today());
    const moved = await moveTo(itemPath, destination);
    const lines = [
      `${new Date().toISOString()}  ${entry.name}`,
      `  enviados: ${report.imported.length} | ja existiam: ${report.skipped} | ignorados: ${report.ignored}`,
      ...report.imported.map((name) => `  + ${name}`),
      ...report.problems.map((problem) => `  ! ${problem}`),
      "",
    ].join("\n");
    await appendFile(path.join(failed ? config.errors : config.done, "relatorio.txt"), `${lines}\n`);
    if (failed) {
      await writeFile(`${moved}.erro.txt`, report.problems.join("\n"));
    }
  }

  if (summary.imported.length || summary.problems.length) {
    const head = summary.imported.slice(0, 15).map((name) => `• ${name}`);
    const more = summary.imported.length > 15 ? [`… e mais ${summary.imported.length - 15}`] : [];
    const problems = summary.problems.slice(0, 5).map((problem) => `⚠️ ${problem}`);
    await notifyTelegram(
      [
        `📥 Biblioteca: ${summary.imported.length} arquivo(s) enviado(s)` +
          (summary.skipped ? `, ${summary.skipped} já existiam` : ""),
        ...head,
        ...more,
        ...problems,
      ].join("\n"),
    );
  }

  return summary;
}

async function main() {
  for (const [name, value] of Object.entries({
    SUPABASE_URL: config.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: config.serviceRoleKey,
    UPLOADER_EMAIL: config.uploaderEmail,
  })) {
    if (!value) throw new Error(`Variavel ${name} nao configurada.`);
  }

  await Promise.all([config.inbox, config.done, config.errors].map((dir) => mkdir(dir, { recursive: true })));

  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false } });
  const seen = new Map();
  log(
    `vigiando ${config.inbox} a cada ${config.pollSeconds}s` +
      (config.dryRun ? " (SIMULACAO)" : "") +
      (isAiClassifyEnabled() ? " com IA para nomes desconhecidos" : ""),
  );

  do {
    try {
      // Catalogo carregado so quando ha algo a processar, e de novo a cada
      // rodada para enxergar o que foi criado pelo app nesse meio tempo.
      let importer = null;
      const getImporter = async () =>
        (importer ??= await createLibraryImporter(supabase, {
          uploaderEmail: config.uploaderEmail,
          dryRun: config.dryRun,
        }));
      const summary = await runOnce(getImporter, seen);
      if (summary.imported.length || summary.skipped || summary.problems.length) {
        log("rodada:", { enviados: summary.imported.length, ja_existiam: summary.skipped, problemas: summary.problems.length });
      }
    } catch (error) {
      log("erro na rodada:", error.message);
    }
    if (!config.once) {
      await new Promise((resolve) => setTimeout(resolve, config.pollSeconds * 1000));
    }
  } while (!config.once);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
