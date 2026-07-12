import { ModulePage } from "@/components/module-page";
import { requireCurrentUser } from "@/lib/auth";
import { moduleTasks } from "@/lib/mock-data";

export default async function ConfiguracoesPage() {
  const user = await requireCurrentUser();

  return (
    <ModulePage
      title="Configurações e governança"
      description="Espaço reservado para usuários técnicos, revisores, auditoria e controle básico de acesso. Isso sustenta rastreabilidade e promove conhecimento com mais confiança."
      highlights={moduleTasks.configuracoes}
      user={user}
    />
  );
}
