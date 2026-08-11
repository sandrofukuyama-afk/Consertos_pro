import { AppShell } from "@/components/app-shell";
import { BoardviewLab } from "@/components/boardview-lab";
import { requireCurrentUser } from "@/lib/auth";

export default async function BoardviewLabPage() {
  const user = await requireCurrentUser();

  return (
    <AppShell
      title="Laboratorio boardview"
      description="Abrir e inspecionar arquivos .brd e esquemas .pdf localmente, sem upload."
      actionLabel="Voltar aos casos"
      actionHref="/"
      user={user}
      shellMode="workspace"
    >
      <BoardviewLab />
    </AppShell>
  );
}
