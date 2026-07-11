import { ModulePage } from "@/components/module-page";
import { moduleTasks } from "@/lib/mock-data";

export default function BuscaPage() {
  return (
    <ModulePage
      title="Busca inteligente"
      description="Primeira fundacao da busca operacional por sintomas, modelos, placas e componentes. O desenho do modulo ja considera a evolucao futura para pgvector, casos semelhantes e RAG."
      highlights={moduleTasks.busca}
    />
  );
}
