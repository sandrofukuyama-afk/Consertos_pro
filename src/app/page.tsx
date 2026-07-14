import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { DashboardEmptyState } from "@/components/dashboard-empty-state";
import { StatusPill } from "@/components/status-pill";
import { requireCurrentUser } from "@/lib/auth";
import { hypotheses, timeline } from "@/lib/mock-data";
import { getDashboardData } from "@/lib/services/dashboard";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

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
  const supabaseReady = isSupabaseConfigured();
  const { url } = getSupabaseEnv();

  return (
    <AppShell
      title="Diagnósticos em andamento"
      description="Aqui você acompanha os casos abertos, o próximo teste e o histórico do que já foi feito."
      user={user}
    >
      <div className="grid gap-4">
        {params.message ? (
          <section className="rounded-[26px] border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] p-5 text-sm text-[var(--accent-teal)] shadow-[0_14px_32px_rgba(72,62,49,0.06)]">
            {params.message}
          </section>
        ) : null}

        <section
          className={`rounded-[26px] border p-5 shadow-[0_14px_32px_rgba(72,62,49,0.06)] ${
            supabaseReady
              ? "border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)]"
              : "border-[rgba(109, 94, 242,0.24)] bg-[rgba(109, 94, 242,0.08)]"
          }`}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Integração Supabase
              </p>
              <h3 className="mt-2 break-words text-xl font-semibold tracking-tight text-[var(--foreground)]">
                {supabaseReady
                  ? "Projeto conectado ao ambiente do Supabase"
                  : "Base conectada ao projeto, aguardando chave publishable"}
              </h3>
              <p className="mt-2 break-words text-sm leading-6 text-[var(--muted)]">
                URL configurada: {url ?? "não definida"}.
                {!supabaseReady &&
                  " Falta preencher NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para ativar auth, queries e storage no app."}
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
                supabaseReady
                  ? "bg-[rgba(45,139,130,0.14)] text-[var(--accent-teal)]"
                  : "bg-[rgba(109, 94, 242,0.14)] text-[var(--accent-copper)]"
              }`}
            >
              {supabaseReady ? "Configurado" : "Pendente"}
            </span>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          {dashboard.kpis.map((item) => (
            <article
              key={item.label}
              className="rounded-[26px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-5 shadow-[0_14px_32px_rgba(72,62,49,0.06)]"
            >
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                {item.label}
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <span className="font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-tight text-[var(--foreground)]">
                  {item.value}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.tone === "teal"
                      ? "bg-[rgba(45,139,130,0.14)] text-[var(--accent-teal)]"
                      : item.tone === "copper"
                        ? "bg-[rgba(109, 94, 242,0.14)] text-[var(--accent-copper)]"
                        : "bg-[rgba(216,166,84,0.18)] text-[var(--accent-amber)]"
                  }`}
                >
                  {item.change}
                </span>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.95fr)]">
          <article className="self-start rounded-[30px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-5 shadow-[0_18px_44px_rgba(72,62,49,0.06)]">
            <div className="flex flex-col gap-2 border-b border-[var(--panel-border)] pb-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Central de casos
                </p>
                <h3 className="mt-2 break-words font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                  Lista ativa da bancada
                </h3>
              </div>
              <p className="max-w-md break-words text-sm leading-6 text-[var(--muted)]">
                Lista pronta para receber filtros, busca e mais detalhes dos casos.
              </p>
            </div>

            {dashboard.diagnostics.length ? (
              <div className="mt-5 overflow-hidden rounded-[24px] border border-[var(--panel-border)]">
                <div className="hidden md:grid grid-cols-[0.8fr_1.4fr_1.2fr_1.1fr_1fr] gap-3 bg-[var(--background-strong)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  <span>Equipamento</span>
                  <span>Defeito atual</span>
                  <span>Placa</span>
                  <span>Técnico</span>
                  <span>Status</span>
                </div>
                {dashboard.diagnostics.map((diagnostic) => (
                  <Link
                    key={diagnostic.id}
                    href={`/diagnosticos/${diagnostic.recordId}`}
                    className="flex flex-col gap-3 border-t border-[var(--panel-border)] px-4 py-4 transition hover:bg-white/2 md:grid md:grid-cols-[0.8fr_1.4fr_1.2fr_1.1fr_1fr]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center justify-between md:block">
                        <p className="break-words text-sm font-semibold text-[var(--foreground)]">
                          {diagnostic.category}
                        </p>
                        <div className="md:hidden">
                          <StatusPill label={diagnostic.status} />
                        </div>
                      </div>
                      <p className="mt-1 break-words text-sm text-[var(--muted)]">
                        {diagnostic.equipment}
                      </p>
                      <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                        {diagnostic.id}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-[var(--foreground)]">
                        <span className="mr-1 text-xs font-mono uppercase tracking-[0.1em] text-[var(--muted)] md:hidden">
                          Sintoma:
                        </span>
                        {diagnostic.symptom}
                      </p>
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        Atualizado {diagnostic.updatedAt}
                      </p>
                    </div>
                    <p className="min-w-0 break-words text-sm leading-6 text-[var(--foreground)]">
                      <span className="mr-1 text-xs font-mono uppercase tracking-[0.1em] text-[var(--muted)] md:hidden">
                        Placa:
                      </span>
                      {diagnostic.board}
                    </p>
                    <p className="min-w-0 break-words text-sm leading-6 text-[var(--foreground)]">
                      <span className="mr-1 text-xs font-mono uppercase tracking-[0.1em] text-[var(--muted)] md:hidden">
                        Técnico:
                      </span>
                      {diagnostic.technician}
                    </p>
                    <div className="hidden items-start md:flex">
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
          </article>

          <div className="grid min-w-0 gap-4">
            <article className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--panel)] p-5 text-white shadow-[0_20px_52px_rgba(29,36,36,0.18)]">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
                Próximo passo sugerido
              </p>
              <h3 className="mt-3 break-words font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
                Isolar a linha LCD_VDD antes de regravar BIOS
              </h3>
              <p className="mt-3 break-words text-sm leading-7 text-[rgba(255,245,236,0.76)]">
                A ideia aqui é mostrar um teste por vez. Esta área exibe a sugestão da IA com um motivo simples para ajudar na decisão.
              </p>
              <div className="mt-5 break-words rounded-[22px] border border-white/10 bg-white/6 p-4 text-sm leading-6 text-[rgba(255,245,236,0.84)]">
                Justificativa: há medição estável de 19V, consumo inicial coerente e histórico recente de casos semelhantes com falha no circuito de imagem. A regravação agora teria custo maior e menor poder de isolamento.
              </div>
            </article>

            <article className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Linha do tempo do caso
              </p>
              <div className="mt-4 space-y-4">
                {timeline.map((item) => (
                  <div
                    key={`${item.time}-${item.title}`}
                    className="grid gap-3 sm:grid-cols-[72px_minmax(0,1fr)]"
                  >
                    <div className="inline-flex w-fit min-w-[72px] items-center justify-center rounded-2xl bg-[var(--background-strong)] px-3 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                      {item.time}
                    </div>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-[var(--foreground)]">
                        {item.title}
                      </p>
                      <p className="mt-1 break-words text-sm leading-6 text-[var(--muted)]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Hipóteses em aberto
              </p>
              <div className="mt-4 space-y-3">
                {hypotheses.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-[var(--foreground)]">
                          {item.title}
                        </p>
                        <p className="mt-2 break-words text-sm leading-6 text-[var(--muted)]">
                          Evidência: {item.evidence}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                          Confiança {item.confidence}
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
          <article className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Biblioteca técnica
                </p>
                <h3 className="mt-2 break-words font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                  Documentos recentes
                </h3>
              </div>
              <p className="break-words text-sm text-[var(--muted)]">
                PDFs, esquemas, mapas e firmwares
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {dashboard.documents.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--accent-teal)]">
                    {item.type}
                  </p>
                  <h4 className="mt-3 break-words text-lg font-semibold tracking-tight text-[var(--foreground)]">
                    {item.title}
                  </h4>
                  <p className="mt-2 break-words text-sm leading-6 text-[var(--muted)]">
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
            <h3 className="mt-3 break-words font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
              Casos que viraram referência
            </h3>
            <div className="mt-4 space-y-3">
              {dashboard.knowledgeItems.map((item) => (
                <div
                  key={item.cause}
                  className="rounded-[22px] border border-white/10 bg-white/6 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="min-w-0 break-words text-sm font-semibold leading-6 text-white">
                      {item.cause}
                    </p>
                    <span className="shrink-0 rounded-full bg-[rgba(216,166,84,0.16)] px-3 py-1 text-xs font-semibold text-[var(--accent-amber)]">
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
