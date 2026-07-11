import Link from "next/link";

import {
  addDiagnosticSymptomAction,
  addDiagnosticTestAction,
  addHypothesisAction,
  addMeasurementAction,
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

type DiagnosticDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function DiagnosticDetailPage({
  params,
  searchParams,
}: DiagnosticDetailPageProps) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const query = await searchParams;
  const [detail, options] = await Promise.all([
    getDiagnosticDetail(id),
    getDiagnosticFormOptions(id),
  ]);

  return (
    <AppShell
      title={`Diagnostico ${detail.label}`}
      description="Detalhe operacional do caso com sintomas, testes e medicoes registrados em banco."
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

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6 shadow-[0_18px_44px_rgba(72,62,49,0.06)]">
            <div className="flex flex-col gap-4 border-b border-[var(--panel-border)] pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Contexto atual
                </p>
                <h3 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                  {detail.summary}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  Relato inicial: {detail.initialReport}
                </p>
              </div>
              <StatusPill label={detail.status === "resolved" ? "Resolvido hoje" : detail.status === "waiting input" ? "Aguardando teste" : "Ativo"} />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  Metadados
                </p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--foreground)]">
                  <p>Categoria: {detail.category}</p>
                  <p>Fabricante: {detail.manufacturer}</p>
                  <p>Prioridade: {detail.priority}</p>
                  <p>Aberto por: {detail.openedBy}</p>
                  <p>Criado: {detail.createdAt}</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  Condicao fisica
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
                  {detail.physicalNotes}
                </p>
              </div>
            </div>
          </article>

          <aside className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-white">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
              Proximo passo
            </p>
            <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
              Continue alimentando o caso
            </h3>
            <p className="mt-3 text-sm leading-6 text-[rgba(255,245,236,0.78)]">
              Este detalhe ja aceita sintomas, testes e medicoes. O proximo degrau e adicionar anexos e historico cronologico unificado.
            </p>
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Sintomas
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
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
                      <p className="text-sm font-semibold text-[var(--foreground)]">
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

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Testes
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Fluxo da investigacao
            </h3>

            <form action={addDiagnosticTestAction} className="mt-5 grid gap-3">
              <input type="hidden" name="diagnostic_id" value={detail.id} />
              <select
                required
                name="test_id"
                defaultValue=""
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
                <option value="not_applicable">Nao aplicavel</option>
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
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          Etapa {item.stepOrder} • {item.testName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {item.technician} • {item.performedAt}
                        </p>
                      </div>
                      <StatusPill
                        label={
                          item.resultStatus === "waiting_input"
                            ? "Aguardando teste"
                            : item.resultStatus === "resolved"
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

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Hipoteses
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Linhas de investigacao
            </h3>

            <form action={addHypothesisAction} className="mt-5 grid gap-3">
              <input type="hidden" name="diagnostic_id" value={detail.id} />
              <input
                required
                type="text"
                name="title"
                placeholder="Titulo da hipotese"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <textarea
                name="description"
                rows={3}
                placeholder="Descricao da suspeita tecnica"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <textarea
                name="evidence_summary"
                rows={3}
                placeholder="Evidencias observadas"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                name="confidence_score"
                placeholder="Confianca de 0 a 1"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
                Registrar hipotese
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
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {item.title}
                      </p>
                      <StatusPill label="Ativo" />
                    </div>
                    <p className="mt-2 text-sm text-[var(--foreground)]">
                      {item.description}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Evidencia: {item.evidence}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Confianca {item.confidence} • {item.createdAt}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-5 text-sm text-[var(--muted)]">
                  Nenhuma hipotese registrada ainda.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Medicoes
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
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
                  Tipo de medicao
                </option>
                <option value="voltage">Tensao</option>
                <option value="current">Corrente</option>
                <option value="resistance">Resistencia</option>
                <option value="temperature">Temperatura</option>
                <option value="consumption">Consumo</option>
                <option value="frequency">Frequencia</option>
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
                  placeholder="Valor numerico"
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
                Registrar medicao
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
                  Nenhuma medicao registrada ainda.
                </p>
              )}
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Evidencias
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Anexos do caso
            </h3>

            <form action={uploadAttachmentAction} className="mt-5 grid gap-3">
              <input type="hidden" name="diagnostic_id" value={detail.id} />
              <input
                required
                type="text"
                name="title"
                placeholder="Titulo do anexo"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <select
                name="attachment_type"
                defaultValue="report"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              >
                <option value="photo">Foto</option>
                <option value="video">Video</option>
                <option value="screenshot">Captura</option>
                <option value="waveform">Waveform</option>
                <option value="report">Relatorio</option>
              </select>
              <textarea
                name="description"
                rows={3}
                placeholder="Descricao do arquivo"
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
                  </div>
                ))
              ) : (
                <p className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-5 text-sm text-[var(--muted)]">
                  Nenhum anexo enviado ainda.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Encerramento
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Consolidar causa e solucao
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
            className="inline-flex rounded-full border border-[var(--panel-border)] bg-white/80 px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
          >
            Abrir outro diagnostico
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
