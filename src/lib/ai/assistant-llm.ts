import { logTokenUsage } from "@/lib/services/token-logger";

const CHAT_MODEL = "gpt-4o-mini";

export type AssistantNarrativeFacts = {
  equipmentLabel: string;
  category: string;
  manufacturer: string;
  summary: string;
  benchPrompt?: string | null;
  technicalContextSummary?: string | null;
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
  }>;
  measurements: Array<{
    measurementType: string;
    pointLabel: string | null;
    measuredValueText: string | null;
    measuredValueNumeric: number | null;
    expectedValueText: string | null;
    unit: string | null;
  }>;
  hypotheses: Array<{ title: string; confidenceScore: number | null; status: string }>;
  recommendedTestName: string;
  heuristicMainHypothesis: string;
  heuristicNextTest: string;
  heuristicValidationGoal: string;
  similarCases: Array<{ title: string; excerpt: string; similarityLabel: string }>;
  relatedDocuments: Array<{ title: string; excerpt: string }>;
  technicalAssets?: Array<{
    title: string;
    fileFormat: string;
    boardName: string | null;
    modelName: string | null;
  }>;
  symptomGroupInsight: { group: string; topCause: string; count: number } | null;
};

export type AssistantNarrativeResult = {
  probableDiagnosis: string;
  probableArea: string;
  technicalSummary: string;
  mainHypothesis: string;
  evidence: string[];
  relatedLines: Array<{
    name: string;
    expectedVoltage: string;
    note: string;
  }>;
  componentsToMeasure: Array<{
    reference: string;
    measurementPoint: string;
    expectedValue: string;
    note: string;
  }>;
  recommendedTestSequence: string[];
  nextTest: string;
  validationGoal: string;
  safetyNote: string;
  limitations: string[];
};

const NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    probableDiagnosis: { type: "string" },
    probableArea: { type: "string" },
    technicalSummary: { type: "string" },
    mainHypothesis: { type: "string" },
    evidence: {
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
    recommendedTestSequence: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 6,
    },
    nextTest: { type: "string" },
    validationGoal: { type: "string" },
    safetyNote: { type: "string" },
    limitations: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5,
    },
  },
  required: [
    "probableDiagnosis",
    "probableArea",
    "technicalSummary",
    "mainHypothesis",
    "evidence",
    "relatedLines",
    "componentsToMeasure",
    "recommendedTestSequence",
    "nextTest",
    "validationGoal",
    "safetyNote",
    "limitations",
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
  "Se houver 'symptomGroupInsight', use-o apenas como padrao historico, nunca como certeza.",
  "Considere 'activeScenario' como o protocolo principal da bancada. Se houver",
  "'technicalContextSummary', use esse contexto para citar nets, componentes, paginas e",
  "pontos de medicao de forma pratica. Em 'limitations', liste somente lacunas reais",
  "de contexto ou confianca. Retorne apenas o JSON estruturado pedido.",
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
    typeof parsed.technicalSummary !== "string" ||
    typeof parsed.mainHypothesis !== "string" ||
    !Array.isArray(parsed.evidence) ||
    !Array.isArray(parsed.relatedLines) ||
    !Array.isArray(parsed.componentsToMeasure) ||
    !Array.isArray(parsed.recommendedTestSequence) ||
    typeof parsed.nextTest !== "string" ||
    typeof parsed.validationGoal !== "string" ||
    typeof parsed.safetyNote !== "string" ||
    !Array.isArray(parsed.limitations)
  ) {
    throw new Error("OpenAI returned a malformed narrative payload.");
  }

  return parsed;
}
