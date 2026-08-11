import { AppShell } from "@/components/app-shell";
import { BoardviewLab } from "@/components/boardview-lab";
import { requireCurrentUser } from "@/lib/auth";
import { getLibraryCatalog } from "@/lib/services/catalog";
import { createClient } from "@/lib/supabase/server";

type BoardviewLabPageProps = {
  searchParams: Promise<{
    board_id?: string;
    model_id?: string;
    diagnostic_id?: string;
    boardview_asset_id?: string;
    schematic_asset_id?: string;
    q?: string;
    view?: "split" | "boardview" | "schematic";
  }>;
};

type InitialTechnicalAsset = {
  slot: "boardview" | "schematic";
  assetId: string;
  fileName: string;
  format: "brd" | "bdv" | "pdf";
  mimeType: string;
  fileSizeBytes: number;
  association: {
    boardId: string | null;
    boardName: string | null;
    equipmentModelId: string | null;
    equipmentModelName: string | null;
  };
};

function pickRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function BoardviewLabPage({
  searchParams,
}: BoardviewLabPageProps) {
  const userPromise = requireCurrentUser();
  const supabasePromise = createClient();
  const query = await searchParams;
  const boardId = query.board_id?.trim() || null;
  const equipmentModelId = query.model_id?.trim() || null;
  const diagnosticId = query.diagnostic_id?.trim() || null;
  const boardviewAssetId = query.boardview_asset_id?.trim() || null;
  const schematicAssetId = query.schematic_asset_id?.trim() || null;
  const initialQuery = query.q?.trim() || "";
  const initialViewerMode =
    query.view === "split" || query.view === "boardview" || query.view === "schematic"
      ? query.view
      : "split";
  const [user, supabase, catalog] = await Promise.all([
    userPromise,
    supabasePromise,
    getLibraryCatalog(),
  ]);

  const assetIds = [boardviewAssetId, schematicAssetId].filter(
    (value): value is string => Boolean(value),
  );

  const technicalAssetsResult = assetIds.length
    ? await supabase
        .from("technical_assets")
        .select(`
          id,
          original_filename,
          file_format,
          mime_type,
          file_size_bytes,
          technical_asset_links(
            board_id,
            equipment_model_id,
            boards(board_code),
            equipment_models(model_name)
          )
        `)
        .in("id", assetIds)
    : { data: [] as Array<{
        id: string;
        original_filename: string;
        file_format: "brd" | "bdv" | "pdf";
        mime_type: string;
        file_size_bytes: number;
        technical_asset_links: Array<{
          board_id: string | null;
          equipment_model_id: string | null;
          boards: { board_code: string | null } | null;
          equipment_models: { model_name: string | null } | null;
        }> | null;
      }> };

  const technicalAssetMap = new Map(
    (technicalAssetsResult.data ?? []).map((item) => [item.id, item]),
  );

  const initialAssets = [boardviewAssetId, schematicAssetId]
    .map((assetId, index) => {
      if (!assetId) {
        return null;
      }

      const item = technicalAssetMap.get(assetId);
      if (!item) {
        return null;
      }

      return {
        slot: index === 0 ? "boardview" : "schematic",
        assetId: item.id,
        fileName: item.original_filename,
        format: item.file_format,
        mimeType: item.mime_type,
        fileSizeBytes: item.file_size_bytes,
        association: {
          boardId: item.technical_asset_links?.[0]?.board_id ?? null,
          boardName:
            pickRelation(item.technical_asset_links?.[0]?.boards)?.board_code ?? null,
          equipmentModelId: item.technical_asset_links?.[0]?.equipment_model_id ?? null,
          equipmentModelName:
            pickRelation(item.technical_asset_links?.[0]?.equipment_models)?.model_name ??
            null,
        },
      } satisfies InitialTechnicalAsset;
    })
    .filter((item): item is InitialTechnicalAsset => Boolean(item));

  const fallbackAssociation =
    initialAssets[0]?.association ??
    initialAssets[1]?.association ?? {
      boardId: null,
      boardName: null,
      equipmentModelId: null,
      equipmentModelName: null,
    };

  const [boardResult, modelResult] = await Promise.all([
    (boardId ?? fallbackAssociation.boardId)
      ? supabase
          .from("boards")
          .select("id, board_code")
          .eq("id", boardId ?? fallbackAssociation.boardId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    (equipmentModelId ?? fallbackAssociation.equipmentModelId)
      ? supabase
          .from("equipment_models")
          .select("id, model_name")
          .eq("id", equipmentModelId ?? fallbackAssociation.equipmentModelId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <AppShell
      title="Laboratório boardview"
      description="Abrir, inspecionar e salvar arquivos .brd, .bdv e .pdf localmente."
      actionLabel="Voltar ao início"
      actionHref="/"
      user={user}
      shellMode="workspace"
    >
      <BoardviewLab
        initialAssociation={{
          boardId: boardId ?? fallbackAssociation.boardId,
          boardName: boardResult.data?.board_code ?? fallbackAssociation.boardName,
          equipmentModelId: equipmentModelId ?? fallbackAssociation.equipmentModelId,
          equipmentModelName:
            modelResult.data?.model_name ?? fallbackAssociation.equipmentModelName,
          diagnosticId,
        }}
        catalogOptions={{
          boards: catalog.boards,
          models: catalog.models,
          manufacturers: catalog.manufacturers,
        }}
        initialAssets={initialAssets}
        initialQuery={initialQuery}
        initialViewerMode={initialViewerMode}
      />
    </AppShell>
  );
}
