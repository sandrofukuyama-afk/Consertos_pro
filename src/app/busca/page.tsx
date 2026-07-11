import { ModulePage } from "@/components/module-page";
import { requireCurrentUser } from "@/lib/auth";
import { moduleTasks } from "@/lib/mock-data";

export default async function BuscaPage() {
  const user = await requireCurrentUser();

  return (
    <ModulePage
      title="Busca inteligente"
      description="Primeira fundacao da busca operacional por sintomas, modelos, placas e componentes. O desenho do modulo ja considera a evolucao futura para pgvector, casos semelhantes e RAG."
      highlights={moduleTasks.busca}
      user={user}
    />
  );
}
