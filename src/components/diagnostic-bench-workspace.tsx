import Link from "next/link";
import type { ReactNode } from "react";

import {
  addDiagnosticTestAction,
  generateDiagnosticAssistantAction,
} from "@/app/actions";
import { ChatCostMeter, ChatCostWarning } from "@/components/chat-cost-meter";
import { ChatMessageBubble } from "@/components/chat-message-bubble";
import { ChatScrollArea } from "@/components/chat-scroll-area";
import { DiagnosticBiosPanel } from "@/components/diagnostic-bios-panel";
import { DiagnosticChatComposer } from "@/components/diagnostic-chat-composer";
import { DiagnosticClosureForm } from "@/components/diagnostic-closure-form";
import { DiagnosticTechnicalAssetAssociation } from "@/components/diagnostic-technical-asset-association";
import { FormSubmitButton } from "@/components/form-submit-button";
import { MeasurementForm } from "@/components/measurement-form";
import { StatusPill } from "@/components/status-pill";
import type { DiagnosticBiosData } from "@/lib/services/bios-dumps";
import { isBoardviewFileFormat } from "@/lib/technical-assets.mjs";
import type {
  CatalogOption,
  DiagnosticDetail,
  EquipmentModelCatalogOption,
  SymptomOption,
  TestOption,
} from "@/types/domain";

type DiagnosticBenchWorkspaceProps = {
  detail: DiagnosticDetail;
  biosData: DiagnosticBiosData;
  options: {
    symptoms: SymptomOption[];
    tests: TestOption[];
  };
  catalog: {
    boards: CatalogOption[];
    models: EquipmentModelCatalogOption[];
    manufacturers: CatalogOption[];
  };
  prefillMeasurement?: {
    pointLabel?: string;
    expectedValueText?: string;
    measurementType?: string;
  };
};

function buildAssetHref(
  detail: DiagnosticDetail,
  assetId: string,
  view: "boardview" | "schematic",
) {
  const primaryBoard = detail.boards.find((board) => board.isPrimary) ?? detail.boards[0] ?? null;
  const params = new URLSearchParams({
    diagnostic_id: detail.id,
    view,
  });

  if (detail.modelId) {
    params.set("model_id", detail.modelId);
  }

  if (primaryBoard?.boardId) {
    params.set("board_id", primaryBoard.boardId);
  }

  if (view === "boardview") {
    params.set("boardview_asset_id", assetId);
  } else {
    params.set("schematic_asset_id", assetId);
  }

  return `/boardview/lab?${params.toString()}`;
}

function appendLabContext(
  href: string,
  params: Record<string, string | null | undefined>,
) {
  const url = new URL(href, "http://localhost");

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return `${url.pathname}?${url.searchParams.toString()}`;
}

function inferBoardviewSide(locationSummary: string | null | undefined) {
  const normalized = (locationSummary ?? "").toLowerCase();

  if (normalized.includes("top")) {
    return "top";
  }

  if (normalized.includes("bottom")) {
    return "bottom";
  }

  return null;
}

type NetRow = {
  key: string;
  name: string;
  expectedVoltage: string | null;
  measurementPoint: string | null;
  note: string | null;
  boardviewHref: string | null;
  boardviewLabel: string | null;
};

function stripBoardviewCoordinates(value: string) {
  return value.replace(/\s*em\s+[\d.]+\s*mil\s*x\s*[\d.]+\s*mil/i, "").trim();
}

function normalizeNetKey(value: string) {
  return value.trim().toLowerCase();
}

