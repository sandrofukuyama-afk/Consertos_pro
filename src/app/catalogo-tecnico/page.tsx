import { ModulePage } from "@/components/module-page";
import { moduleTasks } from "@/lib/mock-data";

export default function CatalogoTecnicoPage() {
  return (
    <ModulePage
      title="Catalogo tecnico mestre"
      description="Base dedicada a categorias, fabricantes, modelos, placas e componentes. Esta etapa corresponde ao bloco estrutural que evita duplicidade e prepara o sistema para busca e diagnostico consistente."
      highlights={moduleTasks.catalogo}
    />
  );
}
