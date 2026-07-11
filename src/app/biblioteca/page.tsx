import { ModulePage } from "@/components/module-page";
import { requireCurrentUser } from "@/lib/auth";
import { moduleTasks } from "@/lib/mock-data";

export default async function BibliotecaPage() {
  const user = await requireCurrentUser();

  return (
    <ModulePage
      title="Biblioteca tecnica"
      description="Area inicial para documentos tecnicos, esquemas, boardviews, BIOS e notas de apoio. A interface ja reserva o espaco certo para o fluxo de upload e catalogacao previsto no MVP."
      highlights={moduleTasks.biblioteca}
      user={user}
    />
  );
}
