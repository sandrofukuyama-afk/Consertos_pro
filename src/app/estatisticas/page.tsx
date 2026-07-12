import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/auth";
import { getWorkshopStatistics } from "@/lib/services/statistics";

const CAUSE_TYPE_LABELS: Record<string, string> = {
  component_failure: "Falha de componente",
  short_circuit: "Curto-circuito",
  bad_solder: "Solda fria",
  firmware_corruption: "Corrupcao de firmware",
  line_missing: "Linha ausente",
  liquid_damage: "Dano por liquido",
  thermal_failure: "Falha termica",
  other: "Outro",
};

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
        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Casos resolvidos", value: String(stats.totalResolvedCases) },
            { label: "Tempo medio", value: formatMinutes(stats.averageResolutionMinutes) },
            { label: "Confirmados", value: String(stats.resolutionRate.confirmed) },
            { label: "Nao resolvidos", value: String(stats.resolutionRate.unresolved) },
          ].map((item) => (
            <article
              key={item.label}
              className="rounded-[26px] border border-[var(--panel-border)] bg-white/85 p-5 shadow-[0_14px_32px_rgba(72,62,49,0.06)]"
            >
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                {item.label}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                {item.value}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Por fabricante
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Casos e tempo medio
            </h3>

            <div className="mt-5 space-y-3">
              {stats.byManufacturer.length ? (
                stats.byManufacturer.map((item) => (
                  <article
                    key={item.manufacturer}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {item.manufacturer}
                      </p>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                        {item.caseCount} caso(s)
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Tempo medio: {formatMinutes(item.averageResolutionMinutes)}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                  Ainda nao ha casos resolvidos suficientes.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Frequencia de causas
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Padroes confirmados na bancada
            </h3>

            <div className="mt-5 space-y-3">
              {stats.causeFrequency.length ? (
                stats.causeFrequency.map((item) => (
                  <article
                    key={item.causeType}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {CAUSE_TYPE_LABELS[item.causeType] ?? item.causeType}
                      </p>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                        {item.count} caso(s)
                      </p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                  Ainda nao ha causas confirmadas registradas.
                </div>
              )}
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

            <div className="mt-5 space-y-3">
              {stats.byModel.length ? (
                stats.byModel.map((item) => (
                  <article
                    key={`${item.manufacturer}-${item.model}`}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {item.model}
                        </p>
                        <p className="text-xs text-[var(--muted)]">{item.manufacturer}</p>
                      </div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                        {item.caseCount} caso(s)
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Tempo medio: {formatMinutes(item.averageResolutionMinutes)}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                  Ainda nao ha modelos com casos resolvidos suficientes.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Componentes recorrentes
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Componentes mais falhos
            </h3>

            <div className="mt-5 space-y-3">
              {stats.recurringComponents.length ? (
                stats.recurringComponents.map((item) => (
                  <article
                    key={item.componentRef}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {item.componentRef}
                        </p>
                        <p className="text-xs text-[var(--muted)]">{item.componentType}</p>
                      </div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                        {item.occurrences}x
                      </p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                  Ainda nao ha componentes vinculados a causas confirmadas.
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
