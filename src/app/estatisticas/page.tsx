import { AppShell } from "@/components/app-shell";
import { StatBarChart, StatusDistributionBar } from "@/components/stat-bar-chart";
import { requireCurrentUser } from "@/lib/auth";
import { CAUSE_TYPE_LABELS, getWorkshopStatistics } from "@/lib/services/statistics";

function formatMinutes(value: number | null) {
  if (value === null) {
    return "Sem dados";
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  if (hours === 0) {
    return `${minutes}min`;
  }

  return `${hours}h ${minutes}min`;
}

function formatTokenCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}

export default async function EstatisticasPage() {
  const userPromise = requireCurrentUser();
  const statsPromise = getWorkshopStatistics();
  const [user, stats] = await Promise.all([userPromise, statsPromise]);

  return (
    <AppShell
      title="Estatísticas da oficina"
      description="Veja os problemas que mais aparecem, os componentes que mais falham e o tempo medio para resolver."
      user={user}
    >
      <div className="grid gap-4">
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-[26px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-5 shadow-[0_14px_32px_rgba(20,18,28,0.06)]">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Casos resolvidos
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              {stats.totalResolvedCases}
            </p>
          </article>
          <article className="rounded-[26px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-5 shadow-[0_14px_32px_rgba(20,18,28,0.06)]">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Tempo médio de resolução
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              {formatMinutes(stats.averageResolutionMinutes)}
            </p>
          </article>
        </section>

        <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Distribuição de resultado
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Confirmado, provável e não resolvido
          </h3>

          <div className="mt-5">
            <StatusDistributionBar
              segments={[
                {
                  key: "confirmed",
                  label: "Confirmado",
                  value: stats.resolutionRate.confirmed,
                  color: "var(--success)",
                },
                {
                  key: "probable",
                  label: "Provável",
                  value: stats.resolutionRate.probable,
                  color: "var(--accent-amber)",
                },
                {
                  key: "unresolved",
                  label: "Não resolvido",
                  value: stats.resolutionRate.unresolved,
                  color: "var(--danger)",
                },
              ]}
            />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Por fabricante
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Casos e tempo médio
            </h3>

            <div className="mt-5">
              <StatBarChart
                accent="teal"
                emptyLabel="Ainda não há casos resolvidos suficientes."
                items={stats.byManufacturer.map((item) => ({
                  key: item.manufacturer,
                  label: item.manufacturer,
                  sublabel: `Tempo médio: ${formatMinutes(item.averageResolutionMinutes)}`,
                  value: item.caseCount,
                  valueLabel: `${item.caseCount} caso(s)`,
                }))}
              />
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Frequência de causas
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Padrões confirmados na bancada
            </h3>

            <div className="mt-5">
              <StatBarChart
                accent="copper"
                emptyLabel="Ainda não há causas confirmadas registradas."
                items={stats.causeFrequency.map((item) => ({
                  key: item.causeType,
                  label: CAUSE_TYPE_LABELS[item.causeType] ?? item.causeType,
                  value: item.count,
                  valueLabel: `${item.count} caso(s)`,
                }))}
              />
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Por modelo
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Modelos com mais casos
            </h3>

            <div className="mt-5">
              <StatBarChart
                accent="teal"
                emptyLabel="Ainda não há modelos com casos resolvidos suficientes."
                items={stats.byModel.map((item) => ({
                  key: `${item.manufacturer}-${item.model}`,
                  label: item.model,
                  sublabel: `${item.manufacturer} · Tempo médio: ${formatMinutes(item.averageResolutionMinutes)}`,
                  value: item.caseCount,
                  valueLabel: `${item.caseCount} caso(s)`,
                }))}
              />
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Componentes recorrentes
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Componentes mais falhos
            </h3>

            <div className="mt-5">
              <StatBarChart
                accent="copper"
                emptyLabel="Ainda não há componentes vinculados a causas confirmadas."
                items={stats.recurringComponents.map((item) => ({
                  key: item.componentRef,
                  label: item.componentRef,
                  sublabel: item.componentType,
                  value: item.occurrences,
                  valueLabel: `${item.occurrences}x`,
                }))}
              />
            </div>
          </article>
        </section>

        <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Consumo de API
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                Tokens e custo dos agentes
              </h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Visão operacional do uso de IA por modelo e tipo de tarefa.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <article className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Chamadas registradas
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                {stats.apiUsage.totalRequests}
              </p>
            </article>
            <article className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Tokens consumidos
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                {formatTokenCount(stats.apiUsage.totalTokens)}
              </p>
            </article>
            <article className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Custo estimado
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                {formatUsd(stats.apiUsage.totalCostUsd)}
              </p>
            </article>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
            <article className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Por finalidade
              </p>
              <h4 className="mt-2 text-lg font-semibold tracking-tight text-[var(--foreground)]">
                Onde os tokens estão indo
              </h4>
              <div className="mt-4">
                <StatBarChart
                  accent="teal"
                  emptyLabel="Ainda não há consumo de API suficiente para exibir este corte."
                  items={stats.apiUsage.byPurpose.map((item) => ({
                    key: item.purpose,
                    label: item.purpose,
                    sublabel: `${item.requestCount} chamada(s) · ${formatUsd(item.totalCostUsd)}`,
                    value: item.totalTokens,
                    valueLabel: `${formatTokenCount(item.totalTokens)} tokens`,
                  }))}
                />
              </div>
            </article>

            <article className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Por modelo
              </p>
              <h4 className="mt-2 text-lg font-semibold tracking-tight text-[var(--foreground)]">
                Distribuição entre motores
              </h4>
              <div className="mt-4 space-y-3">
                {stats.apiUsage.byModel.length ? (
                  stats.apiUsage.byModel.map((item) => (
                    <div
                      key={item.model}
                      className="rounded-[20px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-[var(--foreground)]">
                            {item.model}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {item.requestCount} chamada(s)
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                            {formatTokenCount(item.totalTokens)} tokens
                          </p>
                          <p className="mt-1 text-sm text-[var(--foreground)]">
                            {formatUsd(item.totalCostUsd)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[20px] border border-dashed border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-6 text-sm text-[var(--muted)]">
                    Ainda não há chamadas registradas.
                  </div>
                )}
              </div>
            </article>
          </div>

          <div className="mt-6 rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Últimos 7 dias
            </p>
            <h4 className="mt-2 text-lg font-semibold tracking-tight text-[var(--foreground)]">
              Evolução diária do consumo
            </h4>
            <div className="mt-4">
              <StatBarChart
                accent="copper"
                emptyLabel="Ainda não há histórico recente de consumo."
                items={stats.apiUsage.recentDaily.map((item) => ({
                  key: item.dayLabel,
                  label: item.dayLabel,
                  sublabel: formatUsd(item.totalCostUsd),
                  value: item.totalTokens,
                  valueLabel: `${formatTokenCount(item.totalTokens)} tokens`,
                }))}
              />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
