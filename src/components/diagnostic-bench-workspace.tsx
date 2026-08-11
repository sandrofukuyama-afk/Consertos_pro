import Link from "next/link";
import type { ReactNode } from "react";

import {
  addDiagnosticSymptomAction,
  addDiagnosticTestAction,
  addHypothesisAction,
  generateDiagnosticAssistantAction,
  saveAssistantFeedbackAction,
  uploadAttachmentAction,
} from "@/app/actions";
import { AttachmentCard } from "@/components/attachment-card";
import { BoardMeasurementForm } from "@/components/board-measurement-form";
import { DiagnosticClosureForm } from "@/components/diagnostic-closure-form";
import { FormSubmitButton } from "@/components/form-submit-button";
import { MeasurementForm } from "@/components/measurement-form";
import { StatusPill } from "@/components/status-pill";
import { formatProviderLabel } from "@/lib/utils";
import type { DiagnosticDetail, SymptomOption, TestOption } from "@/types/domain";

type DiagnosticBenchWorkspaceProps = {
  detail: DiagnosticDetail;
  options: {
    symptoms: SymptomOption[];
    tests: TestOption[];
  };
};

function buildLibraryHref(detail: DiagnosticDetail) {
  const primaryBoard = detail.boards.find((board) => board.isPrimary) ?? detail.boards[0] ?? null;
  const params = new URLSearchParams();

  if (detail.manufacturerId) {
    params.set("manufacturer_id", detail.manufacturerId);
  }

  if (detail.modelId) {
    params.set("model_id", detail.modelId);
  }

  if (primaryBoard?.boardId) {
    params.set("board_id", primaryBoard.boardId);
  }

  const query = params.toString();
  return query ? `/biblioteca?${query}` : "/biblioteca";
}

function buildBoardviewHref(detail: DiagnosticDetail) {
  const primaryBoard = detail.boards.find((board) => board.isPrimary) ?? detail.boards[0] ?? null;
  const boardviewAsset =
    detail.technicalAssets.find(
      (asset) => asset.fileFormat === "brd" || asset.fileFormat === "bdv",
    ) ?? null;
  const schematicAsset =
    detail.technicalAssets.find((asset) => asset.fileFormat === "pdf") ?? null;
  const params = new URLSearchParams();

  params.set("diagnostic_id", detail.id);

  if (detail.modelId) {
    params.set("model_id", detail.modelId);
  }

  if (primaryBoard?.boardId) {
    params.set("board_id", primaryBoard.boardId);
  }

  if (boardviewAsset) {
    params.set("boardview_asset_id", boardviewAsset.id);
  }

  if (schematicAsset) {
    params.set("schematic_asset_id", schematicAsset.id);
  }

  return {
    href: `/boardview/lab?${params.toString()}`,
    hasLinkedAssets: Boolean(boardviewAsset || schematicAsset),
    boardviewAsset,
    schematicAsset,
  };
}

function getEquipmentDetailValue(detail: DiagnosticDetail, label: string) {
  return detail.equipmentDetails.find((item) => item.label === label)?.value ?? "Não informado";
}

