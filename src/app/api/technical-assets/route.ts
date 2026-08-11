import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TECHNICAL_ASSET_BUCKET,
  buildTechnicalAssetStoragePath,
  normalizeTechnicalAssetHash,
  planTechnicalAssetPersistence,
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
    return "Arquivo salvo sem associação.";
  }

  return "Arquivo salvo e associado ao contexto atual.";
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawHash = searchParams.get("hash");
  const boardId = searchParams.get("board_id")?.trim() || null;
  const equipmentModelId = searchParams.get("equipment_model_id")?.trim() || null;

  if (!rawHash) {
    return NextResponse.json({ error: "Hash SHA-256 é obrigatório." }, { status: 400 });
  }

  let hash: string;
  try {
    hash = normalizeTechnicalAssetHash(rawHash);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hash inválido." },
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
            : "Não foi possível verificar a biblioteca técnica.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const supabase = await createClient();
  const formData = await request.formData();
  const file = formData.get("file");
  const boardId = String(formData.get("board_id") ?? "").trim() || null;
  const equipmentModelId =
    String(formData.get("equipment_model_id") ?? "").trim() || null;
  const diagnosticId = String(formData.get("diagnostic_id") ?? "").trim() || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo técnico ausente." }, { status: 400 });
  }

  try {
    const validation = validateTechnicalAssetFile(file);
    const bytes = Buffer.from(await file.arrayBuffer());
    const hash = normalizeTechnicalAssetHash(
      createHash("sha256").update(bytes).digest("hex"),
    );

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

    if (plan.shouldUploadBinary) {
      const storagePath = buildTechnicalAssetStoragePath({
        hash,
        format: validation.format,
      });

      const { error: uploadError } = await supabase.storage
        .from(TECHNICAL_ASSET_BUCKET)
        .upload(storagePath, bytes, {
          contentType: validation.mimeType,
          upsert: false,
        });

      if (uploadError) {
        asset = await findAssetByHash(hash);
        if (!asset) {
          return NextResponse.json({ error: uploadError.message }, { status: 500 });
        }
      }

      if (!asset) {
        const { data: insertedAsset, error: insertAssetError } = await supabase
          .from("technical_assets")
          .insert({
            asset_type: validation.assetType,
            file_format: validation.format,
            original_filename: file.name,
            storage_bucket: TECHNICAL_ASSET_BUCKET,
            storage_path: storagePath,
            file_size_bytes: validation.fileSizeBytes,
            file_hash_sha256: hash,
            mime_type: validation.mimeType,
            parser_status: validation.parserStatus,
            extracted_text_status: validation.extractedTextStatus,
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
          await supabase.storage.from(TECHNICAL_ASSET_BUCKET).remove([storagePath]);

          asset = await findAssetByHash(hash);
          if (!asset) {
            return NextResponse.json(
              {
                error:
                  insertAssetError?.message ??
                  "Falha ao registrar o arquivo técnico no banco.",
              },
              { status: 500 },
            );
          }
        } else {
          asset = insertedAsset;
        }
      }
    }

    if (!asset) {
      return NextResponse.json(
        { error: "Falha ao localizar o arquivo técnico após o upload." },
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
          ? "Arquivo já estava salvo e foi vinculado ao contexto atual."
          : "Arquivo já salvo."
        : buildAssociationMessage(boardId, equipmentModelId),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao salvar o arquivo técnico.",
      },
      { status: 400 },
    );
  }
}
