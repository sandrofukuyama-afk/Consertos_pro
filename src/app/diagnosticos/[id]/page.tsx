import Link from "next/link";

import {
  addDiagnosticSymptomAction,
  addDiagnosticTestAction,
  addHypothesisAction,
  generateDiagnosticAssistantAction,
  saveAssistantFeedbackAction,
  uploadAttachmentAction,
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { AttachmentCard } from "@/components/attachment-card";
import { BoardMeasurementForm } from "@/components/board-measurement-form";
import { CatalogShortcutLinks } from "@/components/catalog-shortcut-links";
import { DiagnosticClosureForm } from "@/components/diagnostic-closure-form";
import { FormSubmitButton } from "@/components/form-submit-button";
import { MeasurementForm } from "@/components/measurement-form";
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
    stage?: string;
  }>;
};

type MaintenanceStage = {
  id: string;
  title: string;
  description: string;
  href: string;
  status: "done" | "current" | "pending";
};

type StageGuide = {
  id: string;
  eyebrow: string;
  title: string;
  objective: string;
  checklist: Array<{ label: string; done: boolean }>;
  nextLabel: string;
  isReadyToAdvance: boolean;
  blockedMessage: string;
};

export default async function DiagnosticDetailPage({
  params,
  searchParams,
}: DiagnosticDetailPageProps) {
  const userPromise = requireCurrentUser();
  const { id } = await params;
  const [user, detail, options] = await Promise.all([
    userPromise,
    getDiagnosticDetail(id),
    getDiagnosticFormOptions(id),
  ]);

  const query = await searchParams;
  const suggestedTestId = query.suggested_test_id?.trim() ?? "";
  const requestedByAiResponseId = query.ai_response_id?.trim() ?? "";
  const selectedStage = query.stage?.trim() ?? "";
  const hasSymptoms = detail.symptoms.length > 0;
  const hasInvestigationProgress =
    detail.tests.length > 0 ||
    detail.measurements.length > 0 ||
    Boolean(detail.assistantSnapshot.latestResponse);
  const hasEvidence =
    detail.attachments.length > 0 ||
    detail.hypotheses.length > 0 ||
    detail.referenceMeasurements.length > 0;
  const isClosed = Boolean(detail.resolvedCase);

  const maintenanceStages: MaintenanceStage[] = [
    {
      id: "triagem",
      title: "1. Triagem dos sintomas",
      description: hasSymptoms
        ? "Os sintomas do equipamento e o contexto inicial já foram registrados."
        : "Registre os sintomas que causam o defeito neste equipamento.",
      href: "#triagem",
      status: hasSymptoms ? "done" : "current",
    },
    {
      id: "investigacao",
      title: "2. Diagnóstico com IA",
      description: hasInvestigationProgress
        ? "A IA já ajudou com recomendação, testes ou medições deste aparelho."
        : "Use a IA para sugerir causa, solução e o próximo teste do aparelho.",
      href: "#investigacao",
      status: hasInvestigationProgress ? "done" : hasSymptoms ? "current" : "pending",
    },
    {
      id: "evidencias",
      title: "3. Apoio à reparação",
      description: hasEvidence
        ? "Já existem anexos, hipóteses ou referências para apoiar o reparo."
        : "Use esquemas, anexos e referências da placa para apoiar o reparo.",
      href: "#evidencias",
      status: hasEvidence ? "done" : hasInvestigationProgress ? "current" : "pending",
    },
    {
      id: "encerramento",
      title: "4. Encerramento",
      description: isClosed
        ? "Causa e solução já foram consolidadas."
        : "Feche o caso apenas depois de validar a causa e a solução.",
      href: "#encerramento",
      status: isClosed ? "done" : hasEvidence || hasInvestigationProgress ? "current" : "pending",
    },
  ];

  const nextMaintenanceStage =
    maintenanceStages.find((stage) => stage.status === "current") ??
    maintenanceStages.find((stage) => stage.status === "pending") ??
    maintenanceStages[maintenanceStages.length - 1];
  const validStageIds = new Set(maintenanceStages.map((stage) => stage.id));
  const activeStageId = validStageIds.has(selectedStage) ? selectedStage : nextMaintenanceStage.id;
  const currentStageIndex = maintenanceStages.findIndex((stage) => stage.id === activeStageId);
  const previousStage = currentStageIndex > 0 ? maintenanceStages[currentStageIndex - 1] : null;
  const followingStage =
    currentStageIndex >= 0 && currentStageIndex < maintenanceStages.length - 1
      ? maintenanceStages[currentStageIndex + 1]
      : null;

  const hasDiagnosticRecommendation = Boolean(detail.assistantSnapshot.latestResponse);
  const hasTests = detail.tests.length > 0;
  const hasMeasurements = detail.measurements.length > 0;
  const hasHypotheses = detail.hypotheses.length > 0;
  const hasAttachments = detail.attachments.length > 0;
  const hasReferenceMeasurements = detail.referenceMeasurements.length > 0;
  const hasInvestigationRecord = hasTests || hasMeasurements || hasHypotheses;
  const hasEvidenceRecord = hasAttachments || hasReferenceMeasurements;

  const stageGuides: StageGuide[] = [
    {
      id: "triagem",
      eyebrow: "Etapa ativa",
      title: "Registrar os sintomas que causam o problema",
      objective: "Depois do cadastro do equipamento, documente os sintomas observáveis, o relato inicial e a condição física.",
      checklist: [
        { label: "Sintoma principal registrado", done: hasSymptoms },
        { label: "Contexto inicial preenchido", done: Boolean(detail.initialReport?.trim()) },
        { label: "Condição física documentada", done: Boolean(detail.physicalNotes?.trim()) },
      ],
      nextLabel: "Ir para investigação",
      isReadyToAdvance: hasSymptoms,
      blockedMessage: "Antes de avançar, registre pelo menos o sintoma principal do equipamento.",
    },
    {
      id: "investigacao",
      eyebrow: "Etapa ativa",
      title: "Usar a IA para buscar a causa e orientar o diagnóstico",
      objective: "Gere uma recomendação da IA, valide testes sugeridos e registre medições ou hipóteses para este aparelho.",
      checklist: [
        { label: "Recomendação técnica gerada", done: hasDiagnosticRecommendation },
        { label: "Pelo menos um teste registrado", done: hasTests },
        { label: "Medição ou hipótese documentada", done: hasMeasurements || hasHypotheses },
      ],
      nextLabel: "Ir para evidências",
      isReadyToAdvance: hasDiagnosticRecommendation && hasInvestigationRecord,
      blockedMessage: "Antes de seguir, gere a recomendação e registre ao menos um teste, medição ou hipótese.",
    },
    {
      id: "evidencias",
      eyebrow: "Etapa ativa",
      title: "Usar apoio técnico para auxiliar a reparação",
      objective: "Reúna anexos, referências da placa e histórico técnico do mesmo aparelho para apoiar o reparo.",
      checklist: [
        { label: "Linha de investigação já iniciada", done: hasInvestigationRecord || hasDiagnosticRecommendation },
        { label: "Ao menos um anexo enviado", done: hasAttachments },
        { label: "Medição de referência ou apoio registrada", done: hasReferenceMeasurements || hasMeasurements },
      ],
      nextLabel: "Ir para encerramento",
      isReadyToAdvance: (hasInvestigationRecord || hasDiagnosticRecommendation) && hasEvidenceRecord,
      blockedMessage: "Antes de encerrar, anexe pelo menos uma evidência ou registre uma medição de referência.",
    },
    {
      id: "encerramento",
      eyebrow: "Etapa ativa",
      title: "Concluir o reparo com causa e solução registradas",
      objective: "Depois de confirmar o defeito, registre a causa, a solução aplicada e o resultado final do reparo.",
      checklist: [
        { label: "Investigação registrada", done: hasInvestigationRecord || hasDiagnosticRecommendation },
        { label: "Evidência técnica anexada", done: hasEvidenceRecord },
        { label: "Conclusão final preenchida", done: isClosed },
      ],
      nextLabel: "Fluxo concluído",
      isReadyToAdvance: isClosed,
      blockedMessage: "Ainda falta consolidar a causa e a solução do caso para concluir o fluxo.",
    },
  ];

  const activeStageGuide =
    stageGuides.find((stage) => stage.id === activeStageId) ?? stageGuides[0];
  const completedChecklistCount = activeStageGuide.checklist.filter((item) => item.done).length;

  return (
    <AppShell
      title={`Diagnóstico ${detail.label}`}
      description="Veja os detalhes do caso com sintomas, testes, medições e anexos."
      user={user}
      actionLabel="Voltar para dashboard"
      actionHref="/"
    >
      <div className="grid gap-4">
        {query.message ? (
          <section className="rounded-[26px] border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] p-5 text-sm text-[var(--accent-teal)] shadow-[0_14px_32px_rgba(20,18,28,0.06)]">
            {query.message}
          </section>
        ) : null}

        {query.error ? (
          <section className="rounded-[26px] border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] p-5 text-sm text-[var(--danger)] shadow-[0_14px_32px_rgba(20,18,28,0.06)]">
            {query.error}
          </section>
        ) : null}

        {detail.preventiveInsight ? (
          <section className="rounded-2xl sm:rounded-[26px] border border-[rgba(216,166,84,0.32)] bg-[rgba(216,166,84,0.1)] p-4 sm:p-5 shadow-[0_14px_32px_rgba(20,18,28,0.06)]">
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

        <section className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6 shadow-[0_18px_44px_rgba(20,18,28,0.06)]">
          <div className="flex flex-col gap-4 border-b border-[var(--panel-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Fluxo do atendimento
              </p>
              <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                Depois do cadastro do equipamento, siga este fluxo
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                O cadastro do equipamento já foi feito. Agora o técnico deve seguir a ordem natural:
                triagem dos sintomas, diagnóstico assistido por IA, apoio à reparação e encerramento.
              </p>
            </div>
            <Link
              href={`/diagnosticos/${detail.id}?stage=${nextMaintenanceStage.id}#${nextMaintenanceStage.id}`}
              className="inline-flex rounded-full border border-[rgba(109,94,242,0.24)] bg-[rgba(109,94,242,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent-copper)]"
            >
              Ir para: {nextMaintenanceStage.title}
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {maintenanceStages.map((stage) => {
              const isDone = stage.status === "done";
              const isCurrent = activeStageId === stage.id;

              return (
                <Link
                  key={stage.id}
                  href={`/diagnosticos/${detail.id}?stage=${stage.id}#${stage.id}`}
                  className={`flex flex-col gap-3 rounded-xl sm:rounded-[22px] border p-4 transition sm:flex-row sm:items-center sm:justify-between ${
                    isDone
                      ? "border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)]"
                      : isCurrent
                        ? "border-[rgba(109,94,242,0.3)] bg-[rgba(109,94,242,0.12)]"
                        : "border-[var(--panel-border)] bg-[var(--background)] hover:border-[rgba(230,228,245,0.24)]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isDone
                            ? "bg-[rgba(45,139,130,0.16)] text-[var(--accent-teal)]"
                            : isCurrent
                              ? "bg-[rgba(109,94,242,0.18)] text-[var(--accent-copper)]"
                              : "bg-white/5 text-[var(--muted)]"
                        }`}
                      >
                        {stage.title.split(".")[0]}
                      </span>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{stage.title}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{stage.description}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                        isDone
                          ? "bg-[rgba(45,139,130,0.16)] text-[var(--accent-teal)]"
                          : isCurrent
                            ? "bg-[rgba(109,94,242,0.18)] text-[var(--accent-copper)]"
                            : "bg-white/5 text-[var(--muted)]"
                      }`}
                    >
                      {isDone ? "Concluído" : isCurrent ? "Agora" : "Depois"}
                    </span>
                    <span className="text-sm font-semibold text-[var(--accent-copper)]">
                      Abrir
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section
          className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--background)] p-4 sm:p-6 shadow-[0_14px_34px_rgba(20,18,28,0.05)]"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Agora faça isso
              </p>
              <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                {activeStageGuide.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {activeStageGuide.objective}
              </p>
              <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                Origem do fluxo: cadastro do equipamento concluído.
              </p>
            </div>
            <div className="rounded-xl sm:rounded-[20px] border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-[var(--foreground)]">
              Checklist {completedChecklistCount}/{activeStageGuide.checklist.length}
            </div>
          </div>

          <div className="mt-5 rounded-xl sm:rounded-[22px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">O que precisa acontecer nesta etapa</p>
            <ol className="mt-4 space-y-3">
              {activeStageGuide.checklist.map((item, index) => (
                <li key={item.label} className="flex items-start gap-3 text-sm">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      item.done
                        ? "bg-[rgba(45,139,130,0.16)] text-[var(--accent-teal)]"
                        : "bg-white/5 text-[var(--muted)]"
                    }`}
                  >
                    {item.done ? "OK" : index + 1}
                  </span>
                  <span className={item.done ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {!activeStageGuide.isReadyToAdvance ? (
            <div className="mt-5 rounded-xl sm:rounded-[22px] border border-[rgba(216,166,84,0.3)] bg-[rgba(216,166,84,0.1)] px-4 py-3 text-sm text-[var(--foreground)]">
              {activeStageGuide.blockedMessage}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-3">
              {previousStage ? (
                <Link
                  href={`/diagnosticos/${detail.id}?stage=${previousStage.id}#${previousStage.id}`}
                  className="inline-flex rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                >
                  Voltar para {previousStage.title}
                </Link>
              ) : null}

              {followingStage ? (
                activeStageGuide.isReadyToAdvance ? (
                  <Link
                    href={`/diagnosticos/${detail.id}?stage=${followingStage.id}#${followingStage.id}`}
                    className="inline-flex rounded-full border border-[rgba(109,94,242,0.24)] bg-[rgba(109,94,242,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent-copper)]"
                  >
                    {activeStageGuide.nextLabel}
                  </Link>
                ) : (
                  <span className="inline-flex rounded-full border border-dashed border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-2 text-sm font-semibold text-[var(--muted)]">
                    {activeStageGuide.nextLabel}
                  </span>
                )
              ) : (
                <span className="inline-flex rounded-full border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] px-4 py-2 text-sm font-semibold text-[var(--accent-teal)]">
                  {activeStageGuide.nextLabel}
                </span>
              )}
            </div>

            {!activeStageGuide.isReadyToAdvance && previousStage ? (
              <Link
                href={`/diagnosticos/${detail.id}?stage=${previousStage.id}#${previousStage.id}`}
                className="text-sm font-medium text-[var(--accent-copper)]"
              >
                Revisar etapa anterior
              </Link>
            ) : null}
          </div>
        </section>

        {activeStageId === "triagem" ? (
        <section id="triagem" className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,360px)]">
          <article className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6 shadow-[0_18px_44px_rgba(20,18,28,0.06)]">
            <div className="flex flex-col gap-4 border-b border-[var(--panel-border)] pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Contexto atual
                </p>
                <h3 className="mt-3 break-words font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--foreground)]">
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

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col justify-between rounded-xl sm:rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-4 sm:p-5">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                      Metadados
                    </p>
                    <Link
                      href={`/diagnosticos/${detail.id}/laudo`}
                      target="_blank"
                      className="rounded-full bg-[rgba(202,106,85,0.15)] hover:bg-[rgba(202,106,85,0.25)] border border-[var(--accent-copper)]/30 px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-[11px] font-semibold text-[var(--accent-copper)] tracking-tight transition-all whitespace-nowrap"
                    >
                      🖨️ Imprimir Laudo
                    </Link>
                  </div>
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

                {/* QR Code de Bancada */}
                <div className="mt-4 border-t border-[var(--panel-border)] pt-4 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(`https://consertospro.vercel.app/diagnosticos/${detail.id}`)}`}
                    alt="QR Code"
                    width={72}
                    height={72}
                    className="rounded-xl border border-white/10 bg-white p-1"
                  />
                  <div>
                    <p className="text-xs font-semibold text-white">QR Code de Bancada</p>
                    <p className="text-[10px] text-[var(--muted)] mt-0.5 leading-relaxed">
                      Escaneie para acompanhar ou anexar fotos pelo celular.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl sm:rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-4 sm:p-5">
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

          <aside className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-4 sm:p-6 text-white">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(230,228,245,0.56)]">
              Árvore de investigação · {detail.category}
            </p>
            <h3 className="mt-3 break-words font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-semibold tracking-tight">
              Fluxo dinâmico de bancada
            </h3>
            <ol className="mt-4 space-y-2">
              {detail.guidedFlow.map((step) => {
                const isSuccess = step.status === "success";
                const isFailed = step.status === "failed";
                const isInconclusive = step.status === "inconclusive";
                const isCurrent = step.status === "current";
                const isPending = step.status === "pending";

                let bulletClass = "border border-[rgba(230,228,245,0.2)] text-[rgba(230,228,245,0.4)]";
                let bulletContent = String(step.order);
                let titleClass = "text-white/40 font-medium";

                if (isSuccess) {
                  bulletClass = "bg-[var(--accent-teal)] text-white";
                  bulletContent = "✓";
                  titleClass = "text-[rgba(230,228,245,0.6)] line-through";
                } else if (isFailed) {
                  bulletClass = "bg-[var(--danger)] text-white";
                  bulletContent = "✗";
                  titleClass = "text-[rgba(230,228,245,0.6)] line-through font-medium";
                } else if (isInconclusive) {
                  bulletClass = "bg-[var(--accent-amber)] text-white";
                  bulletContent = "-";
                  titleClass = "text-[rgba(230,228,245,0.6)] line-through";
                } else if (isCurrent) {
                  bulletClass = "bg-[var(--accent-copper)] text-white animate-pulse shadow-[0_0_12px_rgba(109,94,242,0.5)]";
                  bulletContent = "➔";
                  titleClass = "text-white font-bold text-[15px]";
                } else if (isPending) {
                  bulletClass = "border border-[rgba(230,228,245,0.2)] text-[rgba(230,228,245,0.4)]";
                  bulletContent = String(step.order);
                  titleClass = "text-white/60";
                }

                return (
                  <li key={step.order} className={`flex items-start gap-3 p-2.5 rounded-2xl transition ${isCurrent ? "bg-white/5 border border-white/5 shadow-inner" : ""}`}>
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${bulletClass}`}
                    >
                      {bulletContent}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm tracking-tight ${titleClass}`}>
                          {step.label}
                        </p>
                        {isCurrent && (
                          <span className="shrink-0 rounded-md bg-[rgba(109,94,242,0.14)] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[var(--accent-copper)] border border-[rgba(109,94,242,0.25)]">
                            Recomendado
                          </span>
                        )}
                      </div>
                      <p className={`mt-1 text-xs leading-5 ${isCurrent ? "text-[rgba(230,228,245,0.85)]" : "text-[rgba(230,228,245,0.58)]"}`}>
                        {step.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </aside>
        </section>
        ) : null}

        {activeStageId === "investigacao" ? (
        <section id="investigacao" className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <article className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6 shadow-[0_18px_44px_rgba(20,18,28,0.06)]">
            <div className="flex flex-col gap-4 border-b border-[var(--panel-border)] pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Diagnóstico assistido
                </p>
                <h3 className="mt-2 break-words text-xl sm:text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                  IA para buscar causa, solução e próximo teste
                </h3>
                <p className="mt-2 break-words text-sm leading-6 text-[var(--muted)]">
                  Usa o histórico deste aparelho, memória filtrada e documentos técnicos para sugerir um passo objetivo por vez.
                </p>

                {/* Agente de IA Especialista Ativo */}
                <div className="mt-4 flex flex-col items-start gap-1.5 rounded-xl sm:rounded-[18px] border border-[var(--accent-teal)]/20 bg-[rgba(45,139,130,0.06)] p-3 text-white">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 shrink-0 rounded-full bg-[var(--accent-teal)] animate-pulse" />
                    <span className="font-mono text-xs uppercase tracking-wider text-[var(--accent-teal)] font-bold">
                      Agente Ativo: {detail.assistantSnapshot.activeAgent.name}
                    </span>
                  </div>
                  <p className="text-xs text-[rgba(230,228,245,0.7)] leading-relaxed">
                    {detail.assistantSnapshot.activeAgent.specialty}
                  </p>
                </div>
              </div>
              <form action={generateDiagnosticAssistantAction}>
                <input type="hidden" name="diagnostic_id" value={detail.id} />
                <FormSubmitButton
                  idleLabel={
                    detail.assistantSnapshot.latestResponse ? "Atualizar recomendação" : "Gerar recomendação"
                  }
                  pendingLabel={
                    detail.assistantSnapshot.latestResponse ? "Atualizando recomendação..." : "Gerando recomendação..."
                  }
                  className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:cursor-progress disabled:opacity-75"
                />
              </form>
            </div>

            {detail.assistantSnapshot.latestResponse ? (
              <div className="mt-5 grid gap-4">
                <div className="rounded-xl sm:rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-4 sm:p-5">
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

                  <div className="mt-4 rounded-xl sm:rounded-[22px] border border-[rgba(109,94,242,0.18)] bg-[var(--card-surface-soft)] p-3.5 sm:p-4">
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
                        href={`/diagnosticos/${detail.id}?stage=investigacao&ai_response_id=${detail.assistantSnapshot.latestResponse.id}&suggested_test_id=${detail.assistantSnapshot.latestResponse.structured.recommendedTestId}#registrar-teste`}
                        className="mt-4 inline-flex rounded-full border border-[rgba(109,94,242,0.24)] bg-[var(--card-surface)] px-4 py-2 text-sm font-semibold text-[var(--accent-copper)]"
                      >
                        Usar sugestão no formulário
                      </Link>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-xl sm:rounded-[22px] border border-[rgba(45,139,130,0.2)] bg-[rgba(45,139,130,0.08)] p-4 sm:p-5">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      Depois de executar o teste, registre o retorno da bancada
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Não precisa procurar na tela. Escolha abaixo exatamente o que você quer registrar agora.
                    </p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <Link
                        href="#registrar-teste"
                        className="inline-flex rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                      >
                        1. Resultado do teste
                      </Link>
                      <Link
                        href="#medicoes"
                        className="inline-flex rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                      >
                        2. Medição encontrada
                      </Link>
                      <Link
                        href="#registrar-sintoma"
                        className="inline-flex rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                      >
                        3. Novo sintoma observado
                      </Link>
                    </div>
                  </div>

                  <details className="mt-4 rounded-xl sm:rounded-[22px] border border-[var(--panel-border)] bg-[var(--card-surface-soft)] p-3.5 sm:p-4">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--foreground)]">
                      Ver detalhes avançados da IA e feedback
                    </summary>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">Evidências consideradas</p>
                        <div className="mt-2 space-y-2">
                          {(detail.assistantSnapshot.latestResponse.structured?.evidence ?? []).length ? (
                            (detail.assistantSnapshot.latestResponse.structured?.evidence ?? []).map((item) => (
                              <p
                                key={item}
                                className="rounded-xl sm:rounded-[18px] border border-[var(--panel-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted)]"
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

                    <div className="mt-4 rounded-xl sm:rounded-[18px] border border-[var(--panel-border)] bg-[var(--background)] p-3.5 sm:p-4">
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
                        <div className="mt-4 rounded-xl sm:rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface-soft)] p-3.5 sm:p-4 text-sm text-[var(--foreground)]">
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
                        <FormSubmitButton
                          idleLabel="Salvar feedback"
                          pendingLabel="Salvando feedback..."
                        />
                      </form>
                    </div>
                  </details>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl sm:rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-6 sm:px-5 sm:py-8 text-sm leading-6 text-[var(--muted)]">
                Ainda não existe recomendação salva para este caso. Gere a primeira leitura para registrar resumo técnico, hipótese dominante e próximo teste sugerido em `ai_responses`.
              </div>
            )}
          </article>

          <aside className="grid gap-4">
            <article className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                    Casos do mesmo aparelho
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">
                    Histórico técnico relacionado
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
                      className="block rounded-xl sm:rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-3.5 sm:p-4 hover:border-[rgba(109,94,242,0.3)]"
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
                    Ainda não encontramos casos do mesmo fabricante/modelo fortes o bastante para este equipamento.
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                    Esquemas e documentos
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">
                    Apoio técnico da placa
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
                      className="block rounded-xl sm:rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-3.5 sm:p-4 hover:border-[rgba(109,94,242,0.3)]"
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
                    Ainda não há esquema ou documento técnico recuperado para ajudar nesta reparação.
                  </div>
                )}
              </div>
            </article>
          </aside>
        </section>
        ) : null}

        {activeStageId === "triagem" || activeStageId === "investigacao" ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {activeStageId === "triagem" ? (
          <article
            id="triagem-panel"
            className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6"
          >
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
              <FormSubmitButton
                idleLabel="Adicionar sintoma"
                pendingLabel="Salvando sintoma..."
              />
            </form>

            <div className="mt-3">
              <CatalogShortcutLinks
                title="Faltou um sintoma?"
                items={[
                  { href: "/catalogo-tecnico?tab=sintomas", label: "Cadastrar sintoma" },
                  { href: "/catalogo-tecnico?tab=categorias", label: "Cadastrar categoria" },
                ]}
              />
            </div>

            <div className="mt-5 space-y-3">
              {detail.symptoms.length ? (
                detail.symptoms.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl sm:rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-3.5 sm:p-4"
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
          ) : null}

          {activeStageId === "investigacao" ? (
          <article
            id="registrar-teste"
            className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6"
          >
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              1. Resultado do teste
            </p>
            <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              O que aconteceu ao executar o teste
            </h3>
            {requestedByAiResponseId && detail.assistantSnapshot.latestResponse ? (
              <div className="mt-4 rounded-[22px] border border-[rgba(109,94,242,0.24)] bg-[rgba(109,94,242,0.08)] p-4 text-sm text-[var(--foreground)]">
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
                placeholder="O que você fez no teste"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <textarea
                name="actual_result"
                rows={3}
                placeholder="O que aconteceu no teste? Ex.: sem 3.3V, consumo 0.02A, não ligou"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
              />
              <FormSubmitButton
                idleLabel="Registrar teste"
                pendingLabel="Salvando teste..."
              />
            </form>

            <div className="mt-3">
              <CatalogShortcutLinks
                title="Faltou um teste?"
                items={[
                  { href: "/catalogo-tecnico?tab=testes", label: "Cadastrar teste" },
                  { href: "/catalogo-tecnico?tab=componentes", label: "Cadastrar componente" },
                ]}
              />
            </div>

            <div className="mt-5 space-y-3">
              {detail.tests.length ? (
                detail.tests.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl sm:rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-3.5 sm:p-4"
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
          ) : null}

          {activeStageId === "investigacao" ? (
          <article
            id="hipoteses"
            className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6"
          >
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              3. Novo sintoma ou hipótese
            </p>
            <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Registrar nova observação da bancada
            </h3>

            <div
              id="registrar-sintoma"
              className="mt-5 rounded-xl sm:rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4 sm:p-5"
            >
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Se apareceu um comportamento novo no aparelho, registre aqui
              </p>
              <form action={addDiagnosticSymptomAction} className="mt-4 grid gap-3">
                <input type="hidden" name="diagnostic_id" value={detail.id} />
                <select
                  required
                  name="symptom_id"
                  defaultValue=""
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm outline-none"
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
                  placeholder="Contexto do sintoma. Ex.: não ligou, sem imagem, consumo subiu"
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm outline-none"
                />
                <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
                  <input type="checkbox" name="is_primary" />
                  Marcar como sintoma principal
                </label>
                <FormSubmitButton
                  idleLabel="Registrar sintoma observado"
                  pendingLabel="Salvando sintoma..."
                />
              </form>
            </div>

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
                detail.hypotheses.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl sm:rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-3.5 sm:p-4"
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
          ) : null}

          {activeStageId === "investigacao" ? (
          <article
            id="medicoes"
            className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6"
          >
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              2. Medição encontrada
            </p>
            <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Registrar tensão, corrente ou resistência
            </h3>
            <div className="mt-5">
              <MeasurementForm diagnosticId={detail.id} />
            </div>

            <div className="mt-5 space-y-3">
              {detail.measurements.length ? (
                detail.measurements.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl sm:rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-3.5 sm:p-4"
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
          ) : null}
        </section>
        ) : null}

        {/* Medições de Referência de Bancada */}
        {activeStageId === "evidencias" && detail.boards.length > 0 ? (
          <section id="evidencias" className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Valores de Referência
            </p>
            <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Banco de Medições de Placa
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Valores esperados (tensão, resistência, impedância) para comparação rápida.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
              {/* Tabela de Medições existentes */}
              <div>
                {detail.referenceMeasurements.length > 0 ? (
                  <div className="overflow-x-auto animate-fadeIn">
                    <table className="w-full text-left text-sm text-[var(--foreground)] border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--panel-border)] text-xs font-mono uppercase text-[var(--muted)]">
                          <th className="py-3 px-2">Componente</th>
                          <th className="py-3 px-2">Ponto</th>
                          <th className="py-3 px-2">Valor Esperado</th>
                          <th className="py-3 px-2">Estado da Placa</th>
                          <th className="py-3 px-2">Nota / Autor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.referenceMeasurements.map((m) => (
                          <tr key={m.id} className="border-b border-[var(--panel-border)]/40 hover:bg-white/5">
                            <td className="py-3 px-2 font-semibold text-[var(--accent-copper)]">{m.componentRef}</td>
                            <td className="py-3 px-2">{m.measurementPoint}</td>
                            <td className="py-3 px-2 font-mono text-[var(--accent-teal)] font-semibold">{m.expectedValue}</td>
                            <td className="py-3 px-2">
                              <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] uppercase font-semibold text-[rgba(230,228,245,0.6)]">
                                {m.condition === "power_off" ? "Sem Alimentação" : m.condition === "power_on" ? "Placa Ligada" : "Escala de Diodo"}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-xs text-[var(--muted)]">
                              {m.notes && <span className="block italic text-[var(--foreground)] mb-0.5">{m.notes}</span>}
                              Por {m.userName} • {m.createdAt}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-5 text-sm text-[var(--muted)]">
                    Nenhuma medição de referência registrada para esta placa ainda. Seja o primeiro a registrar!
                  </p>
                )}
              </div>

              {/* Formulário para Adicionar Medição */}
              <div className="rounded-xl sm:rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-4 sm:p-5">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  Nova Medição de Referência
                </p>
                <div className="mt-3.5">
                  <BoardMeasurementForm diagnosticId={detail.id} boards={detail.boards} />
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeStageId === "evidencias" ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <article className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6">
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
                    className="rounded-xl sm:rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-3.5 sm:p-4"
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

          <article className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6">
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
                <p className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-5 text-sm text-[var(--muted)]">
                  Nenhum anexo enviado ainda.
                </p>
              )}
            </div>
          </article>

        </section>
        ) : null}

        {activeStageId === "encerramento" ? (
        <section id="encerramento">
          <article className="rounded-2xl sm:rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Encerramento
            </p>
            <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Consolidar causa e solução
            </h3>

            {detail.resolvedCase ? (
              <div className="mt-5 rounded-xl sm:rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4 sm:p-5">
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
        ) : null}

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
