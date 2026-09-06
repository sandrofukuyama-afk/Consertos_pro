import Link from "next/link";
import type { ReactNode } from "react";

import {
  addDiagnosticTestAction,
  generateDiagnosticAssistantAction,
} from "@/app/actions";
import { DiagnosticClosureForm } from "@/components/diagnostic-closure-form";
import { DiagnosticTechnicalAssetAssociation } from "@/components/diagnostic-technical-asset-association";
import { FormSubmitButton } from "@/components/form-submit-button";
import { MeasurementForm } from "@/components/measurement-form";
import { StatusPill } from "@/components/status-pill";
import { formatProviderLabel } from "@/lib/utils";
import type {
  CatalogOption,
  DiagnosticDetail,
  EquipmentModelCatalogOption,
  SymptomOption,
  TestOption,
} from "@/types/domain";

type DiagnosticBenchWorkspaceProps = {
  detail: DiagnosticDetail;
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

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function ResponseBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function DiagnosticBenchWorkspace({
  detail,
  options,
  catalog,
  prefillMeasurement,
}: DiagnosticBenchWorkspaceProps) {
  const primaryBoard = detail.boards.find((board) => board.isPrimary) ?? detail.boards[0] ?? null;
  const latestTest = detail.tests[0] ?? null;
  const latestMeasurement = detail.measurements[0] ?? null;
  const latestResponse = detail.assistantSnapshot.latestResponse;
  const structured = latestResponse?.structured ?? null;
  const technicalContext = structured?.technicalContext ?? null;
  const boardviewAsset =
    detail.technicalAssets.find((asset) => asset.fileFormat === "brd" || asset.fileFormat === "bdv") ??
    null;
  const schematicAsset =
    detail.technicalAssets.find((asset) => asset.fileFormat === "pdf") ?? null;
  const boardviewHref = boardviewAsset
    ? buildAssetHref(detail, boardviewAsset.id, "boardview")
    : null;
  const schematicHref = schematicAsset
    ? buildAssetHref(detail, schematicAsset.id, "schematic")
    : null;
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
  const needsTechnicalAssociation = !primaryBoard?.boardId || detail.technicalAssets.length === 0;
  const netRows = buildNetRows(
    relatedLines,
    componentsToMeasure,
    technicalContext?.boardview?.results ?? [],
  );

  return (
    <div className="grid gap-4">
      {detail.preventiveInsight ? (
        <section className="rounded-2xl border border-[rgba(216,166,84,0.32)] bg-[rgba(216,166,84,0.1)] p-4 sm:rounded-[26px] sm:p-5">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-amber)]">
            Atenção preventiva
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
            {detail.preventiveInsight.occurrences} de {detail.preventiveInsight.totalCases} casos anteriores deste modelo tiveram como causa confirmada{" "}
            <span className="font-semibold">&quot;{detail.preventiveInsight.causeLabel}&quot;</span>
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
        description="Leitura compacta do aparelho, do defeito relatado e do estado atual da análise."
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
            <p>
              Placa: {primaryBoard?.name ?? "Não informada"}
              {primaryBoard?.boardCode ? ` • ${primaryBoard.boardCode}` : ""}
            </p>
            {needsTechnicalAssociation ? (
              <div className="pt-2">
                <ActionLink
                  href="#associar-ativos-tecnicos"
                  label="Associar placa e arquivos técnicos"
                  tone="primary"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryItem label="Defeito relatado" value={detail.initialReport} />
          <SummaryItem label="Alimentação" value={intakePower} />
          <SummaryItem label="Liga" value={intakeBoots} />
          <SummaryItem label="Condição da tela" value={intakeScreen} />
          <SummaryItem label="Último teste" value={latestTest ? `${latestTest.testName} • ${latestTest.resultStatus}` : "Nenhum teste registrado"} />
          <SummaryItem label="Última medição" value={latestMeasurement ? `${latestMeasurement.pointLabel} • ${latestMeasurement.measuredValue}` : "Nenhuma medição registrada"} />
          <SummaryItem label="Estado físico" value={detail.physicalNotes} />
          <SummaryItem label="Arquivos técnicos" value={`${detail.technicalAssets.length} associado(s)`} />
        </div>
      </SectionCard>

      <SectionCard
        id="associar-ativos-tecnicos"
        eyebrow="Placa e arquivos tecnicos"
        title="Associar placa e arquivos técnicos"
        description="Vincule este diagnóstico a uma placa e escolha o boardview e o esquema certos para a IA e para o laboratório abrirem no contexto correto."
      >
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryItem label="Placa associada" value={primaryBoard?.name ?? "Não informada"} />
            <SummaryItem label="Modelo associado" value={detail.model ?? "Não informado"} />
            <SummaryItem
              label="Arquivos técnicos"
              value={`${detail.technicalAssets.length} associado(s)`}
            />
            <SummaryItem
              label="Abrir no laboratório"
              value={
                boardviewAsset || schematicAsset
                  ? "Boardview e esquema prontos"
                  : "Aguardando associação"
              }
            />
          </div>

          {(boardviewAsset || schematicAsset) ? (
            <div className="flex flex-wrap gap-3">
              {boardviewAsset ? (
                <ActionLink
                  href={getAssetAssociationHref(detail, boardviewAsset)}
                  label="Abrir boardview"
                />
              ) : null}
              {schematicAsset ? (
                <ActionLink
                  href={getAssetAssociationHref(detail, schematicAsset)}
                  label="Abrir esquema"
                />
              ) : null}
            </div>
          ) : null}

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
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Assistente de bancada"
        title="Fluxo principal de análise por IA"
        description="Descreva defeito, medições, comportamento e suspeitas. A IA cruza o histórico do caso com medições, casos semelhantes, documentos técnicos, boardview e esquema associados."
      >
        <div className="rounded-[22px] border border-[rgba(45,139,130,0.22)] bg-[rgba(45,139,130,0.08)] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Agente ativo: {detail.assistantSnapshot.activeAgent.name}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                {detail.assistantSnapshot.activeAgent.specialty}
              </p>
            </div>
            <StatusPill label={formatProviderLabel(detail.assistantSnapshot.provider)} />
          </div>

          <form action={generateDiagnosticAssistantAction} className="mt-4 grid gap-3">
            <input type="hidden" name="diagnostic_id" value={detail.id} />
            <textarea
              name="assistant_prompt"
              rows={5}
              defaultValue={latestResponse ? undefined : detail.initialReport}
              placeholder="Ex.: não liga; entrada com 20V; PP3V3_G3H em 0V; sem consumo ao pressionar power; suspeita em U6990/linha 3V3. Quero direção prática de diagnóstico."
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
            />
            <div className="flex flex-wrap gap-3">
              <FormSubmitButton
                idleLabel={latestResponse ? "Analisar com IA" : "Analisar com IA"}
                pendingLabel="Consultando a IA..."
                className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
              />
              {boardviewHref ? <ActionLink href={boardviewHref} label="Abrir boardview" /> : null}
              {schematicHref ? <ActionLink href={schematicHref} label="Abrir esquema" /> : null}
              <ActionLink href="#registrar-medicao" label="Registrar medição" />
              <ActionLink href="#registrar-teste" label="Registrar teste feito" />
              <ActionLink href="#encerrar-diagnostico" label="Encerrar diagnóstico" />
            </div>
          </form>
        </div>

        {latestResponse ? (
          <div className="mt-5 grid gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill label={`Confiança ${latestResponse.confidenceScore}`} />
              <p className="text-sm text-[var(--muted)]">Última resposta {latestResponse.createdAt}</p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <ResponseBlock title="Diagnóstico provável">
                <p className="text-sm font-medium text-[var(--foreground)]">{probableDiagnosis}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">Setor provável: {probableArea}</p>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  {structured?.technicalSummary ?? latestResponse.reasoningSummary}
                </p>
                {(structured?.evidence ?? []).length ? (
                  <ul className="mt-3 space-y-1.5">
                    {(structured?.evidence ?? []).map((item) => (
                      <li key={item} className="text-sm leading-6 text-[var(--muted)]">
                        • {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </ResponseBlock>

              <ResponseBlock title="Próximos testes">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Próximo passo: {structured?.nextTest ?? latestResponse.recommendedNextStep}
                </p>
                {recommendedSequence.length ? (
                  <ol className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                    {recommendedSequence.map((item, index) => (
                      <li key={item} className="rounded-[16px] border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-2">
                        <span className="font-semibold text-[var(--foreground)]">{index + 1}.</span>{" "}
                        {item}
                      </li>
                    ))}
                  </ol>
                ) : null}
                {structured?.safetyNote ? (
                  <p className="mt-3 text-sm text-[var(--danger)]">Segurança: {structured.safetyNote}</p>
                ) : null}
              </ResponseBlock>
            </div>

            <ResponseBlock title="Onde medir">
              {netRows.length ? (
                <div className="space-y-2">
                  {netRows.map((row) => (
                    <div
                      key={row.key}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-[16px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">{row.name}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {[
                            row.expectedVoltage ? `Esperado: ${row.expectedVoltage}` : null,
                            row.measurementPoint
                              ? `Ponto: ${stripBoardviewCoordinates(row.measurementPoint)}`
                              : null,
                          ]
                            .filter((entry) => Boolean(entry) && !entry?.endsWith(": "))
                            .join(" • ") || row.note}
                        </p>
                      </div>
                      {row.boardviewHref ? (
                        <ActionLink href={row.boardviewHref} label={row.boardviewLabel ?? "Abrir no boardview"} />
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">Nenhuma net ou componente consolidado ainda.</p>
              )}

              {technicalContext?.schematic?.matches.length ? (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Esquema: {technicalContext.schematic.assetTitle}
                  </p>
                  {technicalContext.schematic.matches.map((match) => (
                    <div
                      key={`${match.term}-${match.pageNumber}`}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-[16px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {match.term} • página {match.pageNumber}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{match.excerpt}</p>
                      </div>
                      <ActionLink
                        href={appendLabContext(match.openLabHref, { page: String(match.pageNumber) })}
                        label="Abrir página do esquema"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </ResponseBlock>

            {limitations.length ? (
              <ResponseBlock title="Limitações">
                <div className="space-y-2">
                  {limitations.map((item) => (
                    <p
                      key={item}
                      className="rounded-[16px] border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-2 text-sm text-[var(--muted)]"
                    >
                      {item}
                    </p>
                  ))}
                </div>
              </ResponseBlock>
            ) : null}
          </div>
        ) : null}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          id="registrar-medicao"
          eyebrow="Ação útil"
          title="Registrar medição"
          description="Guarde tensões, correntes, resistências e contexto para a próxima análise por IA."
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
        </SectionCard>

        <SectionCard
          id="registrar-teste"
          eyebrow="Ação útil"
          title="Registrar teste feito"
          description="Adicione o teste executado, o resultado observado e o vínculo com a recomendação atual da IA."
        >
          <form action={addDiagnosticTestAction} className="grid gap-3">
            <input type="hidden" name="diagnostic_id" value={detail.id} />
            <input type="hidden" name="requested_by_ai_response_id" value={latestResponse?.id ?? ""} />
            <input type="hidden" name="diagnostic_board_id" value={primaryBoard?.id ?? ""} />
            <select
              required
              name="test_id"
              defaultValue={structured?.recommendedTestId ?? ""}
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
            <textarea
              name="actual_result"
              rows={3}
              placeholder="Resultado observado"
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
            />
            <textarea
              name="conclusion"
              rows={3}
              placeholder="Conclusão prática da bancada"
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
            <FormSubmitButton idleLabel="Registrar teste feito" pendingLabel="Salvando teste..." />
          </form>
        </SectionCard>
      </div>

      <SectionCard
        id="encerrar-diagnostico"
        eyebrow="Ação útil"
        title="Encerrar diagnóstico"
        description="Use este bloco apenas quando a causa e a solução já estiverem claras."
      >
        {detail.resolvedCase ? (
          <div className="rounded-[22px] border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] p-4">
            <div className="flex flex-wrap gap-2">
              <StatusPill label={detail.resolvedCase.caseStatus} />
              <StatusPill label={detail.resolvedCase.repairOutcome} />
            </div>
            <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">Resumo da solução</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail.resolvedCase.resolutionSummary}</p>
          </div>
        ) : (
          <DiagnosticClosureForm diagnosticId={detail.id} />
        )}
      </SectionCard>

      <SectionCard
        id="historico-bancada"
        eyebrow="Histórico da bancada"
        title="Timeline simples"
        description="Perguntas do técnico, respostas da IA, medições, testes e demais eventos salvos no diagnóstico."
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
                    <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.description}</p>
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
    </div>
  );
}
