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

export default async function EstatisticasPage() {
  const user = await requireCurrentUser();
  const stats = await getWorkshopStatistics();

  return (
    <AppShell
      title="Estatisticas tecnicas"
      description="Inteligencia operacional da oficina: defeitos recorrentes, componentes mais falhos, tempo medio de resolucao e frequencia por fabricante e modelo."
      user={user}
    >
      <div className="grid gap-4">
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-[26px] border border-[var(--panel-border)] bg-white/85 p-5 shadow-[0_14px_32px_rgba(72,62,49,0.06)]">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Casos resolvidos
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              {stats.totalResolvedCases}
            </p>
          </article>
          <article className="rounded-[26px] border border-[var(--panel-border)] bg-white/85 p-5 shadow-[0_14px_32px_rgba(72,62,49,0.06)]">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Tempo medio de resolucao
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              {formatMinutes(stats.averageResolutionMinutes)}
            </p>
          </article>
        </section>

        <section className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Distribuicao de resultado
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Confirmado, provavel e nao resolvido
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
                  label: "Provavel",
                  value: stats.resolutionRate.probable,
                  color: "var(--accent-amber)",
                },
                {
                  key: "unresolved",
                  label: "Nao resolvido",
                  value: stats.resolutionRate.unresolved,
                  color: "var(--danger)",
                },
              ]}
            />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Por fabricante
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Casos e tempo medio
            </h3>

            <div className="mt-5">
              <StatBarChart
                accent="teal"
                emptyLabel="Ainda nao ha casos resolvidos suficientes."
                items={stats.byManufacturer.map((item) => ({
                  key: item.manufacturer,
                  label: item.manufacturer,
                  sublabel: `Tempo medio: ${formatMinutes(item.averageResolutionMinutes)}`,
                  value: item.caseCount,
                  valueLabel: `${item.caseCount} caso(s)`,
                }))}
              />
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Frequencia de causas
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Padroes confirmados na bancada
            </h3>

            <div className="mt-5">
              <StatBarChart
                accent="copper"
                emptyLabel="Ainda nao ha causas confirmadas registradas."
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
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Por modelo
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Modelos com mais casos
            </h3>

            <div className="mt-5">
              <StatBarChart
                accent="teal"
                emptyLabel="Ainda nao ha modelos com casos resolvidos suficientes."
                items={stats.byModel.map((item) => ({
                  key: `${item.manufacturer}-${item.model}`,
                  label: item.model,
                  sublabel: `${item.manufacturer} · Tempo medio: ${formatMinutes(item.averageResolutionMinutes)}`,
                  value: item.caseCount,
                  valueLabel: `${item.caseCount} caso(s)`,
                }))}
              />
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Componentes recorrentes
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Componentes mais falhos
            </h3>

            <div className="mt-5">
              <StatBarChart
                accent="copper"
                emptyLabel="Ainda nao ha componentes vinculados a causas confirmadas."
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
      </div>
    </AppShell>
  );
}
