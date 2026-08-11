import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { DashboardEmptyState } from "@/components/dashboard-empty-state";
import { StatusPill } from "@/components/status-pill";
import { requireCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/services/dashboard";

type HomePageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const userPromise = requireCurrentUser();
  const dashboardPromise = getDashboardData();
  const [user, dashboard] = await Promise.all([userPromise, dashboardPromise]);

  const params = await searchParams;

  return (
    <AppShell
      title="Painel da bancada"
      description="Resumo da fila principal de computadores e notebooks em andamento."
      user={user}
    >
      <div className="grid gap-4 lg:gap-5">
        {params.message ? (
          <section className="rounded-[26px] border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] p-5 text-sm text-[var(--accent-teal)] shadow-[0_14px_32px_rgba(20,18,28,0.06)]">
            {params.message}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          {dashboard.kpis.map((item) => (
            <article
              key={item.label}
              className="rounded-[26px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 shadow-[0_14px_32px_rgba(20,18,28,0.06)] sm:p-5"
            >
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                {item.label}
              </p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <span className="font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
                  {item.value}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.tone === "teal"
                      ? "bg-[rgba(45,139,130,0.14)] text-[var(--accent-teal)]"
                      : item.tone === "copper"
                        ? "bg-[rgba(109,94,242,0.14)] text-[var(--accent-copper)]"
                        : "bg-[rgba(216,166,84,0.18)] text-[var(--accent-amber)]"
                  }`}
                >
                  {item.change}
                </span>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 shadow-[0_18px_44px_rgba(20,18,28,0.06)] sm:p-5">
          <div className="flex flex-col gap-2 border-b border-[var(--panel-border)] pb-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Central de casos
              </p>
              <h3 className="mt-2 break-words font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                Fila ativa
              </h3>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[var(--muted)]">
              Apenas computadores e notebooks com status ativo ou aguardando teste.
            </p>
          </div>

          {dashboard.diagnostics.length ? (
            <div className="mt-4 overflow-hidden rounded-[24px] border border-[var(--panel-border)]">
              <div className="hidden grid-cols-[1fr_1.2fr_1.05fr_1.05fr_0.9fr] gap-3 bg-[var(--background-strong)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
                <span>Equipamento</span>
                <span>Defeito atual</span>
                <span>Último teste</span>
                <span>Próximo passo</span>
                <span>Status</span>
              </div>

              {dashboard.diagnostics.map((diagnostic) => (
                <Link
                  key={diagnostic.id}
                  href={`/diagnosticos/${diagnostic.recordId}`}
                  className="grid gap-3 border-t border-[var(--panel-border)] p-4 transition hover:bg-white/2 lg:grid-cols-[1fr_1.2fr_1.05fr_1.05fr_0.9fr]"
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
                      Último teste
                    </p>
                    <p className="mt-1 break-words text-sm leading-6 text-[var(--foreground)] lg:mt-0">
                      {diagnostic.lastTest}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-mono uppercase tracking-[0.16em] text-[var(--muted)] lg:hidden">
                      Próximo passo
                    </p>
                    <p className="mt-1 break-words text-sm leading-6 text-[var(--foreground)] lg:mt-0">
                      {diagnostic.nextStep}
                    </p>
                  </div>

                  <div className="hidden items-start lg:flex">
                    <StatusPill label={diagnostic.status} />
                  </div>
                </Link>
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
