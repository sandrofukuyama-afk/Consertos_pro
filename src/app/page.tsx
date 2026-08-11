import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { DashboardEmptyState } from "@/components/dashboard-empty-state";
import { StatusPill } from "@/components/status-pill";
import { requireCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/services/dashboard";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

type HomePageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

const quickLinks = [
  {
    href: "/diagnosticos/novo",
    label: "Abrir diagnóstico",
    description: "Registrar um novo equipamento na bancada.",
  },
  {
    href: "/busca",
    label: "Buscar histórico",
    description: "Localizar casos, sintomas e referências técnicas.",
  },
  {
    href: "/biblioteca",
    label: "Ir para biblioteca",
    description: "Consultar documentos, firmwares e esquemas já cadastrados.",
  },
];

export default async function Home({ searchParams }: HomePageProps) {
  const userPromise = requireCurrentUser();
  const dashboardPromise = getDashboardData();
  const [user, dashboard] = await Promise.all([userPromise, dashboardPromise]);

  const params = await searchParams;
  const supabaseReady = isSupabaseConfigured();
  const { url } = getSupabaseEnv();

  const highlightedCase = dashboard.diagnostics[0] ?? null;
  const totalTrackedCases = dashboard.kpis.reduce(
    (sum, item) => sum + Number(item.value || 0),
    0,
  );
  const openCases = dashboard.kpis
    .filter((item) => item.label !== "Resolvidos hoje")
    .reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <AppShell
      title="Painel da bancada"
      description="Acompanhe a fila real de diagnósticos, as referências recém-cadastradas e o conhecimento técnico confirmado."
      user={user}
    >
      <div className="grid gap-4 lg:gap-5">
        {params.message ? (
          <section className="rounded-[26px] border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] p-5 text-sm text-[var(--accent-teal)] shadow-[0_14px_32px_rgba(20,18,28,0.06)]">
            {params.message}
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <article className="overflow-hidden rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] shadow-[0_18px_44px_rgba(20,18,28,0.06)]">
            <div className="relative h-full">
              <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-br from-[rgba(45,139,130,0.12)] via-[rgba(216,166,84,0.1)] to-transparent" />
              <div className="relative flex h-full flex-col gap-6 p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                      Operação ao vivo
                    </p>
                    <h2 className="mt-3 max-w-3xl font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
                      Visão central da oficina para começar o dia sem perder contexto.
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-[15px]">
                      {dashboard.hasLiveData
                        ? `Há ${openCases} itens abertos na bancada e ${dashboard.kpis.find((item) => item.label === "Resolvidos hoje")?.value ?? "0"} encerramentos no fluxo atual. A tela inicial agora prioriza a fila real, o último caso movimentado e as referências técnicas recém-confirmadas.`
                        : "Ainda não há movimentação suficiente para preencher o painel. Assim que os primeiros diagnósticos, documentos e causas forem cadastrados, esta tela passa a refletir o estado real da oficina."}
                    </p>
                  </div>

                  <div className="grid gap-2 sm:min-w-[220px]">
                    <div className="rounded-[24px] border border-[rgba(45,139,130,0.16)] bg-[rgba(45,139,130,0.08)] px-4 py-3">
                      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
                        Casos monitorados
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                        {totalTrackedCases}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-[rgba(109,94,242,0.16)] bg-[rgba(109,94,242,0.08)] px-4 py-3">
                      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
                        Fontes técnicas
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                        {dashboard.documents.length + dashboard.knowledgeItems.length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {quickLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-4 transition hover:-translate-y-0.5 hover:border-[rgba(216,166,84,0.28)] hover:shadow-[0_16px_34px_rgba(20,18,28,0.08)]"
                    >
                      <p className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {item.description}
                      </p>
                      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                        Abrir
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article
            className={`rounded-[28px] border p-5 shadow-[0_18px_44px_rgba(20,18,28,0.06)] sm:p-6 ${
              supabaseReady
                ? "border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)]"
                : "border-[rgba(109,94,242,0.24)] bg-[rgba(109,94,242,0.08)]"
            }`}
          >
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Ambiente de dados
            </p>
            <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              {supabaseReady ? "Base pronta para operar" : "Conexão parcial com Supabase"}
            </h3>
            <p className="mt-3 break-words text-sm leading-7 text-[var(--muted)]">
              URL configurada: {url ?? "não definida"}.
              {!supabaseReady
                ? " Ainda falta a NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para ativar auth, queries e storage no app."
                : " O aplicativo já consegue usar autenticação, consultas e armazenamento conforme o ambiente atual."}
            </p>

            <div className="mt-5 grid gap-3">
              <div className="rounded-[22px] border border-white/10 bg-white/35 p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  Última movimentação
                </p>
                {highlightedCase ? (
                  <>
                    <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {highlightedCase.equipment}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                          {highlightedCase.symptom}
                        </p>
                      </div>
                      <StatusPill label={highlightedCase.status} />
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--accent-copper)]">
                      {highlightedCase.id} • {highlightedCase.updatedAt}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    Nenhum caso movimentado ainda.
                  </p>
                )}
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/35 p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  Cobertura atual
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  {dashboard.kpis.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{item.label}</p>
                        <p className="text-xs leading-5 text-[var(--muted)]">{item.change}</p>
                      </div>
                      <span className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

          <article className="rounded-[26px] border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-white shadow-[0_18px_44px_rgba(20,18,28,0.16)] sm:p-5">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(230,228,245,0.56)]">
              Base de apoio
            </p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <span className="font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight sm:text-5xl">
                {dashboard.documents.length + dashboard.knowledgeItems.length}
              </span>
              <span className="rounded-full bg-[rgba(216,166,84,0.16)] px-3 py-1 text-xs font-semibold text-[var(--accent-amber)]">
                referências disponíveis
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[rgba(230,228,245,0.76)]">
              Soma dos documentos recentes e das causas confirmadas já prontas para consulta interna.
            </p>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
          <article className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 shadow-[0_18px_44px_rgba(20,18,28,0.06)] sm:p-5">
            <div className="flex flex-col gap-2 border-b border-[var(--panel-border)] pb-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Central de casos
                </p>
                <h3 className="mt-2 break-words font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                  Fila ativa da bancada
                </h3>
              </div>
              <p className="max-w-lg text-sm leading-6 text-[var(--muted)]">
                Os registros abaixo refletem os casos reais mais recentemente atualizados no sistema.
              </p>
            </div>

            {dashboard.diagnostics.length ? (
              <div className="mt-4 overflow-hidden rounded-[24px] border border-[var(--panel-border)]">
                <div className="hidden grid-cols-[0.9fr_1.35fr_1.05fr_1fr_0.9fr] gap-3 bg-[var(--background-strong)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] md:grid">
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
                    className="grid gap-3 border-t border-[var(--panel-border)] p-4 transition hover:bg-white/2 md:grid-cols-[0.9fr_1.35fr_1.05fr_1fr_0.9fr]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3 md:block">
                        <p className="break-words text-sm font-semibold text-[var(--foreground)]">
                          {diagnostic.category}
                        </p>
                        <div className="md:hidden">
                          <StatusPill label={diagnostic.status} />
                        </div>
                      </div>
                      <p className="mt-1 break-words text-sm leading-6 text-[var(--muted)]">
                        {diagnostic.equipment}
                      </p>
                      <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                        {diagnostic.id}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-[var(--muted)] md:hidden">
                        Defeito atual
                      </p>
                      <p className="mt-1 break-words text-sm leading-6 text-[var(--foreground)] md:mt-0">
                        {diagnostic.symptom}
                      </p>
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        Atualizado {diagnostic.updatedAt}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-[var(--muted)] md:hidden">
                        Placa
                      </p>
                      <p className="mt-1 break-words text-sm leading-6 text-[var(--foreground)] md:mt-0">
                        {diagnostic.board}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-mono uppercase tracking-[0.16em] text-[var(--muted)] md:hidden">
                        Técnico
                      </p>
                      <p className="mt-1 break-words text-sm leading-6 text-[var(--foreground)] md:mt-0">
                        {diagnostic.technician}
                      </p>
                    </div>
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

          <div className="grid gap-4">
            <article className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 shadow-[0_18px_44px_rgba(20,18,28,0.06)] sm:p-5">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Resumo da fila
              </p>
              <div className="mt-4 space-y-3">
                {dashboard.kpis.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{item.label}</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{item.change}</p>
                      </div>
                      <p className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                        {item.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-white shadow-[0_20px_52px_rgba(14,13,20,0.18)] sm:p-5">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(230,228,245,0.56)]">
                Estado operacional
              </p>
              <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
                Bancada orientada por dados reais
              </h3>
              <p className="mt-3 text-sm leading-7 text-[rgba(230,228,245,0.76)]">
                A tela inicial agora evita recomendações fictícias e passa a concentrar só a movimentação registrada no sistema, com navegação rápida para abrir casos, consultar histórico e acessar a biblioteca técnica.
              </p>
            </article>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <article className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 shadow-[0_18px_44px_rgba(20,18,28,0.06)] sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Biblioteca técnica
                </p>
                <h3 className="mt-2 break-words font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                  Documentos recentes
                </h3>
              </div>
              <p className="text-sm leading-6 text-[var(--muted)]">
                PDFs, esquemas, mapas e firmwares já cadastrados.
              </p>
            </div>

            {dashboard.documents.length ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {dashboard.documents.map((item) => (
                  <article
                    key={`${item.type}-${item.title}`}
                    className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--accent-teal)]">
                      {item.type}
                    </p>
                    <h4 className="mt-3 break-words text-lg font-semibold tracking-tight text-[var(--foreground)]">
                      {item.title}
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Vinculado a {item.relation}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] p-5 text-sm leading-6 text-[var(--muted)]">
                Ainda não há documentos recentes cadastrados para exibir aqui.
              </div>
            )}
          </article>

          <article className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-white shadow-[0_20px_52px_rgba(14,13,20,0.18)] sm:p-5">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(230,228,245,0.56)]">
              Conhecimento confirmado
            </p>
            <h3 className="mt-3 break-words font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
              Causas validadas pela oficina
            </h3>

            {dashboard.knowledgeItems.length ? (
              <div className="mt-4 space-y-3">
                {dashboard.knowledgeItems.map((item) => (
                  <div
                    key={`${item.incidence}-${item.cause}`}
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
                    <p className="mt-2 text-sm leading-6 text-[rgba(230,228,245,0.74)]">
                      {item.note}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-white/10 bg-white/6 p-5 text-sm leading-6 text-[rgba(230,228,245,0.76)]">
                Ainda não há causas confirmadas recentes para destacar neste painel.
              </div>
            )}
          </article>
        </section>
      </div>
    </AppShell>
  );
}
