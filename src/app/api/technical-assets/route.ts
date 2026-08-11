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
  technical_asset_links?: Array<{
    id: string;
    board_id: string | null;
    equipment_model_id: string | null;
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
      technical_asset_links (
        id,
        board_id,
        equipment_model_id
      )
    `)
    .eq("file_hash_sha256", hash)
    .maybeSingle<TechnicalAssetRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
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

function buildAssociationMessage(boardId: string | null, equipmentModelId: string | null) {
  if (!boardId && !equipmentModelId) {
    return "Arquivo salvo sem associacao.";
  }

  return "Arquivo salvo e associado ao contexto atual.";
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
    return NextResponse.json({ error: "Hash SHA-256 e obrigatorio." }, { status: 400 });
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

    const alreadySaved = !plan.shouldUploadBinary && !plan.shouldInsertAsset;
    const associationCreated = Boolean(linkResult.created);

    return NextResponse.json({
      assetId: asset.id,
      alreadySaved,
      associationCreated,
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
