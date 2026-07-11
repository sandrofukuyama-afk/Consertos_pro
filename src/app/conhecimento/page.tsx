import { ModulePage } from "@/components/module-page";
import { moduleTasks } from "@/lib/mock-data";

export default function ConhecimentoPage() {
  return (
    <ModulePage
      title="Conhecimento consolidado"
      description="Camada de memoria validada da oficina. Este modulo nasce separado do historico bruto para respeitar a diferenca entre hipotese, causa confirmada e solucao aplicada."
      highlights={moduleTasks.conhecimento}
    />
  );
}
