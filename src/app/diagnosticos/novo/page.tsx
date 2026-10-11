import { createDiagnosticAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { EquipmentIntakeForm } from "@/components/equipment-intake-form";
import { QuickChatStart } from "@/components/quick-chat-start";
import { requireCurrentUser } from "@/lib/auth";
import { getDiagnosticCatalog } from "@/lib/services/catalog";

// O chat com o agente de IA roda como server action desta pagina e pode levar
// alguns minutos (varias consultas ao boardview/esquema e raciocinio estendido).
export const maxDuration = 300;

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
      title="Novo diagnóstico"
      description="Comece pelo chat. Os dados do aparelho podem ser completados depois."
      user={user}
      actionLabel="← Casos"
      actionHref="/"
    >
      <div className="grid gap-4">
        <QuickChatStart categories={categories} returnTo="/diagnosticos/novo" />

        <details
          open={Boolean(params.error)}
          className="group rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-6 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-base font-semibold text-[var(--foreground)]">
                Prefere cadastrar o aparelho completo antes?
              </span>
              <span className="mt-1 block text-sm text-[var(--muted)]">
                Modelo, número de série, acessórios, condição de entrada e fotos.
              </span>
            </span>
            <svg
              className="h-5 w-5 shrink-0 text-[var(--muted)] transition group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>

          <div className="border-t border-[var(--panel-border)] p-4 sm:p-6">
            <EquipmentIntakeForm
              action={createDiagnosticAction}
              categories={categories}
              manufacturers={manufacturers}
              models={models}
              error={params.error}
            />
          </div>
        </details>
      </div>
    </AppShell>
  );
}
