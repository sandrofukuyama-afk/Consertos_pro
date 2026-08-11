import type { CatalogOption, EquipmentModelCatalogOption } from "@/types/domain";

export type ParsedEquipmentCapture = {
  category: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  manufacturingYear: string | null;
  accessoriesIncluded: string | null;
  initialProblemReport: string | null;
  physicalConditionNotes: string | null;
  powerPresent: "yes" | "no" | null;
  powersOn: "yes" | "no" | null;
  screenCondition: "good" | "broken" | "no_image" | null;
};

const FIELD_LABELS = {
  category: ["categoria", "tipo", "equipamento"],
  manufacturer: ["marca", "fabricante"],
  model: ["modelo"],
  serialNumber: ["numero de serie", "número de série", "serial", "serie"],
  manufacturingYear: ["ano de fabricacao", "ano de fabricação", "ano"],
  accessoriesIncluded: ["acessorios", "acessórios", "acompanha"],
  initialProblemReport: ["relato inicial", "relato", "problema", "defeito"],
  physicalConditionNotes: ["condicao fisica", "condição física", "estado fisico", "estado físico"],
} as const;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeCaptureText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function slugifyCaptureText(value: string) {
  return normalizeCaptureText(value).replace(/\s+/g, "-");
}

function cleanExtractedValue(value: string | null) {
  if (!value) {
    return null;
  }

  const cleaned = value
    .trim()
    .replace(/^[\s:,-]+/, "")
    .replace(/[\s,;.-]+$/, "")
    .replace(/\s+/g, " ");

  return cleaned || null;
}

function extractValue(
  sourceText: string,
  fieldLabels: readonly string[],
  allLabelsPattern: string,
) {
  const currentPattern = fieldLabels.map(escapeRegex).join("|");
  const expression = new RegExp(
    `(?:^|\\b)(?:${currentPattern})\\s*[:\\-]?\\s*([\\s\\S]+?)(?=\\s*(?:${allLabelsPattern})\\s*[:\\-]?|$)`,
    "i",
  );

  return cleanExtractedValue(sourceText.match(expression)?.[1] ?? null);
}

export function parseEquipmentCapture(sourceText: string): ParsedEquipmentCapture {
  const allLabelsPattern = Object.values(FIELD_LABELS)
    .flat()
    .map(escapeRegex)
    .join("|");
  const normalizedText = normalizeCaptureText(sourceText);

  const powerPresent =
    /\b(sem alimentacao|sem energia|nao tem alimentacao)\b/.test(normalizedText)
      ? "no"
      : /\b(tem alimentacao|com alimentacao)\b/.test(normalizedText)
        ? "yes"
        : null;
  const powersOn =
    /\b(nao liga)\b/.test(normalizedText)
      ? "no"
      : /\b(liga)\b/.test(normalizedText)
        ? "yes"
        : null;
  const screenCondition =
    /\b(sem imagem)\b/.test(normalizedText)
      ? "no_image"
      : /\b(tela quebrada|display quebrado)\b/.test(normalizedText)
        ? "broken"
        : /\b(tela boa|display bom|tela ok)\b/.test(normalizedText)
          ? "good"
          : null;

  return {
    category: extractValue(sourceText, FIELD_LABELS.category, allLabelsPattern),
    manufacturer: extractValue(sourceText, FIELD_LABELS.manufacturer, allLabelsPattern),
    model: extractValue(sourceText, FIELD_LABELS.model, allLabelsPattern),
    serialNumber: extractValue(sourceText, FIELD_LABELS.serialNumber, allLabelsPattern),
    manufacturingYear: extractValue(sourceText, FIELD_LABELS.manufacturingYear, allLabelsPattern),
    accessoriesIncluded: extractValue(sourceText, FIELD_LABELS.accessoriesIncluded, allLabelsPattern),
    initialProblemReport: extractValue(sourceText, FIELD_LABELS.initialProblemReport, allLabelsPattern),
    physicalConditionNotes: extractValue(sourceText, FIELD_LABELS.physicalConditionNotes, allLabelsPattern),
    powerPresent,
    powersOn,
    screenCondition,
  };
}

function scoreCatalogMatch(optionName: string, rawValue: string) {
  const normalizedOption = normalizeCaptureText(optionName);
  const normalizedRaw = normalizeCaptureText(rawValue);

  if (!normalizedOption || !normalizedRaw) {
    return -1;
  }

  if (normalizedOption === normalizedRaw) {
    return 100;
  }

  if (normalizedOption.startsWith(normalizedRaw) || normalizedRaw.startsWith(normalizedOption)) {
    return 80;
  }

  if (normalizedOption.includes(normalizedRaw) || normalizedRaw.includes(normalizedOption)) {
    return 60;
  }

  return -1;
}

export function matchCatalogOption(options: CatalogOption[], rawValue: string | null) {
  if (!rawValue) {
    return null;
  }

  return options
    .map((option) => ({ option, score: scoreCatalogMatch(option.name, rawValue) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score)[0]?.option ?? null;
}

export function matchEquipmentModel(
  models: EquipmentModelCatalogOption[],
  rawValue: string | null,
  filters?: {
    manufacturerId?: string;
    categoryId?: string;
  },
) {
  if (!rawValue) {
    return null;
  }

  const filtered = models.filter((model) => {
    const manufacturerMatches =
      !filters?.manufacturerId || model.manufacturerId === filters.manufacturerId;
    const categoryMatches =
      !filters?.categoryId || model.categoryId === filters.categoryId;

    return manufacturerMatches && categoryMatches;
  });

  return filtered
    .map((model) => ({ model, score: scoreCatalogMatch(model.name, rawValue) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score)[0]?.model ?? null;
}
