import { ModulePage } from "@/components/module-page";
import { requireCurrentUser } from "@/lib/auth";
import { moduleTasks } from "@/lib/mock-data";

export default async function ConhecimentoPage() {
  const user = await requireCurrentUser();

  return (
    <ModulePage
      title="Conhecimento consolidado"
      description="Camada de memoria validada da oficina. Este modulo nasce separado do historico bruto para respeitar a diferenca entre hipotese, causa confirmada e solucao aplicada."
      highlights={moduleTasks.conhecimento}
      user={user}
    />
  );
}
