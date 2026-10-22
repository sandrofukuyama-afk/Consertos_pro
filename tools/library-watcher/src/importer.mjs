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

function compactBoardCode(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshtein(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
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
  // Placa -> { id, manufacturerId } (o fabricante pode chegar depois, num 2o arquivo).
  const boards = new Map(
    must(await supabase.from("boards").select("id, board_code, manufacturer_id"), "placas").map((b) => [
      normalizeText(b.board_code),
      { id: b.id, manufacturerId: b.manufacturer_id },
    ]),
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

  /**
   * Placa ja cadastrada com codigo quase igual (ate 2 letras de diferenca, codigos
   * com 8+ caracteres): pega erro de digitacao do nome do arquivo, ex.: DAAM9AMB8D0
   * x DA0AM9MB8D0. Mesma regra de isLikelyBoardCodeTypo no app; LA-D804P x LA-D802P
   * (placas diferentes, curtas) nao batem.
   */
  function findTypoBoard(boardCode) {
    const code = compactBoardCode(boardCode);
    if (code.length < 8) return null;
    for (const [key, board] of boards) {
      const other = compactBoardCode(key);
      if (other.length >= 8 && other !== code && levenshtein(code, other) <= 2) return board;
    }
    return null;
  }

  async function ensureBoard(manufacturerId, boardCode) {
    if (!boardCode) return null;
    const key = normalizeText(boardCode);
    const known = boards.get(key) ?? findTypoBoard(boardCode);
    if (known) {
      // Placa criada antes sem fabricante (ex.: esquema so com o codigo da placa).
      if (!known.manufacturerId && manufacturerId && !dryRun) {
        must(await supabase.from("boards").update({ manufacturer_id: manufacturerId }).eq("id", known.id), `placa ${boardCode}`);
        known.manufacturerId = manufacturerId;
      }
      return known.id;
    }
    created.placas += 1;
    if (dryRun) return boards.set(key, { id: `dry:${key}`, manufacturerId }).get(key).id;
    const row = must(
      await supabase
        .from("boards")
        .insert({ board_type_id: boardTypeId, manufacturer_id: manufacturerId, board_code: boardCode })
        .select("id")
        .single(),
      `placa ${boardCode}`,
    );
    boards.set(key, { id: row.id, manufacturerId });
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
  /** Modelo unico ja ligado a placa no catalogo (ou null se nenhum/varios). */
  function modelOfBoard(boardId) {
    const linked = [...modelBoards].filter((key) => key.endsWith(`|${boardId}`));
    return linked.length === 1 ? linked[0].split("|")[0] : null;
  }

  async function ensureTargets(item) {
    const categoryId = await ensureCategory(item.categoria || "Notebook");
    const manufacturerId = await ensureManufacturer(item.fabricante);
    const boardId = await ensureBoard(manufacturerId, item.placa);
    // Modelo com o mesmo nome; senao o modelo que a placa ja tem (o nome do arquivo
    // ou da IA raramente bate com o do catalogo: "15-7559" x "Inspiron 15 7559");
    // so cria modelo novo quando a placa ainda nao tem nenhum.
    const sameName = item.modelo && manufacturerId ? models.get(`${manufacturerId}|${normalizeText(item.modelo)}`) : null;
    const modelId =
      sameName ??
      (boardId ? modelOfBoard(boardId) : null) ??
      (await ensureModel(manufacturerId, categoryId, item.modelo));
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

  /**
   * Aparelhos dos casos abertos ({ fabricante, modelo, placa }), com os nomes do
   * catalogo: a IA do vigia usa como referencia, ja que quase sempre o arquivo
   * enviado e do aparelho que esta na bancada. Carregado uma vez por rodada.
   */
  let openCases = null;
  async function openCaseEquipment() {
    if (openCases) return openCases;
    const { data, error } = await supabase
      .from("diagnostics")
      .select("equipment_label, manufacturers(name), equipment_models(model_name), diagnostic_boards(boards(board_code))")
      .in("status", ["draft", "active", "waiting_input"])
      .limit(50);
    if (error) {
      openCases = [];
      return openCases;
    }
    openCases = (data ?? [])
      .map((row) => ({
        fabricante: row.manufacturers?.name ?? "",
        modelo: row.equipment_models?.model_name ?? "",
        placa: (row.diagnostic_boards ?? []).map((link) => link.boards?.board_code).filter(Boolean).join(", "),
        rotulo: row.equipment_label ?? "",
      }))
      .filter((item) => item.modelo || item.placa);
    return openCases;
  }

  return { created, hasHash, ensureTargets, importFile, openCaseEquipment };
}