function ActionLink({
  href,
  label,
  tone = "default",
}: {
  href: string;
  label: string;
  tone?: "default" | "primary";
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition ${
        tone === "primary"
          ? "bg-[var(--accent-copper)] text-white hover:brightness-110"
          : "border border-[var(--panel-border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[rgba(109,94,242,0.3)]"
      }`}
    >
      {label}
    </Link>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function SectionCard({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:rounded-[28px] sm:p-6"
    >
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function DiagnosticBenchWorkspace({
  detail,
  options,
}: DiagnosticBenchWorkspaceProps) {
  const primaryBoard = detail.boards.find((board) => board.isPrimary) ?? detail.boards[0] ?? null;
  const libraryHref = buildLibraryHref(detail);
  const boardviewAccess = buildBoardviewHref(detail);
  const latestTest = detail.tests[0] ?? null;
  const latestMeasurement = detail.measurements[0] ?? null;
  const latestResponse = detail.assistantSnapshot.latestResponse;
  const technicalContext = latestResponse?.structured?.technicalContext;
  const intakePower = getEquipmentDetailValue(detail, "Alimentação");
  const intakeBoots = getEquipmentDetailValue(detail, "Liga");
  const intakeScreen = getEquipmentDetailValue(detail, "Condição da tela");
  const accessories = getEquipmentDetailValue(detail, "Acessórios");

  return (
    <div className="grid gap-4">
      {detail.preventiveInsight ? (
        <section className="rounded-2xl border border-[rgba(216,166,84,0.32)] bg-[rgba(216,166,84,0.1)] p-4 sm:rounded-[26px] sm:p-5">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-amber)]">
            Atenção preventiva
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
            {detail.preventiveInsight.occurrences} de {detail.preventiveInsight.totalCases} casos
            anteriores deste modelo tiveram como causa confirmada{" "}
            <span className="font-semibold">
              &quot;{detail.preventiveInsight.causeLabel}&quot;
            </span>
            {detail.preventiveInsight.componentRef
              ? `, com maior incidência no componente ${detail.preventiveInsight.componentRef}`
              : ""}
            . Vale checar isso cedo na bancada.
          </p>
        </section>
      ) : null}

      <SectionCard
        eyebrow="Resumo do caso"
        title={detail.label}
        description="Leitura rápida do aparelho, do defeito relatado e do estado atual da bancada."
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <StatusPill label={detail.status} />
              <StatusPill label={`Prioridade ${detail.priority}`} />
              <StatusPill label={detail.category} />
            </div>
            <p className="text-sm text-[var(--muted)]">
              {detail.manufacturer} • {detail.model} • Série {detail.serialNumber}
            </p>
            <p className="text-sm leading-6 text-[var(--foreground)]">{detail.summary}</p>
          </div>
          <div className="grid min-w-[260px] gap-2 text-sm text-[var(--muted)]">
            <p>Aberto por {detail.openedBy}</p>
            <p>Criado {detail.createdAt}</p>
            {primaryBoard ? (
              <p>
                Placa relacionada: {primaryBoard.name ?? "Placa principal"}
                {primaryBoard.boardCode ? ` • ${primaryBoard.boardCode}` : ""}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoLine label="Defeito relatado" value={detail.initialReport} />
          <InfoLine label="Alimentação" value={intakePower} />
          <InfoLine label="Liga" value={intakeBoots} />
          <InfoLine label="Condição da tela" value={intakeScreen} />
          <InfoLine label="Acessórios" value={accessories} />
          <InfoLine
            label="Último teste"
            value={
              latestTest
                ? `${latestTest.testName} • ${latestTest.resultStatus}`
                : "Nenhum teste registrado"
            }
          />
          <InfoLine
            label="Última medição"
            value={
              latestMeasurement
                ? `${latestMeasurement.pointLabel} • ${latestMeasurement.measuredValue}`
                : "Nenhuma medição registrada"
            }
          />
          <InfoLine label="Estado físico" value={detail.physicalNotes} />
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,420px)]">
        <SectionCard
          eyebrow="Assistente de bancada"
          title="Perguntar à IA com contexto do reparo"
          description="O assistente usa o histórico do caso, medições, testes, hipóteses, casos parecidos e os arquivos técnicos associados disponíveis."
        >
          <div className="rounded-[22px] border border-[rgba(45,139,130,0.22)] bg-[rgba(45,139,130,0.08)] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Agente ativo: {detail.assistantSnapshot.activeAgent.name}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {detail.assistantSnapshot.activeAgent.specialty}
                </p>
              </div>
              <StatusPill label={formatProviderLabel(detail.assistantSnapshot.provider)} />
            </div>

            <form action={generateDiagnosticAssistantAction} className="mt-4 grid gap-3">
              <input type="hidden" name="diagnostic_id" value={detail.id} />
              <textarea
                name="assistant_prompt"
                rows={4}
                placeholder='Ex.: "não liga, tenho 20V na entrada e 0V na linha 3V3" ou "procure no esquema PPBUS_G3H".'
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <div className="flex flex-wrap gap-3">
                <FormSubmitButton
                  idleLabel={latestResponse ? "Atualizar orientação da IA" : "Perguntar à IA"}
                  pendingLabel="Consultando a IA..."
                  className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                />
                <ActionLink href="#historico-bancada" label="Ver histórico da bancada" />
              </div>
            </form>
          </div>

          {latestResponse ? (
            <div className="mt-5 grid gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill label={`Confiança ${latestResponse.confidenceScore}`} />
                <p className="text-sm text-[var(--muted)]">
                  Última resposta {latestResponse.createdAt}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Resumo técnico</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {latestResponse.structured?.technicalSummary ??
                      latestResponse.reasoningSummary}
                  </p>
                </div>
                <div className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Hipótese principal</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {latestResponse.structured?.mainHypothesis ??
                      "Sem hipótese consolidada na última resposta."}
                  </p>
                </div>
              </div>

              <div className="rounded-[22px] border border-[rgba(109,94,242,0.24)] bg-[rgba(109,94,242,0.1)] p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Próximo passo sugerido
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                  {latestResponse.structured?.nextTest ?? latestResponse.recommendedNextStep}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {latestResponse.structured?.validationGoal ??
                    "Sem objetivo de validação detalhado."}
                </p>
                <p className="mt-3 text-sm text-[var(--muted)]">
                  {latestResponse.structured?.safetyNote ??
                    "Sem observação de segurança registrada."}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Evidências consideradas
                  </p>
                  <div className="mt-3 space-y-2">
                    {(latestResponse.structured?.evidence ?? []).length ? (
                      (latestResponse.structured?.evidence ?? []).map((item) => (
                        <p
                          key={item}
                          className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-2 text-sm text-[var(--muted)]"
                        >
                          {item}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        A última resposta não trouxe evidências estruturadas.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Contexto técnico pesquisado
                  </p>
                  {technicalContext ? (
                    <div className="mt-3 space-y-4">
                      {technicalContext.searchTerms.length ? (
                        <div className="flex flex-wrap gap-2">
                          {technicalContext.searchTerms.map((term) => (
                            <span
                              key={term}
                              className="rounded-full border border-[rgba(109,94,242,0.28)] bg-[rgba(109,94,242,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]"
                            >
                              {term}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--muted)]">
                          Nenhum termo técnico pesquisável foi identificado na última pergunta.
                        </p>
                      )}

                      {technicalContext.boardview ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              Boardview: {technicalContext.boardview.assetTitle}
                            </p>
                            <ActionLink
                              href={technicalContext.boardview.openLabHref}
                              label="Abrir no laboratório"
                            />
                          </div>
                          {technicalContext.boardview.results.length ? (
                            technicalContext.boardview.results.map((result) => (
                              <div
                                key={`${result.kind}-${result.title}`}
                                className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-3"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-[var(--foreground)]">
                                      {result.title}
                                    </p>
                                    <p className="mt-1 text-sm text-[var(--muted)]">
                                      {result.subtitle}
                                    </p>
                                  </div>
                                  <ActionLink
                                    href={result.openLabHref}
                                    label={
                                      result.kind === "net"
                                        ? "Abrir net"
                                        : "Abrir componente"
                                    }
                                  />
                                </div>
                                <div className="mt-2 space-y-1">
                                  {result.details.map((detailLine) => (
                                    <p
                                      key={detailLine}
                                      className="text-sm leading-6 text-[var(--muted)]"
                                    >
                                      {detailLine}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-[var(--muted)]">
                              O boardview associado não trouxe resultados para os termos da
                              pergunta.
                            </p>
                          )}
                        </div>
                      ) : null}

                      {technicalContext.schematic ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              Esquema: {technicalContext.schematic.assetTitle}
                            </p>
                            <ActionLink
                              href={technicalContext.schematic.openLabHref}
                              label="Abrir no laboratório"
                            />
                          </div>
                          {technicalContext.schematic.matches.length ? (
                            technicalContext.schematic.matches.map((match) => (
                              <div
                                key={`${match.term}-${match.pageNumber}`}
                                className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-3"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-[var(--foreground)]">
                                      {match.term} na página {match.pageNumber}
                                    </p>
                                    <p className="mt-1 text-sm text-[var(--muted)]">
                                      {match.occurrences} ocorrência(s) localizada(s).
                                    </p>
                                  </div>
                                  <ActionLink
                                    href={match.openLabHref}
                                    label="Abrir página do esquema"
                                  />
                                </div>
                                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                                  {match.excerpt}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-[var(--muted)]">
                              O esquema associado não trouxe trechos relevantes para os termos da
                              pergunta.
                            </p>
                          )}
                        </div>
                      ) : null}

                      {technicalContext.limitations.length ? (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            Limitações desta consulta
                          </p>
                          {technicalContext.limitations.map((limitation) => (
                            <p
                              key={limitation}
                              className="rounded-[18px] border border-dashed border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-2 text-sm text-[var(--muted)]"
                            >
                              {limitation}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--muted)]">
                      A última resposta ainda não registrou contexto estruturado de boardview ou
                      esquema.
                    </p>
                  )}
                </div>

                <div className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Feedback da recomendação
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Marque se a orientação ajudou e se foi seguida na bancada.
                  </p>

                  {latestResponse.feedback ? (
                    <div className="mt-3 rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-3 text-sm text-[var(--foreground)]">
                      <p>
                        Último feedback: {latestResponse.feedback.submittedBy} •{" "}
                        {latestResponse.feedback.createdAt}
                      </p>
                      <p className="mt-2 text-[var(--muted)]">
                        {latestResponse.feedback.note || "Sem observação adicional."}
                      </p>
                    </div>
                  ) : null}

                  <form action={saveAssistantFeedbackAction} className="mt-4 grid gap-3">
                    <input type="hidden" name="diagnostic_id" value={detail.id} />
                    <input type="hidden" name="ai_response_id" value={latestResponse.id} />
                    <select
                      name="feedback_rating"
                      required
                      defaultValue={latestResponse.feedback?.rating ?? ""}
                      className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm outline-none"
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
                        latestResponse.feedback?.wasFollowed === true
                          ? "yes"
                          : latestResponse.feedback?.wasFollowed === false
                            ? "no"
                            : ""
                      }
                      className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm outline-none"
                    >
                      <option value="">Não informar se foi seguida</option>
                      <option value="yes">A sugestão foi seguida</option>
                      <option value="no">A sugestão não foi seguida</option>
                    </select>
                    <textarea
                      name="note"
                      rows={3}
                      defaultValue={latestResponse.feedback?.note ?? ""}
                      placeholder="Observação sobre o uso da recomendação"
                      className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm outline-none"
                    />
                    <FormSubmitButton
                      idleLabel="Salvar feedback"
                      pendingLabel="Salvando feedback..."
                    />
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-8 text-sm leading-6 text-[var(--muted)]">
              Ainda não existe uma resposta salva da IA para este caso. Use a caixa acima
              para pedir o próximo teste, comentar uma medição da bancada ou perguntar por
              uma linha específica do esquema.
            </div>
          )}
        </SectionCard>

        <div className="grid gap-4">
          <SectionCard
            eyebrow="Ferramentas do reparo"
            title="Ações rápidas da bancada"
            description="Atalhos diretos para análise, registro e acesso técnico durante o reparo."
          >
            <div className="grid gap-3">
              <ActionLink
                href={boardviewAccess.hasLinkedAssets ? boardviewAccess.href : libraryHref}
                label={
                  boardviewAccess.hasLinkedAssets
                    ? "Abrir boardview/esquema"
                    : "Selecionar arquivo da biblioteca técnica"
                }
                tone="primary"
              />
              <ActionLink href={libraryHref} label="Ver arquivos técnicos da placa" />
              <ActionLink href="#registrar-medicao" label="Registrar medição" />
              <ActionLink href="#registrar-teste" label="Registrar teste feito" />
              <ActionLink href="#registrar-hipotese" label="Adicionar hipótese" />
              <ActionLink href="#anexos" label="Anexar arquivo/foto" />
              <ActionLink href="#encerrar-diagnostico" label="Encerrar diagnóstico" />
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Arquivos técnicos"
            title="Arquivos associados ao caso"
            description="Arquivos já salvos na biblioteca técnica e relacionados a esta placa ou modelo."
          >
            <div className="space-y-3">
              {detail.technicalAssets.length ? (
                detail.technicalAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {asset.title}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {asset.documentType} • {asset.associationLabel}
                          {asset.fileSizeLabel ? ` • ${asset.fileSizeLabel}` : ""}
                        </p>
                      </div>
                      <StatusPill label={asset.uploadedAt} />
                    </div>
                    {asset.boardviewLabHref ? (
                      <div className="mt-3">
                        <ActionLink href={asset.boardviewLabHref} label="Abrir no laboratório" />
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-6 text-sm text-[var(--muted)]">
                  Este diagnóstico ainda não tem boardview ou esquema associado.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Referências relacionadas"
            title="Casos e documentos próximos"
            description="Resultados já recuperados pelo assistente para acelerar a investigação."
          >
            <div className="space-y-3">
              {detail.assistantSnapshot.similarCases.map((item) => (
                <Link
                  key={item.id}
                  href={item.href ?? "#"}
                  className="block rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4 hover:border-[rgba(109,94,242,0.3)]"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--accent-teal)]">
                    {item.similarityLabel}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{item.excerpt}</p>
                </Link>
              ))}

              {detail.assistantSnapshot.relatedDocuments.map((item) => (
                <Link
                  key={item.id}
                  href={item.href ?? "#"}
                  className="block rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4 hover:border-[rgba(45,139,130,0.28)]"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--accent-copper)]">
                    Documento técnico
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{item.excerpt}</p>
                </Link>
              ))}

              {!detail.assistantSnapshot.similarCases.length &&
              !detail.assistantSnapshot.relatedDocuments.length ? (
                <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-6 text-sm text-[var(--muted)]">
                  Ainda não há casos parecidos nem documentos relacionados recuperados.
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard
        id="historico-bancada"
        eyebrow="Histórico da bancada"
        title="Timeline simples do reparo"
        description="Medições, testes, respostas da IA, hipóteses, anexos e mudanças relevantes do diagnóstico."
      >
        <div className="space-y-3">
          {detail.timeline.length ? (
            detail.timeline.map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                      {item.kind}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {item.description}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-[var(--muted)]">{item.happenedAt}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-8 text-sm text-[var(--muted)]">
              Ainda não há eventos registrados neste caso.
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        id="registrar-medicao"
        eyebrow="Registro da bancada"
        title="Registrar medição"
        description="Guarde tensões, correntes, resistências e contexto do ponto medido para uso técnico e pela IA."
      >
        <MeasurementForm
          diagnosticId={detail.id}
          tests={detail.tests.map((item) => ({
            id: item.id,
            testName: item.testName,
            stepOrder: item.stepOrder,
            expectedResult: item.expectedResult,
          }))}
          boards={detail.boards.map((item) => ({
            id: item.id,
            roleLabel: item.roleLabel,
            boardCode: item.boardCode,
            name: item.name,
          }))}
          activeScenarioTitle={latestResponse?.structured?.nextTest ?? undefined}
        />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          id="registrar-teste"
          eyebrow="Ferramenta"
          title="Registrar teste feito"
          description="Adicione o teste executado, o resultado observado e a conclusão prática da bancada."
        >
          <form action={addDiagnosticTestAction} className="grid gap-3">
            <input type="hidden" name="diagnostic_id" value={detail.id} />
            <input
              type="hidden"
              name="requested_by_ai_response_id"
              value={latestResponse?.id ?? ""}
            />
            <input
              type="hidden"
              name="diagnostic_board_id"
              value={primaryBoard?.id ?? ""}
            />
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
            <textarea
              name="procedure_notes"
              rows={3}
              placeholder="Procedimento executado"
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
            />
            <input
              type="text"
              name="expected_result"
              placeholder="Resultado esperado"
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
            />
            <textarea
              name="actual_result"
              rows={3}
              placeholder="Resultado observado"
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
            />
            <textarea
              name="conclusion"
              rows={3}
              placeholder="Conclusão do teste"
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
            />
            <select
              name="result_status"
              defaultValue="pending"
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
            >
              <option value="pending">Aguardando teste</option>
              <option value="passed">Passou</option>
              <option value="failed">Falhou</option>
              <option value="inconclusive">Inconclusivo</option>
            </select>
            <FormSubmitButton
              idleLabel="Registrar teste"
              pendingLabel="Salvando teste..."
            />
          </form>

          <div className="mt-5 space-y-3">
            {detail.tests.length ? (
              detail.tests.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        Etapa {item.stepOrder} • {item.testName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {item.technician} • {item.performedAt}
                      </p>
                    </div>
                    <StatusPill label={item.resultStatus} />
                  </div>
                  <p className="mt-3 text-sm text-[var(--foreground)]">
                    {item.actualResult}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-6 text-sm text-[var(--muted)]">
                Nenhum teste registrado ainda.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          id="registrar-hipotese"
          eyebrow="Ferramenta"
          title="Registrar observação e hipótese"
          description="Adicione um novo sintoma observado e, se necessário, formalize uma hipótese técnica."
        >
          <form action={addDiagnosticSymptomAction} className="grid gap-3">
            <input type="hidden" name="diagnostic_id" value={detail.id} />
            <select
              required
              name="symptom_id"
              defaultValue=""
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
            >
              <option value="" disabled>
                Selecionar sintoma observado
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
              placeholder="Contexto do sintoma"
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
            />
            <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
              <input type="checkbox" name="is_primary" />
              Marcar como sintoma principal
            </label>
            <FormSubmitButton
              idleLabel="Registrar sintoma"
              pendingLabel="Salvando sintoma..."
            />
          </form>

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
            <FormSubmitButton
              idleLabel="Registrar hipótese"
              pendingLabel="Salvando hipótese..."
            />
          </form>

          <div className="mt-5 space-y-3">
            {detail.hypotheses.length ? (
              detail.hypotheses.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {item.title}
                    </p>
                    <StatusPill label={item.status} />
                  </div>
                  <p className="mt-2 text-sm text-[var(--foreground)]">{item.description}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{item.evidence}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-6 text-sm text-[var(--muted)]">
                Nenhuma hipótese registrada ainda.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          id="anexos"
          eyebrow="Ferramenta"
          title="Anexar arquivo ou foto"
          description="Envie fotos, relatórios, vídeos ou capturas relevantes para o reparo."
        >
          <form action={uploadAttachmentAction} className="grid gap-3">
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
            <FormSubmitButton
              idleLabel="Enviar anexo"
              pendingLabel="Enviando anexo..."
            />
          </form>

          <div className="mt-5 space-y-3">
            {detail.attachments.length ? (
              detail.attachments.map((item) => (
                <AttachmentCard
                  key={item.id}
                  item={item}
                  diagnosticId={detail.id}
                  referenceMeasurements={detail.referenceMeasurements}
                />
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-6 text-sm text-[var(--muted)]">
                Nenhum anexo enviado ainda.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Referência de placa"
          title="Medições de referência"
          description="Valores esperados da placa para comparação rápida durante o reparo."
        >
          {detail.boards.length ? (
            <div className="grid gap-5">
              <BoardMeasurementForm diagnosticId={detail.id} boards={detail.boards} />

              <div className="space-y-3">
                {detail.referenceMeasurements.length ? (
                  detail.referenceMeasurements.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                    >
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {item.componentRef} • {item.measurementPoint}
                      </p>
                      <p className="mt-2 text-sm text-[var(--foreground)]">
                        Esperado: {item.expectedValue}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {item.condition} • {item.userName}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-6 text-sm text-[var(--muted)]">
                    Nenhuma medição de referência registrada para esta placa ainda.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-6 text-sm text-[var(--muted)]">
              Associe uma placa ao diagnóstico para registrar medições de referência.
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        id="encerrar-diagnostico"
        eyebrow="Encerramento"
        title="Fechar ou consolidar o diagnóstico"
        description="Use este bloco apenas quando a causa e a solução já estiverem claras."
      >
        {detail.resolvedCase ? (
          <div className="rounded-[22px] border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] p-4">
            <div className="flex flex-wrap gap-2">
              <StatusPill label={detail.resolvedCase.caseStatus} />
              <StatusPill label={detail.resolvedCase.repairOutcome} />
            </div>
            <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">
              Resumo da solução
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {detail.resolvedCase.resolutionSummary}
            </p>
          </div>
        ) : (
          <DiagnosticClosureForm diagnosticId={detail.id} />
        )}
      </SectionCard>
    </div>
  );
}
