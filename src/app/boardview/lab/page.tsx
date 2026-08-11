import { AppShell } from "@/components/app-shell";
import { BoardviewLab } from "@/components/boardview-lab";
import { requireCurrentUser } from "@/lib/auth";

export default async function BoardviewLabPage() {
  const user = await requireCurrentUser();

  return (
    <AppShell
      title="Laboratório boardview"
      description="Abrir e inspecionar arquivos .brd e esquemas .pdf localmente, sem upload."
      actionLabel="Voltar ao início"
      actionHref="/"
      user={user}
      shellMode="workspace"
    >
      <BoardviewLab />
    </AppShell>
  );
}