function buildNetRows(
  relatedLines: Array<{ name: string; expectedVoltage: string; note: string }>,
  componentsToMeasure: Array<{
    reference: string;
    measurementPoint: string;
    expectedValue: string;
    note: string;
  }>,
  boardviewResults: Array<{
    kind: "component" | "net";
    title: string;
    locationSummary?: string;
    coordinateHint?: string | null;
    openLabHref: string;
  }>,
): NetRow[] {
  const rows = new Map<string, NetRow>();

  for (const line of relatedLines) {
    const key = normalizeNetKey(line.name);
    rows.set(key, {
      key,
      name: line.name,
      expectedVoltage: line.expectedVoltage || null,
      measurementPoint: null,
      note: line.note || null,
      boardviewHref: null,
      boardviewLabel: null,
    });
  }

  for (const item of componentsToMeasure) {
    const key = normalizeNetKey(item.reference);
    const existing = rows.get(key);
    if (existing) {
      existing.measurementPoint = item.measurementPoint || existing.measurementPoint;
      existing.expectedVoltage = existing.expectedVoltage ?? (item.expectedValue || null);
      existing.note = existing.note ?? (item.note || null);
    } else {
      rows.set(key, {
        key,
        name: item.reference,
        expectedVoltage: item.expectedValue || null,
        measurementPoint: item.measurementPoint || null,
        note: item.note || null,
        boardviewHref: null,
        boardviewLabel: null,
      });
    }
  }

  for (const result of boardviewResults) {
    const key = normalizeNetKey(result.title);
    const href = appendLabContext(result.openLabHref, {
      component: result.kind === "component" ? result.title : null,
      net: result.kind === "net" ? result.title : null,
      side: inferBoardviewSide(result.locationSummary),
    });
    const label = result.kind === "net" ? "Abrir no boardview" : "Abrir componente";
    const existing = rows.get(key);

    if (existing) {
      existing.boardviewHref = href;
      existing.boardviewLabel = label;
      existing.measurementPoint = existing.measurementPoint ?? result.coordinateHint ?? null;
    } else {
      rows.set(key, {
        key,
        name: result.title,
        expectedVoltage: null,
        measurementPoint: result.coordinateHint ?? null,
        note: result.locationSummary ?? null,
        boardviewHref: href,
        boardviewLabel: label,
      });
    }
  }

  return Array.from(rows.values());
}

function getEquipmentDetailValue(detail: DiagnosticDetail, label: string) {
  return detail.equipmentDetails.find((item) => item.label === label)?.value ?? "Não informado";
}

function getAssetAssociationHref(
  detail: DiagnosticDetail,
  asset: DiagnosticDetail["technicalAssets"][number],
) {
  if (asset.fileFormat === "pdf") {
    return asset.boardviewLabHref ?? buildAssetHref(detail, asset.id, "schematic");
  }

  return asset.boardviewLabHref ?? buildAssetHref(detail, asset.id, "boardview");
}

// Boardview e esquema abrem numa aba propria do caso, para o tecnico ver o
// laboratorio e o chat ao mesmo tempo. Com o mesmo nome de aba, cliques
// seguintes (outro componente, outra pagina) reaproveitam essa aba.
function labTabTarget(diagnosticId: string) {
  return `laboratorio-${diagnosticId}`;
}

