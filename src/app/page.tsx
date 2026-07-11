import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import {
  activeDiagnostics,
  documents,
  hypotheses,
  kpis,
  knowledgeItems,
  timeline,
} from "@/lib/mock-data";

export default function Home() {
  return (
    <AppShell
      title="Diagnosticos em andamento"
      description="Primeira central operacional do ConsertosPro. Esta base ja organiza casos ativos, proximo passo sugerido, timeline tecnica, hipoteses e memoria confirmada seguindo o escopo do MVP."
    >
      <div className="grid gap-4">
        <section className="grid gap-4 xl:grid-cols-3">
          {kpis.map((item) => (
            <article
              key={item.label}
              className="rounded-[26px] border border-[var(--panel-border)] bg-white/82 p-5 shadow-[0_14px_32px_rgba(72,62,49,0.06)]"
            >
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                {item.label}
              </p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <span className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-tight text-[var(--foreground)]">
                  {item.value}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.tone === "teal"
                      ? "bg-[rgba(45,139,130,0.14)] text-[var(--accent-teal)]"
                      : item.tone === "copper"
                        ? "bg-[rgba(184,109,60,0.14)] text-[var(--accent-copper)]"
                        : "bg-[rgba(216,166,84,0.18)] text-[#966a1f]"
                  }`}
                >
                  {item.change}
                </span>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.95fr)]">
          <article className="self-start rounded-[30px] border border-[var(--panel-border)] bg-white/85 p-5 shadow-[0_18px_44px_rgba(72,62,49,0.06)]">
            <div className="flex flex-col gap-2 border-b border-[var(--panel-border)] pb-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Central de casos
                </p>
                <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                  Lista ativa da bancada
                </h3>
              </div>
              <p className="max-w-md text-sm leading-6 text-[var(--muted)]">
                Estrutura pensada para depois receber busca, filtros, responsavel e persistencia real.
              </p>
            </div>

            <div className="mt-5 overflow-hidden rounded-[24px] border border-[var(--panel-border)]">
              <div className="grid grid-cols-[0.8fr_1.4fr_1.2fr_1.1fr_1fr] gap-3 bg-[var(--background-strong)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                <span>Equipamento</span>
                <span>Defeito atual</span>
                <span>Placa</span>
                <span>Tecnico</span>
                <span>Status</span>
              </div>
              {activeDiagnostics.map((diagnostic) => (
                <div
                  key={diagnostic.id}
                  className="grid grid-cols-1 gap-3 border-t border-[var(--panel-border)] px-4 py-4 md:grid-cols-[0.8fr_1.4fr_1.2fr_1.1fr_1fr]"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {diagnostic.category}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {diagnostic.equipment}
                    </p>
                    <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                      {diagnostic.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {diagnostic.symptom}
                    </p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Atualizado {diagnostic.updatedAt}
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-[var(--foreground)]">
                    {diagnostic.board}
                  </p>
                  <p className="text-sm leading-6 text-[var(--foreground)]">
                    {diagnostic.technician}
                  </p>
                  <div className="flex items-start">
                    <StatusPill label={diagnostic.status} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-4">
            <article className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--panel)] p-5 text-white shadow-[0_20px_52px_rgba(29,36,36,0.18)]">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
                Proximo passo sugerido
              </p>
              <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
                Isolar a linha LCD_VDD antes de regravar BIOS
              </h3>
              <p className="mt-3 text-sm leading-7 text-[rgba(255,245,236,0.76)]">
                O plano do produto pede um teste por vez e resposta baseada em evidencia. Esta area ja simula o lugar onde a IA vai justificar o melhor proximo teste quando a camada de contexto estiver pronta.
              </p>
              <div className="mt-5 rounded-[22px] border border-white/10 bg-white/6 p-4 text-sm leading-6 text-[rgba(255,245,236,0.84)]">
                Justificativa: ha medicao estavel de 19V, consumo inicial coerente e historico recente de casos semelhantes com falha no circuito de imagem. A regravacao agora teria custo maior e menor poder de isolamento.
              </div>
            </article>

            <article className="rounded-[30px] border border-[var(--panel-border)] bg-white/82 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Linha do tempo do caso
              </p>
              <div className="mt-4 space-y-4">
                {timeline.map((item) => (
                  <div
                    key={`${item.time}-${item.title}`}
                    className="grid grid-cols-[56px_1fr] gap-3"
                  >
                    <div className="rounded-2xl bg-[var(--background-strong)] px-3 py-2 text-center font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                      {item.time}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[30px] border border-[var(--panel-border)] bg-white/82 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Hipoteses em aberto
              </p>
              <div className="mt-4 space-y-3">
                {hypotheses.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {item.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          Evidencia: {item.evidence}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                          Confianca {item.confidence}
                        </span>
                        <StatusPill label={item.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <article className="rounded-[30px] border border-[var(--panel-border)] bg-white/82 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Biblioteca tecnica
                </p>
                <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                  Documentos recentes
                </h3>
              </div>
              <p className="text-sm text-[var(--muted)]">PDFs, esquemas, mapas e firmwares</p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {documents.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--accent-teal)]">
                    {item.type}
                  </p>
                  <h4 className="mt-3 text-lg font-semibold tracking-tight text-[var(--foreground)]">
                    {item.title}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Vinculado a {item.relation}
                  </p>
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--panel)] p-5 text-white">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
              Causas confirmadas
            </p>
            <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
              Memoria forte da bancada
            </h3>
            <div className="mt-4 space-y-3">
              {knowledgeItems.map((item) => (
                <div
                  key={item.cause}
                  className="rounded-[22px] border border-white/10 bg-white/6 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-semibold leading-6 text-white">
                      {item.cause}
                    </p>
                    <span className="rounded-full bg-[rgba(216,166,84,0.16)] px-3 py-1 text-xs font-semibold text-[var(--accent-amber)]">
                      {item.incidence}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[rgba(255,245,236,0.74)]">
                    {item.note}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
