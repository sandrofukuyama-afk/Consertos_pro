const CHAT_MODEL = "gpt-4o-mini";

export type AssistantNarrativeFacts = {
  equipmentLabel: string;
  category: string;
  manufacturer: string;
  summary: string;
  categoryStrategyFocus: string;
  categoryFirstMove: string;
  categorySafety: string;
  symptoms: Array<{ name: string; severity: string | null; isPrimary: boolean; group: string | null }>;
  tests: Array<{ testName: string; testGroup: string | null; resultStatus: string; actualResult: string | null }>;
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
  symptomGroupInsight: { group: string; topCause: string; count: number } | null;
};

export type AssistantNarrativeResult = {
  technicalSummary: string;
  mainHypothesis: string;
  evidence: string[];
  nextTest: string;
  validationGoal: string;
  safetyNote: string;
};

const NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    technicalSummary: { type: "string" },
    mainHypothesis: { type: "string" },
    evidence: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 6,
    },
    nextTest: { type: "string" },
    validationGoal: { type: "string" },
    safetyNote: { type: "string" },
  },
  required: ["technicalSummary", "mainHypothesis", "evidence", "nextTest", "validationGoal", "safetyNote"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = [
  "Você é um assistente técnico sênior de bancada para conserto de eletrônicos de consumo",
  "(desktop, notebook, televisão, smartphone). Responda sempre em português do Brasil,",
  "em tom objetivo e técnico, como um técnico experiente orientando outro técnico.",
  "Baseie-se estritamente nos fatos fornecidos no contexto: não invente sintomas, testes,",
  "medições ou hipóteses que não estejam no contexto. O campo 'nextTest' deve obrigatoriamente",
  "recomendar o teste indicado em 'recommendedTestName' do contexto, apenas explicando por que",
  "e como executá-lo — não substitua por outro teste. Se houver 'symptomGroupInsight', use-o para",
  "reforçar ou qualificar a hipótese principal, deixando claro que é um padrão histórico e não uma",
  "certeza. Retorne apenas o JSON estruturado pedido.",
].join(" ");

export function isLlmConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getAssistantModelName() {
  return isLlmConfigured() ? CHAT_MODEL : "heuristic-v1";
}

export async function generateAssistantNarrative(
  facts: AssistantNarrativeFacts,
): Promise<AssistantNarrativeResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

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
        { role: "system", content: SYSTEM_PROMPT },
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
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty chat completion.");
  }

  const parsed = JSON.parse(content) as AssistantNarrativeResult;

  if (
    typeof parsed.technicalSummary !== "string" ||
    typeof parsed.mainHypothesis !== "string" ||
    !Array.isArray(parsed.evidence) ||
    typeof parsed.nextTest !== "string" ||
    typeof parsed.validationGoal !== "string" ||
    typeof parsed.safetyNote !== "string"
  ) {
    throw new Error("OpenAI returned a malformed narrative payload.");
  }

  return parsed;
}
