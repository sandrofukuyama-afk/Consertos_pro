import { createClient } from "@/lib/supabase/server";
import type { WorkshopStatistics } from "@/types/domain";

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
    const manufacturer = pickRelation(diagnostic?.manufacturers)?.name ?? "Nao identificado";
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
