import { createDiagnosticAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { EquipmentIntakeForm } from "@/components/equipment-intake-form";
import { requireCurrentUser } from "@/lib/auth";
import { getDiagnosticCatalog } from "@/lib/services/catalog";

type NewDiagnosticPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewDiagnosticPage({
  searchParams,
}: NewDiagnosticPageProps) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const { categories, manufacturers, models } = await getDiagnosticCatalog();

  return (
    <AppShell
      title="Cadastro de equipamento"
      description="Cadastre o equipamento com modelo, fotos e dados de entrada antes de começar o diagnóstico."
      user={user}
      actionLabel="Voltar para dashboard"
      actionHref="/"
    >
      <div className="grid gap-4">
        <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6 shadow-[0_18px_44px_rgba(72,62,49,0.06)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Cadastro de equipamento
          </p>
          <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Registrar os dados de entrada
          </h3>

          <EquipmentIntakeForm
            action={createDiagnosticAction}
            categories={categories}
            manufacturers={manufacturers}
            models={models}
            error={params.error}
          />
        </section>
      </div>
    </AppShell>
  );
}
