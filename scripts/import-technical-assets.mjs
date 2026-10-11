// Importa em lote arquivos tecnicos (esquemas, boardviews, BIOS) para a biblioteca.
//
// Uso:
//   node scripts/import-technical-assets.mjs <manifesto.json> --user-email=<email> [--dry-run]
//
// O manifesto e uma lista de objetos com: local_path, sha256, ext, arquivo, tipo,
// fabricante, categoria, modelo, placa, nome_exibicao, observacao, origem, incluir.
// Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.
// Pode ser executado de novo: arquivos ja enviados (mesmo SHA-256) sao pulados.

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const BUCKET = "technical-assets";
const CONCURRENCY = 4;

const ASSET_TYPE_BY_KIND = {
  esquema: "schematic_pdf",
  "boardview (PDF)": "boardview",
  boardview: "boardview",
  BIOS: "bios",
  "firmware EC": "firmware",
  datasheet: "datasheet",
};

const CATEGORY_SLUGS = {
  Notebook: "notebook",
  Desktop: "desktop",
  Smartphone: "smartphone",
  "Televisão": "television",
  Tablet: "tablet",
  "Placa de vídeo": "video_card",
};

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

function normalizeText(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

function fileFormatFor(ext) {
  if (ext === ".pdf" || ext === ".brd" || ext === ".bdv") return ext.slice(1);
  if ([".bin", ".rom", ".cap", ".80", ".10", ".90", ""].includes(ext)) return "bin";
  if (ext === ".zip") return "zip";
  return "other";
}

function storagePathFor(hash, format, ext) {
  const suffix = ["pdf", "brd", "bdv"].includes(format) ? `.${format}` : ext || ".bin";
  return `${format}/${hash.slice(0, 2)}/${hash}${suffix.replace(/\s+/g, "_")}`;
}

function must(result, context) {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
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

  const rows = JSON.parse(readFileSync(manifestPath, "utf8")).filter((row) => row.incluir === "sim");
  const uploader = must(
    await supabase.from("users").select("id, full_name").eq("email", userEmail).maybeSingle(),
    "usuario",
  );
  if (!uploader) {
    throw new Error(`Usuario ${userEmail} nao encontrado na tabela users.`);
  }

  // ── Catalogo atual ─────────────────────────────────────────────────────────
  const categories = new Map(
    must(await supabase.from("equipment_categories").select("id, slug"), "categorias").map((c) => [c.slug, c.id]),
  );
  const manufacturers = new Map(
    must(await supabase.from("manufacturers").select("id, normalized_name"), "fabricantes").map((m) => [
      m.normalized_name,
      m.id,
    ]),
  );
  const models = new Map(
    must(
      await supabase.from("equipment_models").select("id, manufacturer_id, normalized_model_name"),
      "modelos",
    ).map((m) => [`${m.manufacturer_id}|${m.normalized_model_name}`, m.id]),
  );
  const boards = new Map(
    must(await supabase.from("boards").select("id, board_code"), "placas").map((b) => [normalizeText(b.board_code), b.id]),
  );
  const modelBoards = new Set(
    must(await supabase.from("model_boards").select("board_id, equipment_model_id"), "modelo-placa").map(
      (link) => `${link.equipment_model_id}|${link.board_id}`,
    ),
  );
  const boardTypeId = must(
    await supabase.from("board_types").select("id").eq("slug", "mainboard").single(),
    "tipo de placa",
  ).id;

  const existingHashes = new Set();
  for (let from = 0; ; from += 1000) {
    const page = must(
      await supabase.from("technical_assets").select("file_hash_sha256").range(from, from + 999),
      "hashes",
    );
    page.forEach((row) => existingHashes.add(row.file_hash_sha256));
    if (page.length < 1000) break;
  }

  const created = { categorias: 0, fabricantes: 0, modelos: 0, placas: 0, arquivos: 0, pulados: 0, erros: 0 };

  async function ensureCategory(name) {
    const slug = CATEGORY_SLUGS[name] ?? normalizeText(name).replace(/\s+/g, "_");
    if (categories.has(slug)) return categories.get(slug);
    created.categorias += 1;
    if (dryRun) return categories.set(slug, `dry:${slug}`).get(slug);
    const row = must(await supabase.from("equipment_categories").insert({ name, slug }).select("id").single(), `categoria ${name}`);
    categories.set(slug, row.id);
    return row.id;
  }

  async function ensureManufacturer(name) {
    if (!name) return null;
    const key = normalizeText(name);
    if (manufacturers.has(key)) return manufacturers.get(key);
    created.fabricantes += 1;
    if (dryRun) return manufacturers.set(key, `dry:${key}`).get(key);
    const row = must(
      await supabase.from("manufacturers").insert({ name, normalized_name: key }).select("id").single(),
      `fabricante ${name}`,
    );
    manufacturers.set(key, row.id);
    return row.id;
  }

  async function ensureModel(manufacturerId, categoryId, modelName) {
    if (!manufacturerId || !modelName) return null;
    const normalized = normalizeText(modelName);
    const key = `${manufacturerId}|${normalized}`;
    if (models.has(key)) return models.get(key);
    created.modelos += 1;
    if (dryRun) return models.set(key, `dry:${key}`).get(key);
    const row = must(
      await supabase
        .from("equipment_models")
        .insert({
          manufacturer_id: manufacturerId,
          equipment_category_id: categoryId,
          model_name: modelName,
          normalized_model_name: normalized,
        })
        .select("id")
        .single(),
      `modelo ${modelName}`,
    );
    models.set(key, row.id);
    return row.id;
  }

  async function ensureBoard(manufacturerId, boardCode) {
    if (!boardCode) return null;
    const key = normalizeText(boardCode);
    if (boards.has(key)) return boards.get(key);
    created.placas += 1;
    if (dryRun) return boards.set(key, `dry:${key}`).get(key);
    const row = must(
      await supabase
        .from("boards")
        .insert({ board_type_id: boardTypeId, manufacturer_id: manufacturerId, board_code: boardCode })
        .select("id")
        .single(),
      `placa ${boardCode}`,
    );
    boards.set(key, row.id);
    return row.id;
  }

  async function ensureModelBoard(modelId, boardId) {
    if (!modelId || !boardId || dryRun) return;
    const key = `${modelId}|${boardId}`;
    if (modelBoards.has(key)) return;
    modelBoards.add(key);
    const { error } = await supabase.from("model_boards").insert({
      equipment_model_id: modelId,
      board_id: boardId,
      role_label: "Associacao tecnica",
      is_primary: false,
    });
    if (error && error.code !== "23505") throw new Error(`modelo-placa: ${error.message}`);
  }

  // ── Catalogo: cria em sequencia para nao duplicar ──────────────────────────
  const targets = new Map();
  for (const row of rows) {
    const categoryId = await ensureCategory(row.categoria || "Notebook");
    const manufacturerId = await ensureManufacturer(row.fabricante);
    const modelId = await ensureModel(manufacturerId, categoryId, row.modelo);
    const boardId = await ensureBoard(manufacturerId, row.placa);
    await ensureModelBoard(modelId, boardId);
    targets.set(row.sha256, { manufacturerId, modelId, boardId });
  }

  // ── Arquivos ──────────────────────────────────────────────────────────────
  const pending = rows.filter((row) => {
    if (existingHashes.has(row.sha256)) {
      created.pulados += 1;
      return false;
    }
    return true;
  });
  const totalMb = pending.reduce((sum, row) => sum + row.tamanho_mb, 0);
  console.log(`${pending.length} arquivo(s) para enviar (${totalMb.toFixed(0)} MB), ${created.pulados} ja existiam.`);

  async function importRow(row) {
    const format = fileFormatFor(row.ext);
    const storagePath = storagePathFor(row.sha256, format, row.ext);
    const target = targets.get(row.sha256);

    if (dryRun) {
      created.arquivos += 1;
      return;
    }

    const bytes = await readFile(row.local_path);
    const upload = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: format === "pdf" ? "application/pdf" : "application/octet-stream",
      upsert: false,
    });
    if (upload.error && !/exists|duplicate/i.test(upload.error.message)) {
      throw new Error(`upload: ${upload.error.message}`);
    }

    const description = [row.observacao, `Origem: ${row.origem}`].filter(Boolean).join(" • ");
    const asset = must(
      await supabase
        .from("technical_assets")
        .insert({
          asset_type: ASSET_TYPE_BY_KIND[row.tipo] ?? "other",
          file_format: format,
          original_filename: row.arquivo,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          file_size_bytes: bytes.length,
          file_hash_sha256: row.sha256,
          mime_type: format === "pdf" ? "application/pdf" : "application/octet-stream",
          parser_status: format === "brd" || format === "bdv" ? "pending" : "not_applicable",
          extracted_text_status: format === "pdf" ? "pending" : "not_applicable",
          board_id: target.boardId,
          equipment_model_id: target.modelId,
          metadata: {
            source: "importacao_em_lote",
            display_name: row.nome_exibicao,
            description,
            manufacturer_id: target.manufacturerId,
            manufacturer_name: row.fabricante || null,
            category: row.categoria,
            original_path: row.origem,
          },
          uploaded_by_user_id: uploader.id,
        })
        .select("id")
        .single(),
      "registro",
    );

    if (target.boardId || target.modelId) {
      must(
        await supabase.from("technical_asset_links").insert({
          technical_asset_id: asset.id,
          board_id: target.boardId,
          equipment_model_id: target.modelId,
          linked_by_user_id: uploader.id,
        }),
        "vinculo",
      );
    }
    created.arquivos += 1;
  }

  let cursor = 0;
  let done = 0;
  const failures = [];
  async function worker() {
    while (cursor < pending.length) {
      const row = pending[cursor++];
      try {
        await importRow(row);
      } catch (error) {
        created.erros += 1;
        failures.push({ arquivo: row.origem, erro: error.message });
      }
      done += 1;
      if (done % 25 === 0 || done === pending.length) {
        console.log(`  ${done}/${pending.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(dryRun ? "SIMULACAO (nada foi gravado):" : "Concluido:", created);
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
