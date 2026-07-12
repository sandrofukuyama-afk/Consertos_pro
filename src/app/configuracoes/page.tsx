import { ModulePage } from "@/components/module-page";
import { requireCurrentUser } from "@/lib/auth";
import { moduleTasks } from "@/lib/mock-data";

export default async function ConfiguracoesPage() {
  const user = await requireCurrentUser();

  return (
    <ModulePage
      title="Configurações e acessos"
      description="Aqui ficam os usuários, quem pode acessar o sistema e o histórico do que foi alterado."
      highlights={moduleTasks.configuracoes}
      user={user}
    />
  );
}
