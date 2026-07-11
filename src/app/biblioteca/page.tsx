import { ModulePage } from "@/components/module-page";
import { moduleTasks } from "@/lib/mock-data";

export default function BibliotecaPage() {
  return (
    <ModulePage
      title="Biblioteca tecnica"
      description="Area inicial para documentos tecnicos, esquemas, boardviews, BIOS e notas de apoio. A interface ja reserva o espaco certo para o fluxo de upload e catalogacao previsto no MVP."
      highlights={moduleTasks.biblioteca}
    />
  );
}
