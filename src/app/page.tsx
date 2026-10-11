import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { DashboardEmptyState } from "@/components/dashboard-empty-state";
import { DeleteDiagnosticButton } from "@/components/delete-diagnostic-button";
import { QuickChatStart } from "@/components/quick-chat-start";
import { StatusPill } from "@/components/status-pill";
import { requireCurrentUser } from "@/lib/auth";
import { getDiagnosticCatalog } from "@/lib/services/catalog";
import { getDashboardData } from "@/lib/services/dashboard";

// O chat com o agente de IA roda como server action desta pagina e pode levar
// alguns minutos (varias consultas ao boardview/esquema e raciocinio estendido).
export const maxDuration = 300;

type HomePageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const userPromise = requireCurrentUser();
  const dashboardPromise = getDashboardData();
  const [user, dashboard, catalog] = await Promise.all([
    userPromise,
    dashboardPromise,
    getDiagnosticCatalog(),
  ]);

  const params = await searchParams;

  return (
    <AppShell
      title="Bancada"
      description="Abra um caso pelo chat ou continue um diagnóstico em andamento."
      user={user}
      actionLabel=""
    >
      <div className="grid gap-4 lg:gap-5">
        {params.message ? (
          <section className="rounded-[26px] border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] p-5 text-sm text-[var(--accent-teal)] shadow-[0_14px_32px_rgba(20,18,28,0.06)]">
            {params.message}
          </section>
        ) : null}

        {params.error ? (
          <section className="rounded-[26px] border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] p-5 text-sm text-[var(--danger)] shadow-[0_14px_32px_rgba(20,18,28,0.06)]">
            {params.error}
          </section>
        ) : null}

        <QuickChatStart categories={catalog.categories} returnTo="/" />

        <section className="grid grid-cols-3 gap-2 sm:gap-3">
          {dashboard.kpis.map((item) => (
            <article
              key={item.label}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-3 sm:px-4"
            >
              <p className="truncate text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                {item.label}
              </p>
              <p
                className={`mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold ${
                  item.tone === "teal"
                    ? "text-[var(--accent-teal)]"
                    : item.tone === "copper"
                      ? "text-[var(--accent-copper)]"
                      : "text-[var(--accent-amber)]"
                }`}
              >
                {item.value}
              </p>
            </article>
          ))}
        </section>

        <section className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 shadow-[0_18px_44px_rgba(20,18,28,0.06)] sm:p-5">
          <div className="flex flex-col gap-2 border-b border-[var(--panel-border)] pb-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Em andamento
              </p>
              <h3 className="mt-2 break-words font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                Casos abertos
              </h3>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[var(--muted)]">
              Toque num caso para continuar a conversa com a IA.
            </p>
          </div>

          {dashboard.diagnostics.length ? (
            <div className="mt-4 overflow-hidden rounded-[24px] border border-[var(--panel-border)]">
              <div className="hidden grid-cols-[1fr_1.2fr_1.05fr_1.05fr_0.9fr_0.7fr] gap-3 bg-[var(--background-strong)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
                <span>Equipamento</span>
                <span>Defeito atual</span>
                <span>Ultimo teste</span>
                <span>Proximo passo</span>
                <span>Status</span>
                <span>Acao</span>
              </div>

              {dashboard.diagnostics.map((diagnostic) => (
                <div
                  key={diagnostic.id}
                  className="grid gap-3 border-t border-[var(--panel-border)] p-4 lg:grid-cols-[1fr_1.2fr_1.05fr_1.05fr_0.9fr_0.7fr]"
                >
                  <Link
                    href={`/diagnosticos/${diagnostic.recordId}`}
                    className="grid gap-3 transition hover:bg-white/2 lg:col-span-5 lg:grid-cols-[1fr_1.2fr_1.05fr_1.05fr_0.9fr]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3 lg:block">
                        <p className="break-words text-sm font-semibold text-[var(--foreground)]">
                          {diagnostic.equipment}
                        </p>
                        <div className="lg:hidden">
                          <StatusPill label={diagnostic.status} />
                        </div>
                      </div>
                      <p className="mt-1 break-words text-sm leading-6 text-[var(--muted)]">
                        {diagnostic.category}
                      </p>
                      <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                        {diagnostic.id} • {diagnostic.updatedAt}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-[var(--muted)] lg:hidden">
                        Defeito atual
                      </p>
                      <p className="mt-1 break-words text-sm leading-6 text-[var(--foreground)] lg:mt-0">
                        {diagnostic.symptom}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-[var(--muted)] lg:hidden">
                        Ultimo teste
                      </p>
                      <p className="mt-1 break-words text-sm leading-6 text-[var(--foreground)] lg:mt-0">
                        {diagnostic.lastTest}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-[var(--muted)] lg:hidden">
                        Proximo passo
                      </p>
                      <p className="mt-1 break-words text-sm leading-6 text-[var(--foreground)] lg:mt-0">
                        {diagnostic.nextStep}
                      </p>
                    </div>

                    <div className="hidden items-start lg:flex">
                      <StatusPill label={diagnostic.status} />
                    </div>
                  </Link>

                  <div className="flex items-center justify-end lg:justify-center">
                    <DeleteDiagnosticButton
                      diagnosticId={diagnostic.recordId ?? diagnostic.id}
                      equipmentLabel={diagnostic.equipment}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <DashboardEmptyState />
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
