import { ModulePage } from "@/components/module-page";
import { requireCurrentUser } from "@/lib/auth";
import { moduleTasks } from "@/lib/mock-data";

export default async function ConfiguracoesPage() {
  const user = await requireCurrentUser();

  return (
    <ModulePage
      title="Configurações e controle de acesso"
      description="Espaço reservado para usuários técnicos, revisores, histórico de alterações e controle básico de acesso. Isso sustenta rastreabilidade e promove conhecimento com mais confiança."
      highlights={moduleTasks.configuracoes}
      user={user}
    />
  );
}
