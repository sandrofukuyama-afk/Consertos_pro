import { reviewResolvedCaseAction, syncSemanticMemoryAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { SyncButton } from "@/components/sync-button";
import { requireCurrentUser } from "@/lib/auth";
import { getKnowledgeOverviewData } from "@/lib/services/semantic";
import { createClient } from "@/lib/supabase/server";
import { formatProviderLabel } from "@/lib/utils";

type ConhecimentoPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function ConhecimentoPage({
  searchParams,
}: ConhecimentoPageProps) {
  const userPromise = requireCurrentUser();
  const overviewPromise = getKnowledgeOverviewData();
  const [user, overview] = await Promise.all([userPromise, overviewPromise]);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("technician_profiles")
    .select("is_reviewer")
    .eq("user_id", user.id)
    .maybeSingle();
  const isReviewer = profile?.is_reviewer ?? false;

  const params = await searchParams;

  return (
    <AppShell
      title="Base de conhecimento"
      description="Aqui ficam os casos resolvidos, os aprendizados da oficina e os dados usados na busca."
      user={user}
    >
      <div className="grid gap-4">
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

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_420px]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6 shadow-[0_18px_44px_rgba(20,18,28,0.06)]">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Busca do sistema
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Dados usados na busca
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              O app já consegue ler resumos de diagnósticos, casos resolvidos e documentos técnicos para achar itens parecidos.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                {
                  label: "Fontes indexadas",
                  value: String(overview.sourceCount),
                },
                {
                  label: "Registros indexados",
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
                {formatProviderLabel(overview.provider)}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                    {overview.externalProviderConfigured
                  ? "IA externa ligada para deixar a busca mais precisa."
                  : "Modo local ativo. Tudo continua funcionando mesmo sem IA externa."}
              </p>
            </div>
          </article>

          <aside className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-white">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(230,228,245,0.56)]">
              Sincronização
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight">
              Atualizar dados da busca
            </h3>
            <p className="mt-3 text-sm leading-6 text-[rgba(230,228,245,0.76)]">
              Atualiza documentos, diagnósticos e casos resolvidos para a busca usar os dados mais recentes.
            </p>
            <form action={syncSemanticMemoryAction} className="mt-5">
              <SyncButton />
            </form>
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Aprendizado da IA
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Feedback e adoção das sugestões
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Esse painel começa a mostrar se as recomendações estão sendo seguidas e como os técnicos percebem a utilidade delas.
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
                  label: "Sugestões seguidas",
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
                  label: "Não ajudou",
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

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
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
                      <div className="min-w-0">
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                          {item.rating.replaceAll("_", " ")}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[var(--foreground)] break-words">
                          {item.submittedBy}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-[var(--muted)]">{item.createdAt}</p>
                    </div>
                    <p className="mt-3 text-sm text-[var(--foreground)]">
                      {item.wasFollowed === true
                        ? "A sugestão foi seguida na bancada."
                        : item.wasFollowed === false
                          ? "A sugestão não foi seguida."
                          : "Sem confirmação se a sugestão foi seguida."}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {item.note || "Sem observação adicional."}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                  Ainda não há feedback suficiente para medir a utilidade das recomendações.
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Desempenho por categoria
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Onde a IA está ajudando mais
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
                      <p>Aceitação: {item.acceptanceRate}%</p>
                      <p>Helpful: {item.helpfulRate}%</p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)] md:col-span-2">
                  Ainda não há feedback suficiente para comparar categorias.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Testes mais seguidos
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Sugestões com mais adoção
            </h3>

            <div className="mt-5 space-y-3">
              {overview.topFollowedTests.length ? (
                overview.topFollowedTests.map((item) => (
                  <article
                    key={item.testName}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-semibold text-[var(--foreground)]">
                        {item.testName}
                      </p>
                      <p className="shrink-0 font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                        {item.count} usos
                      </p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                  Ainda não há testes sugeridos com execução registrada.
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Tendência temporal
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
                    <p>Aceitação: {item.acceptanceRate}%</p>
                    <p>Helpful: {item.helpfulRate}%</p>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)] md:col-span-2 xl:col-span-4">
                Ainda não há semanas com feedback suficiente para mostrar tendência.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Casos resolvidos recentes
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.recentResolvedCases.length ? (
              overview.recentResolvedCases.map((item) => {
                const isPromoted = !!item.knowledgePromotedAt;
                const isReviewed = !!item.reviewedAt;

                return (
                  <article
                    key={item.id}
                    className="flex flex-col justify-between rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-5 text-white"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                          {item.status}
                        </span>
                        {isPromoted ? (
                          <span className="rounded-full bg-[rgba(62,158,114,0.14)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--success)] uppercase">
                            ✓ Promovido
                          </span>
                        ) : isReviewed ? (
                          <span className="rounded-full bg-[rgba(202,106,85,0.14)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--danger)] uppercase">
                            Revisado
                          </span>
                        ) : (
                          <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-[rgba(230,228,245,0.5)] uppercase">
                            Pendente
                          </span>
                        )}
                      </div>

                      <h4 className="mt-3 text-base font-semibold text-white tracking-tight">
                        {item.label}
                      </h4>
                      <p className="mt-2 text-sm leading-relaxed text-[rgba(230,228,245,0.8)]">
                        {item.summary}
                      </p>
                      <p className="mt-3 text-[10px] text-[var(--muted)]">{item.createdAt}</p>
                    </div>

                    {/* Formulário de Auditoria para Revisores Técnicos se o caso estiver pendente */}
                    {!isReviewed && isReviewer && (
                      <div className="mt-4 border-t border-white/5 pt-4">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent-teal)]">
                          Painel do Revisor Técnico
                        </p>
                        <form action={reviewResolvedCaseAction} className="mt-2.5 grid gap-2">
                          <input type="hidden" name="resolved_case_id" value={item.id} />
                          <textarea
                            name="review_notes"
                            rows={2}
                            placeholder="Notas de auditoria do caso..."
                            className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-1.5 text-xs text-white outline-none focus:border-[var(--accent-teal)]"
                          />
                          <div className="flex gap-2">
                            <select
                              required
                              name="review_status"
                              className="flex-1 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none"
                              defaultValue="approved"
                            >
                              <option value="approved">Aprovar & Promover</option>
                              <option value="rejected">Rejeitar Caso</option>
                            </select>
                            <button
                              type="submit"
                              className="rounded-full bg-[var(--accent-teal)] px-4 py-1.5 text-xs font-semibold text-white hover:brightness-110 active:scale-98 transition-all"
                            >
                              Salvar
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)] md:col-span-2 xl:col-span-3">
                Ainda não há casos resolvidos suficientes para encher esta base.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
