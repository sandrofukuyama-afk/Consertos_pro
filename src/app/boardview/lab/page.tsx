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
  }>;
};

export default async function BoardviewLabPage({
  searchParams,
}: BoardviewLabPageProps) {
  const userPromise = requireCurrentUser();
  const supabasePromise = createClient();
  const query = await searchParams;
  const boardId = query.board_id?.trim() || null;
  const equipmentModelId = query.model_id?.trim() || null;
  const diagnosticId = query.diagnostic_id?.trim() || null;
  const [user, supabase, catalog] = await Promise.all([
    userPromise,
    supabasePromise,
    getLibraryCatalog(),
  ]);

  const [boardResult, modelResult] = await Promise.all([
    boardId
      ? supabase
          .from("boards")
          .select("id, board_code")
          .eq("id", boardId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    equipmentModelId
      ? supabase
          .from("equipment_models")
          .select("id, model_name")
          .eq("id", equipmentModelId)
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
          boardId,
          boardName: boardResult.data?.board_code ?? null,
          equipmentModelId,
          equipmentModelName: modelResult.data?.model_name ?? null,
          diagnosticId,
        }}
        catalogOptions={{
          boards: catalog.boards,
          models: catalog.models,
          manufacturers: catalog.manufacturers,
        }}
      />
    </AppShell>
  );
}