function ActionLink({
  href,
  label,
  tone = "default",
  target,
}: {
  href: string;
  label: string;
  tone?: "default" | "primary";
  target?: string;
}) {
  return (
    <Link
      href={href}
      target={target}
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


const hypothesisStatusLabels: Record<string, string> = {
  open: "Aberta",
  strengthened: "Fortalecida",
  weakened: "Enfraquecida",
  discarded: "Descartada",
  confirmed: "Confirmada",
};

const testResultLabels: Record<string, string> = {
  pending: "aguardando",
  passed: "passou",
  failed: "falhou",
  inconclusive: "inconclusivo",
};

function PanelSection({
  id,
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  id?: string;
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group scroll-mt-24 rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[var(--foreground)]">{title}</span>
          {hint ? <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{hint}</span> : null}
        </span>
        <svg
          className="h-4 w-4 shrink-0 text-[var(--muted)] transition group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="min-w-0 border-t border-[var(--panel-border)] p-4 [overflow-wrap:anywhere]">{children}</div>
    </details>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-[var(--muted)]">{label}</span>
      <span className="min-w-0 text-right text-[var(--foreground)] [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

export function DiagnosticBenchWorkspace({
  detail,
  biosData,
  options,
  catalog,
  prefillMeasurement,
}: DiagnosticBenchWorkspaceProps) {
  const primaryBoard = detail.boards.find((board) => board.isPrimary) ?? detail.boards[0] ?? null;
  const latestResponse = detail.assistantSnapshot.latestResponse;
  const structured = latestResponse?.structured ?? null;
  const technicalContext = structured?.technicalContext ?? null;
  const boardviewAsset =
    detail.technicalAssets.find((asset) => isBoardviewFileFormat(asset.fileFormat, asset.title)) ??
    null;
  const schematicAsset =
    detail.technicalAssets.find((asset) => asset.fileFormat === "pdf") ?? null;
  const boardviewHref = boardviewAsset ? getAssetAssociationHref(detail, boardviewAsset) : null;
  const schematicHref = schematicAsset ? getAssetAssociationHref(detail, schematicAsset) : null;
  const intakePower = getEquipmentDetailValue(detail, "Alimentação");
  const intakeBoots = getEquipmentDetailValue(detail, "Liga");
  const intakeScreen = getEquipmentDetailValue(detail, "Condição da tela");
  const probableDiagnosis =
    structured?.probableDiagnosis ?? structured?.mainHypothesis ?? "Sem diagnóstico provável consolidado.";
  const probableArea = structured?.probableSection ?? structured?.probableArea ?? "Setor ainda não isolado.";
  const relatedLines = structured?.relatedLines ?? [];
  const componentsToMeasure = structured?.componentsToMeasure ?? [];
  const recommendedSequence = structured?.recommendedTestSequence ?? [];
  const limitations = structured?.limitations ?? technicalContext?.limitations ?? [];
  const hasTechnicalFiles = Boolean(boardviewAsset || schematicAsset);
  const netRows = buildNetRows(
    relatedLines,
    componentsToMeasure,
    technicalContext?.boardview?.results ?? [],
  );
  const activeHypotheses = detail.hypotheses.filter(
    (item) => item.status !== "discarded" && item.status !== "weakened",
  );
  const otherHypotheses = detail.hypotheses.filter(
    (item) => item.status === "discarded" || item.status === "weakened",
  );
  const agentName = detail.assistantSnapshot.activeAgent.name;
  // Na tela fica so a ultima troca (ultima mensagem do tecnico + resposta da IA);
  // a conversa inteira fica em /diagnosticos/[id]/historico.
  const lastUserIndex = detail.chatMessages.map((entry) => entry.role).lastIndexOf("user");
  const visibleMessages =
    lastUserIndex >= 0 ? detail.chatMessages.slice(lastUserIndex) : detail.chatMessages.slice(-1);
  const hiddenMessageCount = detail.chatMessages.length - visibleMessages.length;
  const hasPrefill = Boolean(prefillMeasurement?.pointLabel || prefillMeasurement?.measurementType);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      {/* ── Conversa ─────────────────────────────────────────────── */}
      <section
        id="chat-bancada"
        className="flex scroll-mt-4 flex-col rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] sm:rounded-[28px]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--panel-border)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {agentName}
              <ChatCostMeter diagnosticId={detail.id} cost={detail.chatCost} />
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
              Converse como num chat: diga o que mediu, mande fotos, pergunte o próximo passo.
            </p>
          </div>
          {hasTechnicalFiles ? (
            <div className="flex gap-2">
              {boardviewHref ? <ActionLink href={boardviewHref} label="Boardview" target={labTabTarget(detail.id)} /> : null}
              {schematicHref ? <ActionLink href={schematicHref} label="Esquema" target={labTabTarget(detail.id)} /> : null}
            </div>
          ) : null}
        </div>

        {hiddenMessageCount ? (
          <Link
            href={`/diagnosticos/${detail.id}/historico`}
            className="mx-3 mt-3 flex items-center justify-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:border-[rgba(109,94,242,0.45)] sm:mx-5"
          >
            📜 Ver conversa anterior ({hiddenMessageCount})
          </Link>
        ) : null}

        <ChatScrollArea
          messageCount={detail.chatMessages.length}
          className="flex min-h-[240px] flex-col gap-4 px-3 py-4 sm:px-5 lg:max-h-[calc(100dvh-300px)] lg:min-h-[320px] lg:overflow-y-auto"
        >
          {visibleMessages.length ? (
            visibleMessages.map((entry) => <ChatMessageBubble key={entry.id} entry={entry} agentName={agentName} />)
          ) : (
            <div className="m-auto max-w-md py-10 text-center text-sm leading-6 text-[var(--muted)]">
              <p className="text-base font-semibold text-[var(--foreground)]">Comece a conversa</p>
              <p className="mt-2">
                Conte o defeito, o que já mediu e mande uma foto da placa. A IA sugere o próximo
                teste e vai registrando medições e hipóteses no caso.
              </p>
            </div>
          )}
        </ChatScrollArea>

        <div className="chat-composer-sticky sticky z-30 rounded-b-2xl border-t border-[var(--panel-border)] bg-[var(--card-surface)] p-3 sm:rounded-b-[28px] sm:p-4 lg:static">
          <ChatCostWarning diagnosticId={detail.id} cost={detail.chatCost} />
          <DiagnosticChatComposer
            diagnosticId={detail.id}
            costLimitReached={
              detail.chatCost.level === "over"
                ? { totalUsd: detail.chatCost.totalUsd, limitUsd: detail.chatCost.limitUsd }
                : null
            }
            defaultMessage={detail.chatMessages.length ? undefined : detail.initialReport}
          />
        </div>
      </section>

      {/* ── Painel do caso ───────────────────────────────────────── */}
      <aside className="grid min-w-0 grid-cols-1 gap-3">
        {detail.preventiveInsight ? (
          <div className="rounded-2xl border border-[rgba(216,166,84,0.32)] bg-[rgba(216,166,84,0.1)] p-4 text-sm leading-6 text-[var(--foreground)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-amber)]">
              Atenção
            </p>
            <p className="mt-1">
              {detail.preventiveInsight.occurrences} de {detail.preventiveInsight.totalCases} casos deste
              modelo tiveram como causa{" "}
              <span className="font-semibold">&quot;{detail.preventiveInsight.causeLabel}&quot;</span>
              {detail.preventiveInsight.componentRef
                ? ` (mais em ${detail.preventiveInsight.componentRef})`
                : ""}
              .
            </p>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] p-4">
          <div className="flex flex-wrap gap-2">
            <StatusPill label={detail.status} />
            <StatusPill label={detail.category} />
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Defeito relatado
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--foreground)]">{detail.initialReport}</p>
        </div>

        {activeHypotheses.length ? (
          <PanelSection
            title="Hipóteses"
            hint={activeHypotheses[0]?.title}
            defaultOpen
          >
            <ul className="grid gap-3">
              {activeHypotheses.map((item) => (
                <li key={item.id} className="text-sm leading-6">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-[var(--foreground)]">{item.title}</p>
                    <StatusPill label={hypothesisStatusLabels[item.status] ?? item.status} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">{item.createdAt}</p>
                </li>
              ))}
            </ul>
            {otherHypotheses.length ? (
              <details className="mt-3 text-xs text-[var(--muted)]">
                <summary className="cursor-pointer">
                  {otherHypotheses.length} descartada(s) ou enfraquecida(s)
                </summary>
                <ul className="mt-2 grid gap-1.5">
                  {otherHypotheses.map((item) => (
                    <li key={item.id} className="line-through">{item.title}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </PanelSection>
        ) : null}

        {detail.measurements.length ? (
          <PanelSection
            title={`Medições (${detail.measurements.length})`}
            hint={`${detail.measurements[0].pointLabel}: ${detail.measurements[0].measuredValue}`}
          >
            <ul className="grid gap-2">
              {detail.measurements.map((item) => (
                <li
                  key={item.id}
                  className="border-b border-[var(--panel-border)] pb-2 text-sm last:border-b-0 last:pb-0 [overflow-wrap:anywhere]"
                >
                  {/* Ponto em cima e valor embaixo: a IA grava textos longos nos dois. */}
                  <p className="text-xs leading-5 text-[var(--muted)]">{item.pointLabel}</p>
                  <p
                    className={`mt-0.5 whitespace-pre-wrap font-mono leading-5 ${item.isOutOfRange ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}
                  >
                    {item.measuredValue}
                  </p>
                </li>
              ))}
            </ul>
          </PanelSection>
        ) : null}

        <PanelSection
          id="associar-ativos-tecnicos"
          title="Placa, boardview e esquema"
          hint={
            hasTechnicalFiles
              ? `${primaryBoard?.name ?? detail.model} • ${detail.technicalAssets.length} arquivo(s)`
              : "Nenhum arquivo associado ainda"
          }
        >
          {hasTechnicalFiles ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {boardviewHref ? <ActionLink href={boardviewHref} label="Abrir boardview" tone="primary" target={labTabTarget(detail.id)} /> : null}
              {schematicHref ? <ActionLink href={schematicHref} label="Abrir esquema" target={labTabTarget(detail.id)} /> : null}
            </div>
          ) : (
            <p className="mb-4 text-sm leading-6 text-[var(--muted)]">
              Associe o boardview e o esquema para a IA citar pontos e test points exatos. Sem
              eles a IA trabalha pelo método e pede a serigrafia da placa.
            </p>
          )}
          <DiagnosticTechnicalAssetAssociation
            diagnosticId={detail.id}
            manufacturerId={detail.manufacturerId}
            currentBoardId={primaryBoard?.boardId ?? null}
            currentModelId={detail.modelId}
            currentAssets={detail.technicalAssets}
            boards={catalog.boards}
            models={catalog.models}
            manufacturers={catalog.manufacturers}
          />
        </PanelSection>

        <PanelSection
          id="bios"
          title="BIOS (gravador)"
          hint={
            biosData.dumps.length
              ? `${biosData.dumps.length} dump(s) • agente ${biosData.agentOnline ? "online" : "offline"}`
              : `Ler, guardar e gravar a BIOS • agente ${biosData.agentOnline ? "online" : "offline"}`
          }
          defaultOpen={biosData.jobs.some((job) => ["pending", "claimed", "running"].includes(job.status))}
        >
          <DiagnosticBiosPanel diagnosticId={detail.id} data={biosData} />
        </PanelSection>

        <PanelSection title="Dados do aparelho" hint={`${detail.manufacturer} • ${detail.model}`}>
          <div className="divide-y divide-[var(--panel-border)]">
            <InfoRow label="Fabricante" value={detail.manufacturer} />
            <InfoRow label="Modelo" value={detail.model} />
            <InfoRow label="Série" value={detail.serialNumber} />
            <InfoRow label="Placa" value={primaryBoard?.name ?? "Não informada"} />
            <InfoRow label="Alimentação" value={intakePower} />
            <InfoRow label="Liga" value={intakeBoots} />
            <InfoRow label="Tela" value={intakeScreen} />
            <InfoRow label="Estado físico" value={detail.physicalNotes} />
            <InfoRow label="Aberto por" value={`${detail.openedBy} • ${detail.createdAt}`} />
          </div>
        </PanelSection>

        <PanelSection
          id="registrar-medicao"
          title="Registrar medição manualmente"
          hint="A IA já registra o que você diz no chat"
          defaultOpen={hasPrefill}
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
            suggestedTestId={structured?.recommendedTestId ?? undefined}
            activeScenarioTitle={structured?.probableArea ?? undefined}
            initialPointLabel={prefillMeasurement?.pointLabel}
            initialExpectedValueText={prefillMeasurement?.expectedValueText}
            initialMeasurementType={prefillMeasurement?.measurementType}
          />
        </PanelSection>

        <PanelSection
          id="registrar-teste"
          title="Registrar teste feito"
          hint={
            detail.tests[0]
              ? `Último: ${detail.tests[0].testName} • ${testResultLabels[detail.tests[0].resultStatus] ?? detail.tests[0].resultStatus}`
              : undefined
          }
        >
          <form action={addDiagnosticTestAction} className="grid gap-3">
            <input type="hidden" name="diagnostic_id" value={detail.id} />
            <input type="hidden" name="requested_by_ai_response_id" value={latestResponse?.id ?? ""} />
            <input type="hidden" name="diagnostic_board_id" value={primaryBoard?.id ?? ""} />
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Teste executado
              <select
                required
                name="test_id"
                defaultValue={structured?.recommendedTestId ?? ""}
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
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
            </label>
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              O que aconteceu
              <textarea
                required
                name="actual_result"
                rows={3}
                placeholder="Ex.: DC-IN estabilizou em 19.8V, sem quedas"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
              />
            </label>
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Resultado
              <select
                name="result_status"
                defaultValue="pending"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
              >
                <option value="pending">Aguardando teste</option>
                <option value="passed">Passou</option>
                <option value="failed">Falhou</option>
                <option value="inconclusive">Inconclusivo</option>
              </select>
            </label>
            <FormSubmitButton idleLabel="Registrar teste" pendingLabel="Salvando teste..." />
          </form>
        </PanelSection>

        <PanelSection
          id="encerrar-diagnostico"
          title={detail.resolvedCase ? "Caso encerrado" : "Encerrar diagnóstico"}
          hint={detail.resolvedCase ? detail.resolvedCase.caseStatus : "Quando a causa e a solução estiverem claras"}
          defaultOpen={Boolean(detail.resolvedCase)}
        >
          {detail.resolvedCase ? (
            <div>
              <div className="flex flex-wrap gap-2">
                <StatusPill label={detail.resolvedCase.caseStatus} />
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {detail.resolvedCase.resolutionSummary}
              </p>
              <div className="mt-3 divide-y divide-[var(--panel-border)]">
                <InfoRow label="Resultado" value={detail.resolvedCase.repairOutcome} />
                {detail.resolvedCase.finalFailureMode ? (
                  <InfoRow label="Modo de falha" value={detail.resolvedCase.finalFailureMode} />
                ) : null}
              </div>
              {detail.resolvedCase.cause ? (
                <div className="mt-3 text-sm leading-6">
                  <p className="font-semibold text-[var(--foreground)]">Causa: {detail.resolvedCase.cause.title}</p>
                  <p className="text-[var(--muted)]">{detail.resolvedCase.cause.explanation}</p>
                </div>
              ) : null}
              {detail.resolvedCase.solution ? (
                <div className="mt-3 text-sm leading-6">
                  <p className="font-semibold text-[var(--foreground)]">Solução: {detail.resolvedCase.solution.title}</p>
                  <p className="whitespace-pre-wrap text-[var(--muted)]">{detail.resolvedCase.solution.procedure}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <DiagnosticClosureForm diagnosticId={detail.id} />
          )}
        </PanelSection>

        <PanelSection
          title="Parecer técnico estruturado"
          hint={latestResponse ? `Atualizado ${latestResponse.createdAt}` : "Resumo com tensões, testes e pontos de medição"}
        >
          <form action={generateDiagnosticAssistantAction} className="mb-4">
            <input type="hidden" name="diagnostic_id" value={detail.id} />
            <input type="hidden" name="assistant_prompt" value="" />
            <FormSubmitButton
              idleLabel={latestResponse ? "Atualizar parecer" : "Gerar parecer"}
              pendingLabel="Consultando a IA..."
              className="rounded-full border border-[var(--panel-border)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[rgba(109,94,242,0.4)] disabled:opacity-60"
            />
          </form>

          {latestResponse ? (
            <div className="grid gap-4 text-sm leading-6">
              <div>
                <p className="font-semibold text-[var(--foreground)]">{probableDiagnosis}</p>
                <p className="text-[var(--muted)]">Setor: {probableArea}</p>
                <p className="mt-2 text-[var(--muted)]">
                  {structured?.technicalSummary ?? latestResponse.reasoningSummary}
                </p>
              </div>

              <div>
                <p className="font-semibold text-[var(--foreground)]">
                  Próximo passo: {structured?.nextTest ?? latestResponse.recommendedNextStep}
                </p>
                {recommendedSequence.length ? (
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-[var(--muted)]">
                    {recommendedSequence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                ) : null}
                {structured?.safetyNote ? (
                  <p className="mt-2 text-[var(--danger)]">Segurança: {structured.safetyNote}</p>
                ) : null}
              </div>

              {netRows.length ? (
                <div>
                  <p className="font-semibold text-[var(--foreground)]">Onde medir</p>
                  <ul className="mt-2 grid gap-2">
                    {netRows.map((row) => (
                      <li key={row.key} className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block break-words font-mono text-xs text-[var(--foreground)]">{row.name}</span>
                          {row.measurementPoint ? (
                            <span className="block text-xs text-[var(--muted)]">
                              {stripBoardviewCoordinates(row.measurementPoint)}
                            </span>
                          ) : null}
                        </span>
                        {row.boardviewHref ? (
                          <Link
                            href={row.boardviewHref}
                            target={labTabTarget(detail.id)}
                            className="shrink-0 text-xs font-semibold text-[var(--accent-copper)] hover:underline"
                          >
                            Ver
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {technicalContext?.schematic?.matches.length ? (
                <div>
                  <p className="font-semibold text-[var(--foreground)]">Esquema</p>
                  <ul className="mt-2 grid gap-2">
                    {technicalContext.schematic.matches.map((match) => (
                      <li key={`${match.term}-${match.pageNumber}`}>
                        <Link
                          href={appendLabContext(match.openLabHref, { page: String(match.pageNumber) })}
                          target={labTabTarget(detail.id)}
                          className="text-xs text-[var(--accent-copper)] hover:underline"
                        >
                          {match.term} • página {match.pageNumber}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {limitations.length ? (
                <details className="text-xs text-[var(--muted)]">
                  <summary className="cursor-pointer">Limitações ({limitations.length})</summary>
                  <ul className="mt-2 grid gap-1">
                    {limitations.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </PanelSection>

        <PanelSection
          id="historico-bancada"
          title="Histórico completo"
          hint={`${detail.timeline.length} evento(s)`}
        >
          {detail.timeline.length ? (
            <ol className="grid gap-3">
              {detail.timeline.map((item) => (
                <li key={item.id} className="border-l-2 border-[var(--panel-border)] pl-3 text-sm">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--accent-copper)]">
                    {item.kind} • {item.happenedAt}
                  </p>
                  <p className="mt-0.5 font-medium text-[var(--foreground)]">{item.title}</p>
                  <p className="mt-0.5 line-clamp-3 text-xs leading-5 text-[var(--muted)]">{item.description}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-[var(--muted)]">Ainda não há eventos registrados.</p>
          )}
        </PanelSection>
      </aside>
    </div>
  );
}
