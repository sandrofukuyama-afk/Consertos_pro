import { ModulePage } from "@/components/module-page";
import { requireCurrentUser } from "@/lib/auth";
import { moduleTasks } from "@/lib/mock-data";

export default async function CatalogoTecnicoPage() {
  const user = await requireCurrentUser();

  return (
    <ModulePage
      title="Catálogo técnico mestre"
      description="Base dedicada a categorias, fabricantes, modelos, placas e componentes. Esta etapa corresponde ao bloco estrutural que evita duplicidade e prepara o sistema para busca e diagnóstico consistente."
      highlights={moduleTasks.catalogo}
      user={user}
    />
  );
}
