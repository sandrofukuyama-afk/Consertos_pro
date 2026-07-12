import { ModulePage } from "@/components/module-page";
import { requireCurrentUser } from "@/lib/auth";
import { moduleTasks } from "@/lib/mock-data";

export default async function CatalogoTecnicoPage() {
  const user = await requireCurrentUser();

  return (
    <ModulePage
      title="Catálogo técnico"
      description="Aqui ficam categorias, fabricantes, modelos, placas e componentes. Essa parte ajuda a manter tudo organizado e evita cadastro repetido."
      highlights={moduleTasks.catalogo}
      user={user}
    />
  );
}
