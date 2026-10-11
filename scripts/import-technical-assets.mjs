// Importa em lote arquivos tecnicos (esquemas, boardviews, BIOS) para a biblioteca.
//
// Uso:
//   node scripts/import-technical-assets.mjs <manifesto.json> --user-email=<email> [--dry-run]
//
// O manifesto e uma lista de objetos com: local_path, sha256, ext, arquivo, tipo,
// fabricante, categoria, modelo, placa, nome_exibicao, observacao, origem, incluir.
// Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.
// Pode ser executado de novo: arquivos ja enviados (mesmo SHA-256) sao pulados.
// Para envio continuo a partir de uma pasta, veja tools/library-watcher.

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { createLibraryImporter } from "../tools/library-watcher/src/importer.mjs";

const CONCURRENCY = 4;

function loadEnv() {
  const env = {};
  const text = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) {
      env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

async function main() {
  const [manifestPath, ...flags] = process.argv.slice(2);
  const dryRun = flags.includes("--dry-run");
  const userEmail = flags.find((flag) => flag.startsWith("--user-email="))?.split("=")[1];

  if (!manifestPath || !userEmail) {
    throw new Error("Uso: node scripts/import-technical-assets.mjs <manifesto.json> --user-email=<email> [--dry-run]");
  }

  const env = loadEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const importer = await createLibraryImporter(supabase, { uploaderEmail: userEmail, dryRun });
  const rows = JSON.parse(readFileSync(manifestPath, "utf8")).filter((row) => row.incluir === "sim");

  // Catalogo em sequencia para nao duplicar fabricantes/modelos/placas.
  const targets = new Map();
  for (const row of rows) {
    targets.set(row.sha256, await importer.ensureTargets(row));
  }

  const stats = { arquivos: 0, pulados: 0, erros: 0 };
  const failures = [];
  let cursor = 0;

  async function worker() {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      try {
        if (await importer.hasHash(row.sha256)) {
          stats.pulados += 1;
          continue;
        }
        const bytes = dryRun ? Buffer.alloc(0) : await readFile(row.local_path);
        await importer.importFile(
          { ...row, bytes, fileName: row.arquivo, origin: row.origem },
          targets.get(row.sha256),
          "importacao_em_lote",
        );
        stats.arquivos += 1;
      } catch (error) {
        stats.erros += 1;
        failures.push({ arquivo: row.origem, erro: error.message });
      }
      const done = stats.arquivos + stats.pulados + stats.erros;
      if (done % 25 === 0 || done === rows.length) {
        console.log(`  ${done}/${rows.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(dryRun ? "SIMULACAO (nada foi gravado):" : "Concluido:", { ...importer.created, ...stats });
  if (failures.length) {
    console.log("Falhas:");
    failures.forEach((failure) => console.log(`  ${failure.arquivo}: ${failure.erro}`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
