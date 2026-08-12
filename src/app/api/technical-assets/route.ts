import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  buildTechnicalAssetStoragePath,
  getTechnicalAssetExtractedTextStatus,
  getTechnicalAssetMimeType,
  getTechnicalAssetParserStatus,
  mapTechnicalAssetType,
  normalizeTechnicalAssetHash,
  planTechnicalAssetPersistence,
  TECHNICAL_ASSET_BUCKET,
  validateTechnicalAssetFile,
} from "@/lib/technical-assets.mjs";

type TechnicalAssetRow = {
  id: string;
  original_filename: string;
  asset_type: string;
  file_format: string;
  created_at?: string;
  board_id?: string | null;
  equipment_model_id?: string | null;
  metadata?: Record<string, unknown> | null;
  technical_asset_links?: Array<{
    id: string;
    board_id: string | null;
    equipment_model_id: string | null;
    boards?: { board_code: string | null } | Array<{ board_code: string | null }> | null;
    equipment_models?:
      | { model_name: string | null }
      | Array<{ model_name: string | null }>
      | null;
  }> | null;
};

type TechnicalAssetMetadataPayload = {
  fileName?: string;
  fileSizeBytes?: number;
  format?: string;
  hashSha256?: string;
  mimeType?: string;
  boardId?: string | null;
  equipmentModelId?: string | null;
  diagnosticId?: string | null;
};

type TechnicalAssetAssociationPayload = {
  assetIds?: string[];
  boardId?: string | null;
  equipmentModelId?: string | null;
  displayName?: string | null;
  description?: string | null;
  manufacturerId?: string | null;
  manufacturerName?: string | null;
  createBoard?: {
    boardCode?: string;
    description?: string | null;
    manufacturerId?: string | null;
    manufacturerName?: string | null;
  } | null;
  createEquipmentModel?: {
    modelName?: string;
    manufacturerId?: string | null;
    manufacturerName?: string | null;
  } | null;
};

type TechnicalAssetAssociationSummary = {
  boardId: string | null;
  boardName: string | null;
  equipmentModelId: string | null;
  equipmentModelName: string | null;
};

function pickRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function isUniqueViolation(error: { code?: string | null } | null | undefined) {
  return error?.code === "23505";
}

function buildEmptyAssociation(): TechnicalAssetAssociationSummary {
  return {
    boardId: null,
    boardName: null,
    equipmentModelId: null,
    equipmentModelName: null,
  };
}

function resolveAssetAssociation(
  asset: TechnicalAssetRow | null,
  boardId?: string | null,
  equipmentModelId?: string | null,
): TechnicalAssetAssociationSummary {
  if (!asset) {
    return buildEmptyAssociation();
  }

  const links = asset.technical_asset_links ?? [];
  const matchingLink =
    boardId || equipmentModelId
      ? links.find((link) => matchesLinkContext(link, boardId ?? null, equipmentModelId ?? null))
      : null;
  const chosenLink = matchingLink ?? links[0] ?? null;

  if (!chosenLink) {
    return buildEmptyAssociation();
  }

  return {
    boardId: chosenLink.board_id ?? null,
    boardName: pickRelation(chosenLink.boards)?.board_code ?? null,
    equipmentModelId: chosenLink.equipment_model_id ?? null,
    equipmentModelName: pickRelation(chosenLink.equipment_models)?.model_name ?? null,
  };
}

function matchesLinkContext(
  link: { board_id: string | null; equipment_model_id: string | null },
  boardId: string | null,
  equipmentModelId: string | null,
) {
  return (
    (link.board_id ?? null) === boardId &&
    (link.equipment_model_id ?? null) === equipmentModelId
  );
}

