import { ModulePage } from "@/components/module-page";
import { requireCurrentUser } from "@/lib/auth";
import { moduleTasks } from "@/lib/mock-data";

export default async function ConfiguracoesPage() {
  const user = await requireCurrentUser();

  return (
    <ModulePage
      title="Configuracoes e governanca"
      description="Espaco reservado para usuarios tecnicos, revisores, auditoria e controle basico de acesso. Isso sustenta rastreabilidade e promove conhecimento com mais confianca."
      highlights={moduleTasks.configuracoes}
      user={user}
    />
  );
}
