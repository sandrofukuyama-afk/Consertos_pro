// Grava arquivos tecnicos na biblioteca do ConsertosPro: cria categoria,
// fabricante, modelo e placa quando faltam, envia o arquivo ao Storage e
// registra/vincula em technical_assets. Usado pelo vigia de pasta e pelo
// script de importacao em lote. Recebe um cliente Supabase com chave de servico.

const BUCKET = "technical-assets";

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

export function normalizeText(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

export function fileFormatFor(ext) {
  if (ext === ".pdf" || ext === ".brd" || ext === ".bdv") return ext.slice(1);
  if ([".bin", ".rom", ".cap", ""].includes(ext) || /^\.\d+$/.test(ext)) return "bin";
  if (ext === ".zip") return "zip";
  return "other";
}

function storagePathFor(hash, format, ext) {
  const suffix = ["pdf", "brd", "bdv"].includes(format)
    ? `.${format}`
    : /^\.[a-z0-9]{1,6}$/i.test(ext)
      ? ext.toLowerCase()
      : ".bin";
  return `${format}/${hash.slice(0, 2)}/${hash}${suffix}`;
}

function must(result, context) {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

export async function createLibraryImporter(supabase, { uploaderEmail, dryRun = false }) {
  const uploader = must(
    await supabase.from("users").select("id").eq("email", uploaderEmail).maybeSingle(),
    "usuario",
  );
  if (!uploader) {
    throw new Error(`Usuario ${uploaderEmail} nao encontrado na tabela users.`);
  }

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

  const created = { categorias: 0, fabricantes: 0, modelos: 0, placas: 0 };

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

  async function hasHash(sha256) {
    const data = must(
      await supabase.from("technical_assets").select("id").eq("file_hash_sha256", sha256).limit(1),
      "hash",
    );
    return data.length > 0;
  }

  /** Garante o catalogo para uma classificacao e devolve os ids alvo. */
  async function ensureTargets(item) {
    const categoryId = await ensureCategory(item.categoria || "Notebook");
    const manufacturerId = await ensureManufacturer(item.fabricante);
    const modelId = await ensureModel(manufacturerId, categoryId, item.modelo);
    const boardId = await ensureBoard(manufacturerId, item.placa);
    await ensureModelBoard(modelId, boardId);
    return { manufacturerId, modelId, boardId };
  }

  /**
   * Envia e registra um arquivo. item: { bytes, sha256, ext, fileName, origin,
   * tipo, fabricante, categoria, modelo, placa, observacao, nome_exibicao }.
   */
  async function importFile(item, target, source) {
    const format = fileFormatFor(item.ext);
    const storagePath = storagePathFor(item.sha256, format, item.ext);

    if (dryRun) return null;

    const upload = await supabase.storage.from(BUCKET).upload(storagePath, item.bytes, {
      contentType: format === "pdf" ? "application/pdf" : "application/octet-stream",
      upsert: false,
    });
    if (upload.error && !/exists|duplicate/i.test(upload.error.message)) {
      throw new Error(`upload: ${upload.error.message}`);
    }

    const description = [item.observacao, `Origem: ${item.origin}`].filter(Boolean).join(" • ");
    const asset = must(
      await supabase
        .from("technical_assets")
        .insert({
          asset_type: ASSET_TYPE_BY_KIND[item.tipo] ?? "other",
          file_format: format,
          original_filename: item.fileName,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          file_size_bytes: item.bytes.length,
          file_hash_sha256: item.sha256,
          mime_type: format === "pdf" ? "application/pdf" : "application/octet-stream",
          parser_status: format === "brd" || format === "bdv" ? "pending" : "not_applicable",
          extracted_text_status: format === "pdf" ? "pending" : "not_applicable",
          board_id: target.boardId,
          equipment_model_id: target.modelId,
          metadata: {
            source,
            display_name: item.nome_exibicao,
            description,
            manufacturer_id: target.manufacturerId,
            manufacturer_name: item.fabricante || null,
            category: item.categoria,
            original_path: item.origin,
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

    return asset.id;
  }

  return { created, hasHash, ensureTargets, importFile };
}