async function findAssetByHash(hash: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technical_assets")
    .select(`
      id,
      original_filename,
      asset_type,
      file_format,
      metadata,
      technical_asset_links (
        id,
        board_id,
        equipment_model_id,
        boards(board_code),
        equipment_models(model_name)
      )
    `)
    .eq("file_hash_sha256", hash)
    .maybeSingle<TechnicalAssetRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function findAssetsByIds(assetIds: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technical_assets")
    .select(`
      id,
      original_filename,
      asset_type,
      file_format,
      metadata,
      technical_asset_links (
        id,
        board_id,
        equipment_model_id,
        boards(board_code),
        equipment_models(model_name)
      )
    `)
    .in("id", assetIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TechnicalAssetRow[];
}

async function ensureAssetLink({
  assetId,
  boardId,
  equipmentModelId,
  linkedByUserId,
}: {
  assetId: string;
  boardId: string | null;
  equipmentModelId: string | null;
  linkedByUserId: string;
}) {
  if (!boardId && !equipmentModelId) {
    return { linkId: null, created: false };
  }

  const supabase = await createClient();
  let query = supabase
    .from("technical_asset_links")
    .select("id, board_id, equipment_model_id")
    .eq("technical_asset_id", assetId);

  query = boardId ? query.eq("board_id", boardId) : query.is("board_id", null);
  query = equipmentModelId
    ? query.eq("equipment_model_id", equipmentModelId)
    : query.is("equipment_model_id", null);

  const { data: existingLink, error: existingLinkError } = await query.maybeSingle();
  if (existingLinkError) {
    throw new Error(existingLinkError.message);
  }

  if (existingLink) {
    return { linkId: existingLink.id, created: false };
  }

  const { data: insertedLink, error: insertLinkError } = await supabase
    .from("technical_asset_links")
    .insert({
      technical_asset_id: assetId,
      board_id: boardId,
      equipment_model_id: equipmentModelId,
      linked_by_user_id: linkedByUserId,
    })
    .select("id")
    .single();

  if (insertLinkError) {
    const duplicateLink = await query.maybeSingle();
    if (duplicateLink.data) {
      return { linkId: duplicateLink.data.id, created: false };
    }

    throw new Error(insertLinkError.message);
  }

  return { linkId: insertedLink.id, created: true };
}

async function clearAssetLinks(assetId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("technical_asset_links")
    .delete()
    .eq("technical_asset_id", assetId);

  if (error) {
    throw new Error(error.message);
  }
}

function buildAssociationMessage(boardId: string | null, equipmentModelId: string | null) {
  if (!boardId && !equipmentModelId) {
    return "Arquivo salvo sem associacao.";
  }

  return "Arquivo salvo e associado ao contexto atual.";
}

async function ensureManufacturerByName(name: string) {
  const supabase = await createClient();
  const normalizedName = normalizeText(name);

  const { data: existingManufacturer, error: existingManufacturerError } = await supabase
    .from("manufacturers")
    .select("id, name")
    .eq("normalized_name", normalizedName)
    .maybeSingle();

  if (existingManufacturerError) {
    throw new Error(existingManufacturerError.message);
  }

  if (existingManufacturer) {
    return { id: existingManufacturer.id, name: existingManufacturer.name ?? name.trim() };
  }

  const { data: createdManufacturer, error: createManufacturerError } = await supabase
    .from("manufacturers")
    .insert({
      name: name.trim(),
      normalized_name: normalizedName,
    })
    .select("id, name")
    .single();

  if (createManufacturerError) {
    if (isUniqueViolation(createManufacturerError)) {
      const { data: duplicateManufacturer } = await supabase
        .from("manufacturers")
        .select("id, name")
        .eq("normalized_name", normalizedName)
        .maybeSingle();

      if (duplicateManufacturer) {
        return {
          id: duplicateManufacturer.id,
          name: duplicateManufacturer.name ?? name.trim(),
        };
      }
    }

    throw new Error(createManufacturerError.message);
  }

  return { id: createdManufacturer.id, name: createdManufacturer.name ?? name.trim() };
}

async function ensureDefaultBoardType() {
  const supabase = await createClient();
  const slug = "boardview-lab";

  const { data: existingBoardType, error: existingBoardTypeError } = await supabase
    .from("board_types")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existingBoardTypeError) {
    throw new Error(existingBoardTypeError.message);
  }

  if (existingBoardType) {
    return existingBoardType.id;
  }

  const { data: createdBoardType, error: createBoardTypeError } = await supabase
    .from("board_types")
    .insert({
      name: "Boardview lab",
      slug,
      description: "Tipo criado para associacoes tecnicas do laboratorio boardview.",
    })
    .select("id")
    .single();

  if (createBoardTypeError) {
    if (isUniqueViolation(createBoardTypeError)) {
      const { data: duplicateBoardType } = await supabase
        .from("board_types")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (duplicateBoardType) {
        return duplicateBoardType.id;
      }
    }

    throw new Error(createBoardTypeError.message);
  }

  return createdBoardType.id;
}

async function ensureDefaultEquipmentCategory() {
  const supabase = await createClient();
  const slug = "boardview-lab";

  const { data: existingCategory, error: existingCategoryError } = await supabase
    .from("equipment_categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existingCategoryError) {
    throw new Error(existingCategoryError.message);
  }

  if (existingCategory) {
    return existingCategory.id;
  }

  const { data: createdCategory, error: createCategoryError } = await supabase
    .from("equipment_categories")
    .insert({
      name: "Boardview lab",
      slug,
      description: "Categoria criada para associacoes tecnicas do laboratorio boardview.",
    })
    .select("id")
    .single();

  if (createCategoryError) {
    if (isUniqueViolation(createCategoryError)) {
      const { data: duplicateCategory } = await supabase
        .from("equipment_categories")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (duplicateCategory) {
        return duplicateCategory.id;
      }
    }

    throw new Error(createCategoryError.message);
  }

  return createdCategory.id;
}

async function ensureBoardAssociationTarget(payload: TechnicalAssetAssociationPayload) {
  const selectedBoardId = String(payload.boardId ?? "").trim();
  if (selectedBoardId) {
    const supabase = await createClient();
    const { data: board, error } = await supabase
      .from("boards")
      .select("id, board_code")
      .eq("id", selectedBoardId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!board) {
      throw new Error("A placa selecionada nao foi encontrada.");
    }

    return { boardId: board.id, boardName: board.board_code ?? null };
  }

  const boardCode = String(payload.createBoard?.boardCode ?? "").trim();
  if (!boardCode) {
    return { boardId: null, boardName: null };
  }

  const supabase = await createClient();
  const manufacturerName = String(payload.createBoard?.manufacturerName ?? "").trim();
  const manufacturerId =
    String(payload.createBoard?.manufacturerId ?? "").trim() ||
    (manufacturerName ? (await ensureManufacturerByName(manufacturerName)).id : null);
  const description = String(payload.createBoard?.description ?? "").trim() || null;

  const { data: existingBoard, error: existingBoardError } = await supabase
    .from("boards")
    .select("id, board_code")
    .eq("board_code", boardCode)
    .maybeSingle();

  if (existingBoardError) {
    throw new Error(existingBoardError.message);
  }

  if (existingBoard) {
    return { boardId: existingBoard.id, boardName: existingBoard.board_code ?? boardCode };
  }

  const boardTypeId = await ensureDefaultBoardType();
  const { data: createdBoard, error: createBoardError } = await supabase
    .from("boards")
    .insert({
      board_type_id: boardTypeId,
      manufacturer_id: manufacturerId,
      board_code: boardCode,
      description,
    })
    .select("id, board_code")
    .single();

  if (createBoardError) {
    if (isUniqueViolation(createBoardError)) {
      const { data: duplicateBoard } = await supabase
        .from("boards")
        .select("id, board_code")
        .eq("board_code", boardCode)
        .maybeSingle();

      if (duplicateBoard) {
        return { boardId: duplicateBoard.id, boardName: duplicateBoard.board_code ?? boardCode };
      }
    }

    throw new Error(createBoardError.message);
  }

  return { boardId: createdBoard.id, boardName: createdBoard.board_code ?? boardCode };
}

async function ensureEquipmentModelAssociationTarget(payload: TechnicalAssetAssociationPayload) {
  const selectedEquipmentModelId = String(payload.equipmentModelId ?? "").trim();
  if (selectedEquipmentModelId) {
    const supabase = await createClient();
    const { data: model, error } = await supabase
      .from("equipment_models")
      .select("id, model_name")
      .eq("id", selectedEquipmentModelId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!model) {
      throw new Error("O modelo selecionado nao foi encontrado.");
    }

    return {
      equipmentModelId: model.id,
      equipmentModelName: model.model_name ?? null,
    };
  }

  const modelName = String(payload.createEquipmentModel?.modelName ?? "").trim();
  if (!modelName) {
    return { equipmentModelId: null, equipmentModelName: null };
  }

  const manufacturerName = String(payload.createEquipmentModel?.manufacturerName ?? "").trim();
  const manufacturerId =
    String(payload.createEquipmentModel?.manufacturerId ?? "").trim() ||
    String(payload.createBoard?.manufacturerId ?? "").trim() ||
    (manufacturerName ? (await ensureManufacturerByName(manufacturerName)).id : null);

  if (!manufacturerId) {
    throw new Error("Selecione ou informe um fabricante para criar o modelo.");
  }

  const supabase = await createClient();
  const normalizedModelName = normalizeText(modelName);
  const { data: existingModel, error: existingModelError } = await supabase
    .from("equipment_models")
    .select("id, model_name")
    .eq("manufacturer_id", manufacturerId)
    .eq("normalized_model_name", normalizedModelName)
    .maybeSingle();

  if (existingModelError) {
    throw new Error(existingModelError.message);
  }

  if (existingModel) {
    return {
      equipmentModelId: existingModel.id,
      equipmentModelName: existingModel.model_name ?? modelName,
    };
  }

  const equipmentCategoryId = await ensureDefaultEquipmentCategory();
  const { data: createdModel, error: createModelError } = await supabase
    .from("equipment_models")
    .insert({
      manufacturer_id: manufacturerId,
      equipment_category_id: equipmentCategoryId,
      model_name: modelName,
      normalized_model_name: normalizedModelName,
    })
    .select("id, model_name")
    .single();

  if (createModelError) {
    if (isUniqueViolation(createModelError)) {
      const { data: duplicateModel } = await supabase
        .from("equipment_models")
        .select("id, model_name")
        .eq("manufacturer_id", manufacturerId)
        .eq("normalized_model_name", normalizedModelName)
        .maybeSingle();

      if (duplicateModel) {
        return {
          equipmentModelId: duplicateModel.id,
          equipmentModelName: duplicateModel.model_name ?? modelName,
        };
      }
    }

    throw new Error(createModelError.message);
  }

  return {
    equipmentModelId: createdModel.id,
    equipmentModelName: createdModel.model_name ?? modelName,
  };
}

async function ensureModelBoardLink(boardId: string | null, equipmentModelId: string | null) {
  if (!boardId || !equipmentModelId) {
    return;
  }

  const supabase = await createClient();
  const { data: existingLink, error: existingLinkError } = await supabase
    .from("model_boards")
    .select("id")
    .eq("board_id", boardId)
    .eq("equipment_model_id", equipmentModelId)
    .maybeSingle();

  if (existingLinkError) {
    throw new Error(existingLinkError.message);
  }

  if (existingLink) {
    return;
  }

  const { error: createLinkError } = await supabase.from("model_boards").insert({
    board_id: boardId,
    equipment_model_id: equipmentModelId,
    role_label: "Associacao tecnica",
    is_primary: false,
  });

  if (createLinkError && !isUniqueViolation(createLinkError)) {
    throw new Error(createLinkError.message);
  }
}

async function trySyncPrimaryAssociation(
  assetId: string,
  boardId: string | null,
  equipmentModelId: string | null,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("technical_assets")
    .update({
      board_id: boardId,
      equipment_model_id: equipmentModelId,
    })
    .eq("id", assetId);

  if (!error) {
    return;
  }

  const normalizedMessage = error.message.toLowerCase();
  const isMissingPrimaryColumns =
    error.code === "PGRST204" ||
    normalizedMessage.includes("board_id") ||
    normalizedMessage.includes("equipment_model_id");

  if (isMissingPrimaryColumns) {
    return;
  }

  throw new Error(error.message);
}

async function resolveManufacturerMetadata(
  manufacturerId: string | null,
  manufacturerName: string | null,
) {
  const normalizedManufacturerId = String(manufacturerId ?? "").trim() || null;
  const normalizedManufacturerName = String(manufacturerName ?? "").trim() || null;

  if (normalizedManufacturerId) {
    const supabase = await createClient();
    const { data: manufacturer, error } = await supabase
      .from("manufacturers")
      .select("id, name")
      .eq("id", normalizedManufacturerId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!manufacturer) {
      throw new Error("O fabricante selecionado nao foi encontrado.");
    }

    return {
      manufacturerId: manufacturer.id,
      manufacturerName: manufacturer.name ?? normalizedManufacturerName,
    };
  }

  return {
    manufacturerId: null,
    manufacturerName: normalizedManufacturerName,
  };
}

async function updateTechnicalAssetMetadata({
  assetId,
  displayName,
  description,
  manufacturerId,
  manufacturerName,
}: {
  assetId: string;
  displayName: string | null;
  description: string | null;
  manufacturerId: string | null;
  manufacturerName: string | null;
}) {
  const assets = await findAssetsByIds([assetId]);
  const asset = assets[0] ?? null;

  if (!asset) {
    throw new Error("Arquivo tecnico nao encontrado.");
  }

  const metadata = { ...(asset.metadata ?? {}) } as Record<string, unknown>;

  if (displayName) {
    metadata.display_name = displayName;
  } else {
    delete metadata.display_name;
  }

  if (description) {
    metadata.description = description;
  } else {
    delete metadata.description;
  }

  if (manufacturerId) {
    metadata.manufacturer_id = manufacturerId;
  } else {
    delete metadata.manufacturer_id;
  }

  if (manufacturerName) {
    metadata.manufacturer_name = manufacturerName;
  } else {
    delete metadata.manufacturer_name;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("technical_assets")
    .update({
      metadata,
    })
    .eq("id", assetId);

  if (error) {
    throw new Error(error.message);
  }
}

function normalizeSearchText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

async function searchTechnicalAssets(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const fileFormat = searchParams.get("file_format")?.trim() ?? "";
  const boardId = searchParams.get("board_id")?.trim() ?? "";
  const equipmentModelId = searchParams.get("equipment_model_id")?.trim() ?? "";
  const manufacturerId = searchParams.get("manufacturer_id")?.trim() ?? "";
  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get("limit") ?? "40", 10) || 40, 1),
    100,
  );

  const { data, error } = await supabase
    .from("technical_assets")
    .select(`
      id,
      original_filename,
      asset_type,
      file_format,
      created_at,
      board_id,
      equipment_model_id,
      metadata,
      technical_asset_links(
        id,
        board_id,
        equipment_model_id,
        boards(board_code, manufacturer_id),
        equipment_models(model_name, manufacturer_id)
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit * 4);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as TechnicalAssetRow[];
  const normalizedQuery = normalizeSearchText(query);

  const items = rows
    .map((row) => {
      const matchingLink =
        row.technical_asset_links?.find((link) => {
          if (boardId && link.board_id === boardId) {
            return true;
          }

          if (equipmentModelId && link.equipment_model_id === equipmentModelId) {
            return true;
          }

          return false;
        }) ?? row.technical_asset_links?.[0] ?? null;
      const boardRelation = pickRelation(matchingLink?.boards) as
        | { board_code: string | null; manufacturer_id?: string | null }
        | null;
      const modelRelation = pickRelation(matchingLink?.equipment_models) as
        | { model_name: string | null; manufacturer_id?: string | null }
        | null;
      const resolvedBoardId = row.board_id ?? matchingLink?.board_id ?? null;
      const resolvedEquipmentModelId =
        row.equipment_model_id ?? matchingLink?.equipment_model_id ?? null;
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const metadataManufacturerId =
        String(metadata.manufacturerId ?? metadata.manufacturer_id ?? "").trim() || null;
      const metadataManufacturerName =
        String(metadata.manufacturerName ?? metadata.manufacturer_name ?? "").trim() || null;

      return {
        id: row.id,
        title:
          String(metadata.displayName ?? metadata.display_name ?? "").trim() ||
          row.original_filename,
        originalFileName: row.original_filename,
        fileFormat: row.file_format,
        assetType: row.asset_type,
        createdAt: row.created_at ?? new Date(0).toISOString(),
        boardId: resolvedBoardId,
        boardName: boardRelation?.board_code ?? null,
        equipmentModelId: resolvedEquipmentModelId,
        equipmentModelName: modelRelation?.model_name ?? null,
        manufacturerId:
          metadataManufacturerId ??
          modelRelation?.manufacturer_id ??
          boardRelation?.manufacturer_id ??
          null,
        manufacturerName: metadataManufacturerName,
        description: String(metadata.description ?? "").trim() || null,
      };
    })
    .filter((item) => (fileFormat ? item.fileFormat === fileFormat : true))
    .filter((item) => (boardId ? item.boardId === boardId : true))
    .filter((item) =>
      equipmentModelId ? item.equipmentModelId === equipmentModelId : true,
    )
    .filter((item) => (manufacturerId ? item.manufacturerId === manufacturerId : true))
    .filter((item) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = normalizeSearchText(
        [
          item.title,
          item.originalFileName,
          item.fileFormat,
          item.assetType,
          item.boardName,
          item.equipmentModelName,
          item.manufacturerName,
          item.description,
        ]
          .filter(Boolean)
          .join(" "),
      );

      return haystack.includes(normalizedQuery);
    })
    .slice(0, limit);

  return { items };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Autenticacao necessaria." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawHash = searchParams.get("hash");
  const boardId = searchParams.get("board_id")?.trim() || null;
  const equipmentModelId = searchParams.get("equipment_model_id")?.trim() || null;

  if (!rawHash) {
    try {
      return NextResponse.json(await searchTechnicalAssets(request));
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Nao foi possivel listar os arquivos tecnicos.",
        },
        { status: 500 },
      );
    }
  }

  let hash: string;
  try {
    hash = normalizeTechnicalAssetHash(rawHash);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hash invalido." },
      { status: 400 },
    );
  }

  try {
    const asset = await findAssetByHash(hash);
    if (!asset) {
      return NextResponse.json({ exists: false });
    }

    const matchingLink =
      boardId || equipmentModelId
        ? (asset.technical_asset_links ?? []).find((link) =>
            matchesLinkContext(link, boardId, equipmentModelId),
          ) ?? null
        : null;

    return NextResponse.json({
      exists: true,
      assetId: asset.id,
      originalFileName: asset.original_filename,
      fileFormat: asset.file_format,
      assetType: asset.asset_type,
      associationLinked: Boolean(matchingLink),
      association: resolveAssetAssociation(asset, boardId, equipmentModelId),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel verificar a biblioteca tecnica.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Autenticacao necessaria." }, { status: 401 });
  }

  const supabase = await createClient();
  const payload = (await request.json().catch(() => null)) as TechnicalAssetMetadataPayload | null;

  if (!payload?.fileName || !payload?.format || !payload?.hashSha256) {
    return NextResponse.json(
      { error: "Metadados do arquivo tecnico estao incompletos." },
      { status: 400 },
    );
  }

  const boardId = String(payload.boardId ?? "").trim() || null;
  const equipmentModelId = String(payload.equipmentModelId ?? "").trim() || null;
  const diagnosticId = String(payload.diagnosticId ?? "").trim() || null;

  try {
    const validation = validateTechnicalAssetFile({
      name: payload.fileName,
      size: payload.fileSizeBytes,
      type: payload.mimeType,
    });
    const hash = normalizeTechnicalAssetHash(payload.hashSha256);
    const storagePath = buildTechnicalAssetStoragePath({
      hash,
      format: validation.format,
    });

    let asset = await findAssetByHash(hash);
    let matchingLink =
      boardId || equipmentModelId
        ? (asset?.technical_asset_links ?? []).find((link) =>
            matchesLinkContext(link, boardId, equipmentModelId),
          ) ?? null
        : null;

    let plan = planTechnicalAssetPersistence({
      existingAssetId: asset?.id ?? null,
      boardId,
      equipmentModelId,
      existingLinkId: matchingLink?.id ?? null,
    });

    if (plan.shouldInsertAsset) {
      const { data: insertedAsset, error: insertAssetError } = await supabase
        .from("technical_assets")
        .insert({
          asset_type: mapTechnicalAssetType(validation.format),
          file_format: validation.format,
          original_filename: payload.fileName,
          storage_bucket: TECHNICAL_ASSET_BUCKET,
          storage_path: storagePath,
          file_size_bytes: validation.fileSizeBytes,
          file_hash_sha256: hash,
          mime_type: getTechnicalAssetMimeType(validation.format, payload.mimeType),
          parser_status: getTechnicalAssetParserStatus(validation.format),
          extracted_text_status: getTechnicalAssetExtractedTextStatus(validation.format),
          metadata: {
            source: "boardview_lab",
            diagnostic_id: diagnosticId,
          },
          uploaded_by_user_id: user.id,
        })
        .select(`
          id,
          original_filename,
          asset_type,
          file_format,
          technical_asset_links (
            id,
            board_id,
            equipment_model_id
          )
        `)
        .single<TechnicalAssetRow>();

      if (insertAssetError || !insertedAsset) {
        asset = await findAssetByHash(hash);
        if (!asset) {
          return NextResponse.json(
            {
              error:
                insertAssetError?.message ??
                "Falha ao registrar os metadados do arquivo tecnico no banco.",
            },
            { status: 500 },
          );
        }
      } else {
        asset = insertedAsset;
      }
    }

    if (!asset) {
      return NextResponse.json(
        { error: "Falha ao localizar o arquivo tecnico apos o upload." },
        { status: 500 },
      );
    }

    matchingLink =
      boardId || equipmentModelId
        ? (asset.technical_asset_links ?? []).find((link) =>
            matchesLinkContext(link, boardId, equipmentModelId),
          ) ?? null
        : null;

    plan = planTechnicalAssetPersistence({
      existingAssetId: asset.id,
      boardId,
      equipmentModelId,
      existingLinkId: matchingLink?.id ?? null,
    });

      const linkResult = plan.shouldInsertLink
      ? await ensureAssetLink({
          assetId: asset.id,
          boardId,
          equipmentModelId,
          linkedByUserId: user.id,
        })
      : { linkId: matchingLink?.id ?? null, created: false };

    if (boardId || equipmentModelId) {
      await trySyncPrimaryAssociation(asset.id, boardId, equipmentModelId);
    }

    const alreadySaved = !plan.shouldUploadBinary && !plan.shouldInsertAsset;
    const associationCreated = Boolean(linkResult.created);

    return NextResponse.json({
      assetId: asset.id,
      alreadySaved,
      associationCreated,
      association: resolveAssetAssociation(asset, boardId, equipmentModelId),
      message: alreadySaved
        ? associationCreated
          ? "Arquivo ja estava salvo e foi vinculado ao contexto atual."
          : "Arquivo ja salvo."
        : buildAssociationMessage(boardId, equipmentModelId),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao salvar o arquivo tecnico.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Autenticacao necessaria." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as TechnicalAssetAssociationPayload | null;
  const assetIds = [...new Set((payload?.assetIds ?? []).map((value) => String(value).trim()).filter(Boolean))];

  if (!assetIds.length) {
    return NextResponse.json(
      { error: "Selecione ao menos um arquivo tecnico salvo para associar." },
      { status: 400 },
    );
  }

  try {
    const assets = await findAssetsByIds(assetIds);
    if (assets.length !== assetIds.length) {
      return NextResponse.json(
        { error: "Um ou mais arquivos tecnicos nao foram encontrados." },
        { status: 404 },
      );
    }

    const associationRequestProvided =
      payload !== null &&
      (Object.prototype.hasOwnProperty.call(payload, "boardId") ||
        Object.prototype.hasOwnProperty.call(payload, "equipmentModelId") ||
        Boolean(payload?.createBoard) ||
        Boolean(payload?.createEquipmentModel));
    const board = associationRequestProvided
      ? await ensureBoardAssociationTarget(payload ?? {})
      : { boardId: null, boardName: null };
    const equipmentModel = associationRequestProvided
      ? await ensureEquipmentModelAssociationTarget(payload ?? {})
      : { equipmentModelId: null, equipmentModelName: null };
    const manufacturer = await resolveManufacturerMetadata(
      String(payload?.manufacturerId ?? "").trim() || null,
      String(payload?.manufacturerName ?? "").trim() || null,
    );
    const displayName = String(payload?.displayName ?? "").trim() || null;
    const description = String(payload?.description ?? "").trim() || null;
    const hasAssociationUpdate = associationRequestProvided;
    const hasMetadataUpdate = Boolean(
      displayName ||
        description ||
        manufacturer.manufacturerId ||
        manufacturer.manufacturerName,
    );

    if (
      !hasAssociationUpdate &&
      !hasMetadataUpdate
    ) {
      return NextResponse.json(
        {
          error:
            "Informe ao menos um campo de metadado ou uma associacao de placa/modelo para salvar.",
        },
        { status: 400 },
      );
    }

    if (hasAssociationUpdate) {
      await ensureModelBoardLink(board.boardId, equipmentModel.equipmentModelId);
    }

    for (const asset of assets) {
      if (hasAssociationUpdate) {
        await clearAssetLinks(asset.id);
        if (board.boardId || equipmentModel.equipmentModelId) {
          await ensureAssetLink({
            assetId: asset.id,
            boardId: board.boardId,
            equipmentModelId: equipmentModel.equipmentModelId,
            linkedByUserId: user.id,
          });
        }
        await trySyncPrimaryAssociation(asset.id, board.boardId, equipmentModel.equipmentModelId);
      }

      await updateTechnicalAssetMetadata({
        assetId: asset.id,
        displayName,
        description,
        manufacturerId: manufacturer.manufacturerId,
        manufacturerName: manufacturer.manufacturerName,
      });
    }

    const updatedAssets = await findAssetsByIds(assetIds);
    const association = resolveAssetAssociation(
      updatedAssets[0] ?? null,
      board.boardId,
      equipmentModel.equipmentModelId,
    );

    return NextResponse.json({
      assetIds,
      association,
      message:
        hasAssociationUpdate
          ? assetIds.length > 1
            ? "Arquivos tecnicos associados ao contexto selecionado."
            : "Arquivo tecnico associado ao contexto selecionado."
          : assetIds.length > 1
            ? "Metadados dos arquivos tecnicos atualizados."
            : "Metadados do arquivo tecnico atualizados.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao associar o arquivo tecnico.",
      },
      { status: 400 },
    );
  }
}
