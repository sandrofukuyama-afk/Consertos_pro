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
      description="Cadastre o equipamento com modelo, fotos e dados de entrada antes de comecar o diagnostico."
      user={user}
      actionLabel="Voltar para dashboard"
      actionHref="/"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_360px]">
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

        <aside className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-white">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
            Responsavel atual
          </p>
          <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
            {user.fullName}
          </h3>
          <p className="mt-3 text-sm leading-6 text-[rgba(255,245,236,0.78)]">
            O equipamento ja entra com dados principais, fotos e contexto inicial. Depois voce continua com sintomas, testes e medicoes.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
