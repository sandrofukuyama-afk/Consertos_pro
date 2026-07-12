import { syncSemanticMemoryAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/auth";
import { getKnowledgeOverviewData } from "@/lib/services/semantic";

type ConhecimentoPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function ConhecimentoPage({
  searchParams,
}: ConhecimentoPageProps) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const overview = await getKnowledgeOverviewData();

  return (
    <AppShell
      title="Conhecimento consolidado"
      description="Centro da memoria tecnica reutilizavel da oficina, agora com base vetorial para casos semelhantes e documentos mais proximos do contexto buscado."
      user={user}
    >
      <div className="grid gap-4">
        {params.message ? (
          <section className="rounded-[26px] border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] p-5 text-sm text-[var(--accent-teal)] shadow-[0_14px_32px_rgba(72,62,49,0.06)]">
            {params.message}
          </section>
        ) : null}

        {params.error ? (
          <section className="rounded-[26px] border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] p-5 text-sm text-[var(--danger)] shadow-[0_14px_32px_rgba(72,62,49,0.06)]">
            {params.error}
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_420px]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6 shadow-[0_18px_44px_rgba(72,62,49,0.06)]">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Infraestrutura semantica
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Vetores e fontes da memoria
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              O app agora ja consegue indexar resumos de diagnosticos, casos resolvidos e documentos tecnicos para recuperar contexto semelhante na busca.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                {
                  label: "Fontes semanticas",
                  value: String(overview.sourceCount),
                },
                {
                  label: "Embeddings salvos",
                  value: String(overview.embeddingCount),
                },
                {
                  label: "Docs pendentes",
                  value: String(overview.pendingDocumentCount),
                },
              ].map((item) => (
                <article
                  key={item.label}
                  className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {item.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                    {item.value}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-teal)]">
                Provedor atual
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {overview.provider}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {overview.externalProviderConfigured
                  ? "Embeddings externos ativos para melhorar similaridade semantica."
                  : "Modo local ativo para manter a fase funcionando agora, com caminho aberto para trocar por embeddings externos depois."}
              </p>
            </div>
          </article>

          <aside className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-white">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
              Sincronizacao
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight">
              Atualizar memoria vetorial
            </h3>
            <p className="mt-3 text-sm leading-6 text-[rgba(255,245,236,0.76)]">
              Reprocessa documentos, diagnosticos e casos resolvidos para manter a busca semantica alinhada com o estado atual da base.
            </p>
            <form action={syncSemanticMemoryAction} className="mt-5">
              <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
                Sincronizar agora
              </button>
            </form>
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Aprendizado da IA
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Feedback e adocao das sugestoes
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Esse painel comeca a mostrar se as recomendacoes estao sendo seguidas e como os tecnicos percebem a utilidade delas.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                {
                  label: "Respostas IA",
                  value: String(overview.aiMetrics.totalResponses),
                },
                {
                  label: "Feedbacks",
                  value: String(overview.aiMetrics.feedbackCount),
                },
                {
                  label: "Sugestoes seguidas",
                  value: String(overview.aiMetrics.followedCount),
                },
              ].map((item) => (
                <article
                  key={item.label}
                  className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {item.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                    {item.value}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                {
                  label: "Helpful",
                  value: String(overview.aiMetrics.helpfulCount),
                },
                {
                  label: "Parcial",
                  value: String(overview.aiMetrics.partiallyHelpfulCount),
                },
                {
                  label: "Nao ajudou",
                  value: String(overview.aiMetrics.notHelpfulCount),
                },
              ].map((item) => (
                <article
                  key={item.label}
                  className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {item.label}
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                    {item.value}
                  </p>
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Feedback recente
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Retorno da bancada
            </h3>

            <div className="mt-5 space-y-3">
              {overview.recentAiFeedback.length ? (
                overview.recentAiFeedback.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                          {item.rating.replaceAll("_", " ")}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                          {item.submittedBy}
                        </p>
                      </div>
                      <p className="text-xs text-[var(--muted)]">{item.createdAt}</p>
                    </div>
                    <p className="mt-3 text-sm text-[var(--foreground)]">
                      {item.wasFollowed === true
                        ? "A sugestao foi seguida na bancada."
                        : item.wasFollowed === false
                          ? "A sugestao nao foi seguida."
                          : "Sem confirmacao se a sugestao foi seguida."}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {item.note || "Sem observacao adicional."}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                  Ainda nao ha feedback suficiente para medir a utilidade das recomendacoes.
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Desempenho por categoria
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Onde a IA esta ajudando mais
            </h3>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {overview.aiCategoryBreakdown.length ? (
                overview.aiCategoryBreakdown.map((item) => (
                  <article
                    key={item.category}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {item.category}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-sm text-[var(--muted)]">
                      <p>Feedbacks: {item.feedbackCount}</p>
                      <p>Helpful: {item.helpfulCount}</p>
                      <p>Seguidas: {item.followedCount}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm font-semibold text-[var(--accent-teal)]">
                      <p>Aceitacao: {item.acceptanceRate}%</p>
                      <p>Helpful: {item.helpfulRate}%</p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)] md:col-span-2">
                  Ainda nao ha feedback suficiente para comparar categorias.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Testes mais seguidos
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Sugestoes com mais adocao
            </h3>

            <div className="mt-5 space-y-3">
              {overview.topFollowedTests.length ? (
                overview.topFollowedTests.map((item) => (
                  <article
                    key={item.testName}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {item.testName}
                      </p>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                        {item.count} usos
                      </p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                  Ainda nao ha testes sugeridos com execucao registrada.
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Tendencia temporal
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Feedback por semana
          </h3>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {overview.aiFeedbackTrend.length ? (
              overview.aiFeedbackTrend.map((item) => (
                <article
                  key={item.weekLabel}
                  className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {item.weekLabel}
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Feedbacks: {item.feedbackCount}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-semibold text-[var(--accent-teal)]">
                    <p>Aceitacao: {item.acceptanceRate}%</p>
                    <p>Helpful: {item.helpfulRate}%</p>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)] md:col-span-2 xl:col-span-4">
                Ainda nao ha semanas com feedback suficiente para mostrar tendencia.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Casos resolvidos recentes
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.recentResolvedCases.length ? (
              overview.recentResolvedCases.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                    {item.status}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                    {item.label}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    {item.summary}
                  </p>
                  <p className="mt-3 text-xs text-[var(--muted)]">{item.createdAt}</p>
                </article>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)] md:col-span-2 xl:col-span-3">
                Ainda nao ha casos resolvidos suficientes para alimentar a memoria consolidada.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
