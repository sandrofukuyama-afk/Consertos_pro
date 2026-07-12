import Link from "next/link";

import {
  addDiagnosticSymptomAction,
  addDiagnosticTestAction,
  addHypothesisAction,
  addMeasurementAction,
  analyzeAttachmentImageAction,
  generateDiagnosticAssistantAction,
  saveAssistantFeedbackAction,
  uploadAttachmentAction,
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { DiagnosticClosureForm } from "@/components/diagnostic-closure-form";
import { StatusPill } from "@/components/status-pill";
import { requireCurrentUser } from "@/lib/auth";
import {
  getDiagnosticDetail,
  getDiagnosticFormOptions,
} from "@/lib/services/diagnostics";
import { formatProviderLabel } from "@/lib/utils";

type DiagnosticDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    message?: string;
    ai_response_id?: string;
    suggested_test_id?: string;
  }>;
};

export default async function DiagnosticDetailPage({
  params,
  searchParams,
}: DiagnosticDetailPageProps) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const query = await searchParams;
  const suggestedTestId = query.suggested_test_id?.trim() ?? "";
  const requestedByAiResponseId = query.ai_response_id?.trim() ?? "";
  const [detail, options] = await Promise.all([
    getDiagnosticDetail(id),
    getDiagnosticFormOptions(id),
  ]);

  return (
    <AppShell
      title={`Diagnóstico ${detail.label}`}
      description="Veja os detalhes do caso com sintomas, testes, medicoes e anexos."
      user={user}
      actionLabel="Voltar para dashboard"
      actionHref="/"
    >
      <div className="grid gap-4">
        {query.message ? (
          <section className="rounded-[26px] border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] p-5 text-sm text-[var(--accent-teal)] shadow-[0_14px_32px_rgba(72,62,49,0.06)]">
            {query.message}
          </section>
        ) : null}

        {query.error ? (
          <section className="rounded-[26px] border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] p-5 text-sm text-[var(--danger)] shadow-[0_14px_32px_rgba(72,62,49,0.06)]">
            {query.error}
          </section>
        ) : null}

        {detail.preventiveInsight ? (
          <section className="rounded-[26px] border border-[rgba(216,166,84,0.32)] bg-[rgba(216,166,84,0.1)] p-5 shadow-[0_14px_32px_rgba(72,62,49,0.06)]">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-amber)]">
              Recomendação preventiva
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
              {detail.preventiveInsight.occurrences} de {detail.preventiveInsight.totalCases} casos anteriores
              deste modelo tiveram como causa confirmada &quot;{detail.preventiveInsight.causeLabel}&quot;
              {detail.preventiveInsight.componentRef
                ? `, com o componente ${detail.preventiveInsight.componentRef} mais associado`
                : ""}
              . Considere verificar isso preventivamente antes de aprofundar outros testes.
            </p>
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,360px)]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6 shadow-[0_18px_44px_rgba(72,62,49,0.06)]">
            <div className="flex flex-col gap-4 border-b border-[var(--panel-border)] pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Contexto atual
                </p>
                <h3 className="mt-3 break-words font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                  {detail.summary}
                </h3>
                <p className="mt-3 break-words text-sm leading-7 text-[var(--muted)]">
                  Relato inicial: {detail.initialReport}
                </p>
              </div>
              <StatusPill
                label={
                  detail.status === "resolved" || detail.status === "Resolvido"
                    ? "Resolvido hoje"
                    : detail.status === "waiting input" ||
                        detail.status === "waiting_input" ||
                        detail.status === "Aguardando teste"
                      ? "Aguardando teste"
                      : "Ativo"
                }
              />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  Metadados
                </p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--foreground)]">
                  <p>Categoria: {detail.category}</p>
                  <p>Fabricante: {detail.manufacturer}</p>
                  <p>Modelo: {detail.model}</p>
                  <p>Serie: {detail.serialNumber}</p>
                  <p>Prioridade: {detail.priority}</p>
                  <p>Aberto por: {detail.openedBy}</p>
                  <p>Criado: {detail.createdAt}</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  Condição física
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
                  {detail.physicalNotes}
                </p>
                {detail.equipmentDetails.length ? (
                  <div className="mt-4 grid gap-2">
                    {detail.equipmentDetails.map((item) => (
                      <p key={item.label} className="text-sm leading-6 text-[var(--muted)]">
                        {item.label}: {item.value}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </article>

          <aside className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-white">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
              Fluxo guiado · {detail.category}
            </p>
            <h3 className="mt-3 break-words font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
              Sequência sugerida de bancada
            </h3>
            <ol className="mt-4 space-y-3">
              {detail.guidedFlow.map((step) => (
                <li key={step.order} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                      step.done
                        ? "bg-[var(--accent-teal)] text-white"
                        : "border border-[rgba(255,245,236,0.4)] text-[rgba(255,245,236,0.7)]"
                    }`}
                  >
                    {step.done ? "✓" : step.order}
                  </span>
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        step.done ? "text-[rgba(255,245,236,0.6)] line-through" : "text-white"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[rgba(255,245,236,0.7)]">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6 shadow-[0_18px_44px_rgba(72,62,49,0.06)]">
            <div className="flex flex-col gap-4 border-b border-[var(--panel-border)] pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Assistente técnico
                </p>
                <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                  Próximo passo guiado por contexto
                </h3>
                <p className="mt-2 break-words text-sm leading-6 text-[var(--muted)]">
                  Usa o histórico do caso, memória inteligente e documentos relacionados para sugerir um único passo objetivo por vez.
                </p>
              </div>
              <form action={generateDiagnosticAssistantAction}>
                <input type="hidden" name="diagnostic_id" value={detail.id} />
                <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
                  {detail.assistantSnapshot.latestResponse ? "Atualizar recomendação" : "Gerar recomendação"}
                </button>
              </form>
            </div>

            {detail.assistantSnapshot.latestResponse ? (
              <div className="mt-5 grid gap-4">
                <div className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-teal)]">
                        Última leitura registrada
                      </p>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        Motor {formatProviderLabel(detail.assistantSnapshot.provider)} - {detail.assistantSnapshot.latestResponse.createdAt}
                      </p>
                    </div>
                    <StatusPill label={`Confiança ${detail.assistantSnapshot.latestResponse.confidenceScore}`} />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">Resumo técnico</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {detail.assistantSnapshot.latestResponse.structured?.technicalSummary ?? detail.assistantSnapshot.latestResponse.reasoningSummary}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">Hipótese principal</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {detail.assistantSnapshot.latestResponse.structured?.mainHypothesis ?? "Sem hipótese consolidada na última resposta."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[22px] border border-[rgba(184,109,60,0.18)] bg-[var(--card-surface-soft)] p-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">Próximo teste recomendado</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                      {detail.assistantSnapshot.latestResponse.structured?.nextTest ?? detail.assistantSnapshot.latestResponse.recommendedNextStep}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {detail.assistantSnapshot.latestResponse.structured?.validationGoal ?? "Sem objetivo de validação detalhado."}
                    </p>
                    {detail.assistantSnapshot.latestResponse.structured?.categoryStrategy ? (
                      <p className="mt-3 text-sm text-[var(--muted)]">
                        Estratégia da categoria: {detail.assistantSnapshot.latestResponse.structured.categoryStrategy}
                      </p>
                    ) : null}
                    {detail.assistantSnapshot.latestResponse.structured?.recommendedTestId ? (
                      <Link
                        href={`/diagnosticos/${detail.id}?ai_response_id=${detail.assistantSnapshot.latestResponse.id}&suggested_test_id=${detail.assistantSnapshot.latestResponse.structured.recommendedTestId}#registrar-teste`}
                        className="mt-4 inline-flex rounded-full border border-[rgba(184,109,60,0.24)] bg-[var(--card-surface)] px-4 py-2 text-sm font-semibold text-[var(--accent-copper)]"
                      >
                        Usar sugestão no formulário
                      </Link>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">Evidências consideradas</p>
                      <div className="mt-2 space-y-2">
                        {(detail.assistantSnapshot.latestResponse.structured?.evidence ?? []).length ? (
                          (detail.assistantSnapshot.latestResponse.structured?.evidence ?? []).map((item) => (
                            <p
                              key={item}
                              className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface-soft)] px-3 py-2 text-sm text-[var(--muted)]"
                            >
                              {item}
                            </p>
                          ))
                        ) : (
                          <p className="text-sm text-[var(--muted)]">Nenhuma evidência estruturada foi salva na última rodada.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">Observação de segurança</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {detail.assistantSnapshot.latestResponse.structured?.safetyNote ?? "Sem observação de segurança registrada."}
                      </p>
                      <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">Modo atual</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {detail.assistantSnapshot.externalProviderConfigured
                          ? "IA externa ativa para recuperar memória com mais precisão."
                          : "Modo local ativo para manter a recomendação auditável mesmo sem provedor externo configurado."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[22px] border border-[var(--panel-border)] bg-[var(--card-surface-soft)] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          Feedback do técnico
                        </p>
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          Salve se a recomendação ajudou e se ela foi seguida de fato na bancada.
                        </p>
                      </div>
                      {detail.assistantSnapshot.latestResponse.feedback ? (
                        <StatusPill
                          label={detail.assistantSnapshot.latestResponse.feedback.rating.replaceAll("_", " ")}
                        />
                      ) : null}
                    </div>

                    {detail.assistantSnapshot.latestResponse.feedback ? (
                      <div className="mt-4 rounded-[18px] border border-[var(--panel-border)] bg-[var(--background)] p-4 text-sm text-[var(--foreground)]">
                        <p>
                          Último feedback: {detail.assistantSnapshot.latestResponse.feedback.submittedBy} • {detail.assistantSnapshot.latestResponse.feedback.createdAt}
                        </p>
                        <p className="mt-2 text-[var(--muted)]">
                          {detail.assistantSnapshot.latestResponse.feedback.wasFollowed === true
                            ? "A sugestão foi seguida."
                            : detail.assistantSnapshot.latestResponse.feedback.wasFollowed === false
                              ? "A sugestão não foi seguida."
                              : "Não foi informado se a sugestão foi seguida."}
                        </p>
                        <p className="mt-2 text-[var(--muted)]">
                          {detail.assistantSnapshot.latestResponse.feedback.note || "Sem observação adicional."}
                        </p>
                      </div>
                    ) : null}

                    <form action={saveAssistantFeedbackAction} className="mt-4 grid gap-3">
                      <input type="hidden" name="diagnostic_id" value={detail.id} />
                      <input
                        type="hidden"
                        name="ai_response_id"
                        value={detail.assistantSnapshot.latestResponse.id}
                      />
                      <select
                        name="feedback_rating"
                        required
                        defaultValue={detail.assistantSnapshot.latestResponse.feedback?.rating ?? ""}
                        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
                      >
                        <option value="" disabled>
                          Avaliar utilidade
                        </option>
                        <option value="helpful">Ajudou bem</option>
                        <option value="partially_helpful">Ajudou parcialmente</option>
                        <option value="not_helpful">Não ajudou</option>
                      </select>
                      <select
                        name="was_followed"
                        defaultValue={
                          detail.assistantSnapshot.latestResponse.feedback?.wasFollowed === true
                            ? "yes"
                            : detail.assistantSnapshot.latestResponse.feedback?.wasFollowed === false
                              ? "no"
                              : ""
                        }
                        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
                      >
                        <option value="">Não informar se foi seguida</option>
                        <option value="yes">A sugestão foi seguida</option>
                        <option value="no">A sugestão não foi seguida</option>
                      </select>
                      <textarea
                        name="note"
                        rows={3}
                        defaultValue={detail.assistantSnapshot.latestResponse.feedback?.note ?? ""}
                        placeholder="Observação do técnico sobre a qualidade da recomendação"
                        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
                      />
                      <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
                        Salvar feedback
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-8 text-sm leading-6 text-[var(--muted)]">
                Ainda não existe recomendação salva para este caso. Gere a primeira leitura para registrar resumo técnico, hipótese dominante e próximo teste sugerido em `ai_responses`.
              </div>
            )}
          </article>

          <aside className="grid gap-4">
            <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                    Casos semelhantes
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">
                    Memória recuperada
                  </h3>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {detail.assistantSnapshot.similarCases.length} itens
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {detail.assistantSnapshot.similarCases.length ? (
                  detail.assistantSnapshot.similarCases.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href ?? "#"}
                      className="block rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4 hover:border-[rgba(184,109,60,0.3)]"
                    >
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-teal)]">
                        {item.sourceType} / {item.similarityLabel}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
                      <p className="mt-2 text-xs text-[var(--muted)]">{item.subtitle}</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">{item.excerpt}</p>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-6 text-sm text-[var(--muted)]">
                    A busca inteligente ainda não encontrou casos próximos o bastante para este contexto.
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                    Documentos relacionados
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">
                    Apoio técnico imediato
                  </h3>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {detail.assistantSnapshot.relatedDocuments.length} itens
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {detail.assistantSnapshot.relatedDocuments.length ? (
                  detail.assistantSnapshot.relatedDocuments.map((item) => (
                    <a
                      key={item.id}
                      href={item.href ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4 hover:border-[rgba(184,109,60,0.3)]"
                    >
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-teal)]">
                        {item.sourceType} / {item.similarityLabel}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
                      <p className="mt-2 text-xs text-[var(--muted)]">{item.subtitle}</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">{item.excerpt}</p>
                    </a>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-6 text-sm text-[var(--muted)]">
                    Ainda não há documento técnico recuperado para reforçar a próxima decisão.
                  </div>
                )}
              </div>
            </article>
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Sintomas
                </p>
                <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                  Registro funcional
                </h3>
              </div>
            </div>

            <form action={addDiagnosticSymptomAction} className="mt-5 grid gap-3">
              <input type="hidden" name="diagnostic_id" value={detail.id} />
              <select
                required
                name="symptom_id"
                defaultValue=""
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              >
                <option value="" disabled>
                  Selecionar sintoma
                </option>
                {options.symptoms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name="severity"
                placeholder="Severidade ou contexto"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input type="checkbox" name="is_primary" />
                Sintoma principal
              </label>
              <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
                Adicionar sintoma
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {detail.symptoms.length ? (
                detail.symptoms.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-semibold text-[var(--foreground)]">
                        {item.name}
                      </p>
                      {item.isPrimary ? <StatusPill label="Ativo" /> : null}
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Severidade: {item.severity}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {item.sourceType} • {item.capturedAt}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-5 text-sm text-[var(--muted)]">
                  Nenhum sintoma registrado ainda.
                </p>
              )}
            </div>
          </article>

          <article
            id="registrar-teste"
            className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6"
          >
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Testes
            </p>
            <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Fluxo da investigação
            </h3>
            {requestedByAiResponseId && detail.assistantSnapshot.latestResponse ? (
              <div className="mt-4 rounded-[22px] border border-[rgba(184,109,60,0.24)] bg-[rgba(184,109,60,0.08)] p-4 text-sm text-[var(--foreground)]">
                O formulário está preparado para registrar a sugestão da IA:
                {" "}
                {detail.assistantSnapshot.latestResponse.structured?.recommendedTestName ??
                  detail.assistantSnapshot.latestResponse.structured?.nextTest ??
                  "teste recomendado"}.
              </div>
            ) : null}

            <form action={addDiagnosticTestAction} className="mt-5 grid gap-3">
              <input type="hidden" name="diagnostic_id" value={detail.id} />
              <input
                type="hidden"
                name="requested_by_ai_response_id"
                value={requestedByAiResponseId}
              />
              <select
                required
                name="test_id"
                defaultValue={suggestedTestId || ""}
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              >
                <option value="" disabled>
                  Selecionar teste
                </option>
                {options.tests.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                name="result_status"
                defaultValue="pending"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              >
                <option value="pending">Pendente</option>
                <option value="passed">Passou</option>
                <option value="failed">Falhou</option>
                <option value="inconclusive">Inconclusivo</option>
                <option value="not_applicable">Não aplicável</option>
              </select>
              <textarea
                name="procedure_notes"
                rows={3}
                placeholder="Procedimento executado"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <textarea
                name="actual_result"
                rows={3}
                placeholder="Resultado observado"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
                Registrar teste
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {detail.tests.length ? (
                detail.tests.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)] break-words">
                          Etapa {item.stepOrder} • {item.testName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)] break-words">
                          {item.technician} • {item.performedAt}
                        </p>
                        {item.requestedByAi ? (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-copper)]">
                            Sugerido pela IA
                          </p>
                        ) : null}
                      </div>
                      <StatusPill
                        label={
                          item.resultStatus === "waiting_input" ||
                          item.resultStatus === "Aguardando teste"
                            ? "Aguardando teste"
                            : item.resultStatus === "resolved" ||
                                item.resultStatus === "Resolvido"
                              ? "Resolvido hoje"
                              : "Ativo"
                        }
                      />
                    </div>
                    <p className="mt-3 text-sm text-[var(--foreground)]">
                      {item.procedureNotes}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Resultado: {item.actualResult}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-5 text-sm text-[var(--muted)]">
                  Nenhum teste registrado ainda.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Hipóteses
            </p>
            <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Linhas de investigação
            </h3>

            <form action={addHypothesisAction} className="mt-5 grid gap-3">
              <input type="hidden" name="diagnostic_id" value={detail.id} />
              <input
                required
                type="text"
                name="title"
                placeholder="Título da hipótese"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <textarea
                name="description"
                rows={3}
                placeholder="Descrição da suspeita técnica"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <textarea
                name="evidence_summary"
                rows={3}
                placeholder="Evidências observadas"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                name="confidence_score"
                placeholder="Confiança de 0 a 1"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
                Registrar hipótese
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {detail.hypotheses.length ? (
                detail.hypotheses.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-semibold text-[var(--foreground)]">
                        {item.title}
                      </p>
                      <StatusPill label="Ativo" />
                    </div>
                    <p className="mt-2 text-sm text-[var(--foreground)]">
                      {item.description}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Evidência: {item.evidence}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Confiança {item.confidence} • {item.createdAt}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-5 text-sm text-[var(--muted)]">
                  Nenhuma hipótese registrada ainda.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Medições
            </p>
            <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Leituras da bancada
            </h3>

            <form action={addMeasurementAction} className="mt-5 grid gap-3">
              <input type="hidden" name="diagnostic_id" value={detail.id} />
              <select
                required
                name="measurement_type"
                defaultValue=""
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              >
                <option value="" disabled>
                  Tipo de medição
                </option>
                <option value="voltage">Tensão</option>
                <option value="current">Corrente</option>
                <option value="resistance">Resistência</option>
                <option value="temperature">Temperatura</option>
                <option value="consumption">Consumo</option>
                <option value="frequency">Frequência</option>
                <option value="continuity">Continuidade</option>
                <option value="other">Outra</option>
              </select>
              <input
                type="text"
                name="point_label"
                placeholder="Ponto medido"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="number"
                  step="0.0001"
                  name="measured_value_numeric"
                  placeholder="Valor numérico"
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
                />
                <input
                  type="text"
                  name="unit"
                  placeholder="Unidade"
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
                />
              </div>
              <input
                type="text"
                name="measured_value_text"
                placeholder="Leitura textual complementar"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <input
                type="text"
                name="expected_value_text"
                placeholder="Valor esperado"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
                Registrar medição
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {detail.measurements.length ? (
                detail.measurements.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {item.measurementType} • {item.pointLabel}
                    </p>
                    <p className="mt-2 text-sm text-[var(--foreground)]">
                      Medido: {item.measuredValue}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Esperado: {item.expectedValue}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {item.technician} • {item.measuredAt}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-5 text-sm text-[var(--muted)]">
                  Nenhuma medição registrada ainda.
                </p>
              )}
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Linha do tempo
            </p>
            <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Histórico unificado do caso
            </h3>

            <div className="mt-5 space-y-3">
              {detail.timeline.length ? (
                detail.timeline.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--accent-copper)]">
                          {item.kind}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[var(--foreground)] break-words">
                          {item.title}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-[var(--muted)]">{item.happenedAt}</span>
                    </div>
                    <p className="mt-3 text-sm text-[var(--muted)] break-words">{item.description}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                  Ainda não há eventos no histórico.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Evidências
            </p>
            <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Anexos do caso
            </h3>

            <form action={uploadAttachmentAction} className="mt-5 grid gap-3">
              <input type="hidden" name="diagnostic_id" value={detail.id} />
              <input
                required
                type="text"
                name="title"
                placeholder="Título do anexo"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <select
                name="attachment_type"
                defaultValue="report"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              >
                <option value="photo">Foto</option>
                <option value="video">Vídeo</option>
                <option value="screenshot">Captura</option>
                <option value="waveform">Waveform</option>
                <option value="report">Relatório</option>
              </select>
              <textarea
                name="description"
                rows={3}
                placeholder="Descrição do arquivo"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <input
                required
                type="file"
                name="file"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
                Enviar anexo
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {detail.attachments.length ? (
                detail.attachments.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm text-[var(--foreground)]">
                      {item.description}
                    </p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {item.attachmentType} • {item.uploadedAt}
                    </p>
                    {item.signedUrl ? (
                      <a
                        href={item.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex text-sm font-semibold text-[var(--accent-copper)]"
                      >
                        Abrir arquivo
                      </a>
                    ) : null}

                    {item.mimeType.startsWith("image/") ? (
                      item.imageAnalysis ? (
                        <div className="mt-4 rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface-soft)] p-4">
                          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-teal)]">
                            Análise de imagem por IA • confiança {item.imageAnalysis.confidence} • {item.imageAnalysis.analyzedAt}
                          </p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]">
                            {item.imageAnalysis.observations.map((observation) => (
                              <li key={observation}>{observation}</li>
                            ))}
                          </ul>
                          {item.imageAnalysis.suspectedIssues.length ? (
                            <p className="mt-2 text-sm text-[var(--danger)]">
                              Suspeitas: {item.imageAnalysis.suspectedIssues.join("; ")}
                            </p>
                          ) : null}
                          <p className="mt-2 text-sm text-[var(--muted)]">
                            Recomendação: {item.imageAnalysis.recommendation}
                          </p>
                        </div>
                      ) : (
                        <form action={analyzeAttachmentImageAction} className="mt-3">
                          <input type="hidden" name="diagnostic_id" value={detail.id} />
                          <input type="hidden" name="attachment_id" value={item.id} />
                          <button className="rounded-full border border-[var(--accent-teal)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-teal)]">
                            Analisar imagem com IA
                          </button>
                        </form>
                      )
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-5 text-sm text-[var(--muted)]">
                  Nenhum anexo enviado ainda.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Encerramento
            </p>
            <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Consolidar causa e solução
            </h3>

            {detail.resolvedCase ? (
              <div className="mt-5 rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Caso encerrado como {detail.resolvedCase.caseStatus}
                </p>
                <p className="mt-2 text-sm text-[var(--foreground)]">
                  {detail.resolvedCase.resolutionSummary}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Resultado: {detail.resolvedCase.repairOutcome}
                </p>
              </div>
            ) : (
              <DiagnosticClosureForm diagnosticId={detail.id} />
            )}
          </article>
        </section>

        <section>
          <Link
            href="/diagnosticos/novo"
            className="inline-flex rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
          >
            Abrir outro diagnóstico
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
