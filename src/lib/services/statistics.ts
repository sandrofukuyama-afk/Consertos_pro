import { createClient } from "@/lib/supabase/server";
import type { PreventiveInsight, WorkshopStatistics } from "@/types/domain";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const CAUSE_TYPE_LABELS: Record<string, string> = {
  component_failure: "Falha de componente",
  short_circuit: "Curto-circuito",
  bad_solder: "Solda fria",
  firmware_corruption: "Corrupção de firmware",
  line_missing: "Linha ausente",
  liquid_damage: "Dano por líquido",
  thermal_failure: "Falha térmica",
  other: "Outro",
};

const PREVENTIVE_THRESHOLD = 2;

export async function getPreventiveInsightForModel(
  equipmentModelId: string,
  excludeDiagnosticId: string,
  client?: SupabaseServerClient,
): Promise<PreventiveInsight | null> {
  const supabase = client ?? (await createClient());

  const { data: diagnosticRows } = await supabase
    .from("diagnostics")
    .select("id")
    .eq("equipment_model_id", equipmentModelId)
    .neq("id", excludeDiagnosticId);

  const diagnosticIds = (diagnosticRows ?? []).map((row) => row.id);

  if (!diagnosticIds.length) {
    return null;
  }

  const { data: resolvedRows } = await supabase
    .from("resolved_cases")
    .select("id")
    .in("diagnostic_id", diagnosticIds);

  const resolvedCaseIds = (resolvedRows ?? []).map((row) => row.id);

  if (!resolvedCaseIds.length) {
    return null;
  }

  const { data: causeRows } = await supabase
    .from("confirmed_causes")
    .select(
      `
        cause_type,
        board_components(
          components(component_ref)
        )
      `,
    )
    .in("resolved_case_id", resolvedCaseIds);

  const rows =
    (causeRows as Array<{
      cause_type: string;
      board_components:
        | { components: { component_ref: string } | Array<{ component_ref: string }> | null }
        | Array<{ components: { component_ref: string } | Array<{ component_ref: string }> | null }>
        | null;
    }> | null) ?? [];

  if (!rows.length) {
    return null;
  }

  const causeCounts = new Map<string, number>();
  const componentCounts = new Map<string, Map<string, number>>();

  for (const row of rows) {
    causeCounts.set(row.cause_type, (causeCounts.get(row.cause_type) ?? 0) + 1);

    const boardComponent = pickRelation(row.board_components);
    const component = boardComponent ? pickRelation(boardComponent.components) : null;

    if (component) {
      const tally = componentCounts.get(row.cause_type) ?? new Map<string, number>();
      tally.set(component.component_ref, (tally.get(component.component_ref) ?? 0) + 1);
      componentCounts.set(row.cause_type, tally);
    }
  }

  const [topCauseType, occurrences] = [...causeCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  if (occurrences < PREVENTIVE_THRESHOLD) {
    return null;
  }

  const componentTally = componentCounts.get(topCauseType);
  const topComponent = componentTally
    ? [...componentTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  return {
    causeType: topCauseType,
    causeLabel: CAUSE_TYPE_LABELS[topCauseType] ?? topCauseType,
    occurrences,
    totalCases: resolvedCaseIds.length,
    componentRef: topComponent,
  };
}

function pickRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function getWorkshopStatistics(): Promise<WorkshopStatistics> {
  const supabase = await createClient();

  const [resolvedCasesResult, confirmedCausesResult] = await Promise.all([
    supabase
      .from("resolved_cases")
      .select(
        `
          case_status,
          time_to_resolution_minutes,
          diagnostics(
            manufacturers(name),
            equipment_models(model_name)
          )
        `,
      ),
    supabase
      .from("confirmed_causes")
      .select(
        `
          cause_type,
          board_component_id,
          board_components(
            components(component_ref, component_type)
          )
        `,
      ),
  ]);

  const resolvedCases =
    (resolvedCasesResult.data as Array<{
      case_status: string;
      time_to_resolution_minutes: number | null;
      diagnostics:
        | {
            manufacturers: { name: string } | Array<{ name: string }> | null;
            equipment_models: { model_name: string } | Array<{ model_name: string }> | null;
          }
        | Array<{
            manufacturers: { name: string } | Array<{ name: string }> | null;
            equipment_models: { model_name: string } | Array<{ model_name: string }> | null;
          }>
        | null;
    }> | null) ?? [];

  const resolutionRate = { confirmed: 0, probable: 0, unresolved: 0 };
  const manufacturerMap = new Map<string, { caseCount: number; resolutionTimes: number[] }>();
  const modelMap = new Map<string, { manufacturer: string; caseCount: number; resolutionTimes: number[] }>();
  const allResolutionTimes: number[] = [];

  for (const row of resolvedCases) {
    if (row.case_status === "confirmed") {
      resolutionRate.confirmed += 1;
    } else if (row.case_status === "probable") {
      resolutionRate.probable += 1;
    } else if (row.case_status === "unresolved") {
      resolutionRate.unresolved += 1;
    }

    if (typeof row.time_to_resolution_minutes === "number") {
      allResolutionTimes.push(row.time_to_resolution_minutes);
    }

    const diagnostic = pickRelation(row.diagnostics);
    const manufacturer = pickRelation(diagnostic?.manufacturers)?.name ?? "Não identificado";
    const model = pickRelation(diagnostic?.equipment_models)?.model_name ?? null;

    const manufacturerEntry = manufacturerMap.get(manufacturer) ?? {
      caseCount: 0,
      resolutionTimes: [],
    };
    manufacturerEntry.caseCount += 1;

    if (typeof row.time_to_resolution_minutes === "number") {
      manufacturerEntry.resolutionTimes.push(row.time_to_resolution_minutes);
    }

    manufacturerMap.set(manufacturer, manufacturerEntry);

    if (model) {
      const modelKey = `${manufacturer}::${model}`;
      const modelEntry = modelMap.get(modelKey) ?? {
        manufacturer,
        caseCount: 0,
        resolutionTimes: [],
      };
      modelEntry.caseCount += 1;

      if (typeof row.time_to_resolution_minutes === "number") {
        modelEntry.resolutionTimes.push(row.time_to_resolution_minutes);
      }

      modelMap.set(modelKey, modelEntry);
    }
  }

  const componentCounts = new Map<string, { componentRef: string; componentType: string; occurrences: number }>();
  const causeCounts = new Map<string, number>();

  for (const row of
    ((confirmedCausesResult.data as Array<{
      cause_type: string;
      board_component_id: string | null;
      board_components:
        | { components: { component_ref: string; component_type: string } | Array<{ component_ref: string; component_type: string }> | null }
        | Array<{ components: { component_ref: string; component_type: string } | Array<{ component_ref: string; component_type: string }> | null }>
        | null;
    }> | null) ?? [])) {
    causeCounts.set(row.cause_type, (causeCounts.get(row.cause_type) ?? 0) + 1);

    const boardComponent = pickRelation(row.board_components);
    const component = boardComponent ? pickRelation(boardComponent.components) : null;

    if (component) {
      const key = component.component_ref;
      const entry = componentCounts.get(key) ?? {
        componentRef: component.component_ref,
        componentType: component.component_type,
        occurrences: 0,
      };
      entry.occurrences += 1;
      componentCounts.set(key, entry);
    }
  }

  return {
    totalResolvedCases: resolvedCases.length,
    averageResolutionMinutes: average(allResolutionTimes),
    resolutionRate,
    byManufacturer: [...manufacturerMap.entries()]
      .map(([manufacturer, entry]) => ({
        manufacturer,
        caseCount: entry.caseCount,
        averageResolutionMinutes: average(entry.resolutionTimes),
      }))
      .sort((a, b) => b.caseCount - a.caseCount || a.manufacturer.localeCompare(b.manufacturer)),
    byModel: [...modelMap.entries()]
      .map(([key, entry]) => ({
        model: key.split("::")[1],
        manufacturer: entry.manufacturer,
        caseCount: entry.caseCount,
        averageResolutionMinutes: average(entry.resolutionTimes),
      }))
      .sort((a, b) => b.caseCount - a.caseCount || a.model.localeCompare(b.model))
      .slice(0, 10),
    recurringComponents: [...componentCounts.values()]
      .sort((a, b) => b.occurrences - a.occurrences || a.componentRef.localeCompare(b.componentRef))
      .slice(0, 10),
    causeFrequency: [...causeCounts.entries()]
      .map(([causeType, count]) => ({ causeType, count }))
      .sort((a, b) => b.count - a.count || a.causeType.localeCompare(b.causeType)),
  };
}
