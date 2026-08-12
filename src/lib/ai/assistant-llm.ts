import { logTokenUsage } from "@/lib/services/token-logger";

const CHAT_MODEL = "gpt-4o-mini";

export type AssistantNarrativeFacts = {
  equipmentLabel: string;
  category: string;
  manufacturer: string;
  model?: string;
  summary: string;
  initialReport?: string;
  benchPrompt?: string | null;
  technicalContextSummary?: string | null;
  equipmentDetails?: Array<{
    label: string;
    value: string;
  }>;
  activeScenario: {
    id: string;
    title: string;
    summary: string;
    firstMeasurements: string[];
    nextChecks: string[];
  };
  categoryStrategyFocus: string;
  categoryFirstMove: string;
  categorySafety: string;
  symptoms: Array<{
    name: string;
    severity: string | null;
    isPrimary: boolean;
    group: string | null;
  }>;
  tests: Array<{
    testName: string;
    testGroup: string | null;
    resultStatus: string;
    actualResult: string | null;
    expectedResult?: string | null;
    conclusion?: string | null;
  }>;
  measurements: Array<{
    measurementType: string;
    pointLabel: string | null;
    measuredValueText: string | null;
    measuredValueNumeric: number | null;
    expectedValueText: string | null;
    unit: string | null;
    context?: string | null;
    observation?: string | null;
    inferredTerms?: string[];
  }>;
  hypotheses: Array<{ title: string; confidenceScore: number | null; status: string }>;
  recommendedTestName: string;
  heuristicMainHypothesis: string;
  heuristicNextTest: string;
  heuristicValidationGoal: string;
  similarCases: Array<{ title: string; excerpt: string; similarityLabel: string }>;
  relatedDocuments: Array<{
    title: string;
    excerpt: string;
    href?: string | null;
    similarityLabel?: string | null;
  }>;
  technicalAssets?: Array<{
    title: string;
    fileFormat: string;
    boardName: string | null;
    modelName: string | null;
  }>;
  boardviewFindings?: Array<{
    title: string;
    subtitle: string;
    details: string[];
    relatedNet?: string | null;
    locationSummary?: string | null;
    coordinateHint?: string | null;
    openLabHref?: string | null;
  }>;
  schematicFindings?: Array<{
    term: string;
    pageNumber: number;
    occurrences: number;
    excerpt: string;
    openLabHref?: string | null;
  }>;
  documentFindings?: Array<{
    title: string;
    excerpt: string;
    similarityLabel?: string | null;
    href?: string | null;
  }>;
  measurementContext?: Array<{
    label: string;
    measuredValue: string;
    expectedValue?: string | null;
    note?: string | null;
  }>;
  diagnosticHistory?: Array<{
    kind: string;
    title: string;
    summary: string;
  }>;
  recentAssistantHistory?: Array<{
    role: "user" | "assistant";
    summary: string;
  }>;
  attachmentContext?: Array<{
    title: string;
    summary: string;
  }>;
  symptomGroupInsight: { group: string; topCause: string; count: number } | null;
};

export type AssistantNarrativeResult = {
  probableDiagnosis: string;
  probableArea: string;
  probableSection: string;
  technicalSummary: string;
  mainHypothesis: string;
  evidence: string[];
  evidenceFound: string[];
  relatedLines: Array<{
    name: string;
    expectedVoltage: string;
    note: string;
  }>;
  expectedVoltages: Array<{
    line: string;
    expectedValue: string;
    condition?: string | null;
    note: string;
  }>;
  componentsToMeasure: Array<{
    reference: string;
    measurementPoint: string;
    expectedValue: string;
    note: string;
  }>;
  testPoints: Array<{
    label: string;
    net?: string | null;
    location?: string | null;
    expectedValue?: string | null;
    note: string;
  }>;
  recommendedTestSequence: string[];
  whereToOpen: Array<{
    title: string;
    targetType: "boardview_net" | "boardview_component" | "schematic_page" | "document" | "diagnostic";
    href: string | null;
    page?: number | null;
    component?: string | null;
    net?: string | null;
    note?: string | null;
  }>;
  sourcesUsed: string[];
  confidence: string;
  nextTest: string;
  validationGoal: string;
  safetyNote: string;
  limitations: string[];
  nextQuestionForTechnician: string | null;
};

const NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    probableDiagnosis: { type: "string" },
    probableArea: { type: "string" },
    probableSection: { type: "string" },
    technicalSummary: { type: "string" },
    mainHypothesis: { type: "string" },
    evidence: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 8,
    },
    evidenceFound: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 8,
    },
    relatedLines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          expectedVoltage: { type: "string" },
          note: { type: "string" },
        },
        required: ["name", "expectedVoltage", "note"],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: 5,
    },
    expectedVoltages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          line: { type: "string" },
          expectedValue: { type: "string" },
          condition: { type: ["string", "null"] },
          note: { type: "string" },
        },
        required: ["line", "expectedValue", "condition", "note"],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: 6,
    },
    componentsToMeasure: {
      type: "array",
      items: {
        type: "object",
        properties: {
          reference: { type: "string" },
          measurementPoint: { type: "string" },
          expectedValue: { type: "string" },
          note: { type: "string" },
        },
        required: ["reference", "measurementPoint", "expectedValue", "note"],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: 6,
    },
    testPoints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          net: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          expectedValue: { type: ["string", "null"] },
          note: { type: "string" },
        },
        required: ["label", "net", "location", "expectedValue", "note"],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: 6,
    },
    recommendedTestSequence: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 6,
    },
    whereToOpen: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          targetType: {
            type: "string",
            enum: ["boardview_net", "boardview_component", "schematic_page", "document", "diagnostic"],
          },
          href: { type: ["string", "null"] },
          page: { type: ["number", "null"] },
          component: { type: ["string", "null"] },
          net: { type: ["string", "null"] },
          note: { type: ["string", "null"] },
        },
        required: ["title", "targetType", "href", "page", "component", "net", "note"],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: 8,
    },
    sourcesUsed: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 10,
    },
    confidence: { type: "string" },
    nextTest: { type: "string" },
    validationGoal: { type: "string" },
    safetyNote: { type: "string" },
    limitations: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5,
    },
    nextQuestionForTechnician: { type: ["string", "null"] },
  },
  required: [
    "probableDiagnosis",
    "probableArea",
    "probableSection",
    "technicalSummary",
    "mainHypothesis",
    "evidence",
    "evidenceFound",
    "relatedLines",
    "expectedVoltages",
    "componentsToMeasure",
    "testPoints",
    "recommendedTestSequence",
    "whereToOpen",
    "sourcesUsed",
    "confidence",
    "nextTest",
    "validationGoal",
    "safetyNote",
    "limitations",
    "nextQuestionForTechnician",
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = [
  "Voce e um assistente tecnico senior de bancada para conserto de eletronicos de consumo",
  "(desktop, notebook, televisao, smartphone). Responda sempre em portugues do Brasil,",
  "em tom objetivo e tecnico, como um tecnico experiente orientando outro tecnico.",
  "Baseie-se estritamente nos fatos fornecidos no contexto: nao invente sintomas, testes,",
  "medicoes, hipoteses, tensoes ou referencias que nao estejam sustentadas pelo contexto.",
  "Nao responda de forma generica. O campo 'recommendedTestSequence' deve trazer passos",
  "objetivos de bancada em ordem, e o primeiro passo deve ser compativel com o teste em",
  "'recommendedTestName'. O campo 'nextTest' deve detalhar esse primeiro passo.",
  "Separe claramente fatos observados de sugestoes de verificacao.",
  "Sempre que houver contexto tecnico suficiente, cite primeiro o que medir, onde medir,",
  "o valor esperado e qual conclusao tirar se a leitura estiver fora do esperado.",
  "Se houver 'symptomGroupInsight', use-o apenas como padrao historico, nunca como certeza.",
  "Considere 'activeScenario' como o protocolo principal da bancada. Se houver",
  "'boardviewFindings', 'schematicFindings', 'measurementContext' e 'diagnosticHistory',",
  "use esse contexto para citar nets, componentes, paginas, pads e pontos de medicao",
  "de forma pratica. Se faltar um dado critico, preencha 'nextQuestionForTechnician'",
  "com a proxima medicao objetiva a ser coletada. Em 'limitations', liste somente",
  "lacunas reais de contexto ou confianca. Retorne apenas o JSON estruturado pedido.",
].join(" ");

export function isLlmConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getAssistantModelName() {
  return isLlmConfigured() ? CHAT_MODEL : "heuristic-v1";
}

export async function generateAssistantNarrative(
  facts: AssistantNarrativeFacts,
  specialistInstructions?: string,
): Promise<AssistantNarrativeResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const systemPrompt = specialistInstructions
    ? `${SYSTEM_PROMPT} Alem disso, siga as seguintes diretrizes de especialista: ${specialistInstructions}`
    : SYSTEM_PROMPT;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(facts) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "assistant_recommendation",
          strict: true,
          schema: NARRATIVE_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI chat completion failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };

  if (payload.usage) {
    logTokenUsage(
      CHAT_MODEL,
      "narrativa_diagnostico",
      payload.usage.prompt_tokens,
      payload.usage.completion_tokens,
    );
  }

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty chat completion.");
  }

  const parsed = JSON.parse(content) as AssistantNarrativeResult;

  if (
    typeof parsed.probableDiagnosis !== "string" ||
    typeof parsed.probableArea !== "string" ||
    typeof parsed.probableSection !== "string" ||
    typeof parsed.technicalSummary !== "string" ||
    typeof parsed.mainHypothesis !== "string" ||
    !Array.isArray(parsed.evidence) ||
    !Array.isArray(parsed.evidenceFound) ||
    !Array.isArray(parsed.relatedLines) ||
    !Array.isArray(parsed.expectedVoltages) ||
    !Array.isArray(parsed.componentsToMeasure) ||
    !Array.isArray(parsed.testPoints) ||
    !Array.isArray(parsed.recommendedTestSequence) ||
    !Array.isArray(parsed.whereToOpen) ||
    !Array.isArray(parsed.sourcesUsed) ||
    typeof parsed.confidence !== "string" ||
    typeof parsed.nextTest !== "string" ||
    typeof parsed.validationGoal !== "string" ||
    typeof parsed.safetyNote !== "string" ||
    !Array.isArray(parsed.limitations)
  ) {
    throw new Error("OpenAI returned a malformed narrative payload.");
  }

  return parsed;
}
