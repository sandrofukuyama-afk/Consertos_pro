import { logTokenUsage } from "@/lib/services/token-logger";

const VISION_MODEL = "gpt-4o-mini";

export type BoardImageAnalysis = {
  observations: string[];
  suspectedIssues: string[];
  confidence: "low" | "medium" | "high";
  recommendation: string;
};

export type ComponentOcrResult = {
  componentRef: string | null;
  confidence: "low" | "medium" | "high";
  rationale: string;
};

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    observations: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 6,
    },
    suspectedIssues: {
      type: "array",
      items: { type: "string" },
      minItems: 0,
      maxItems: 5,
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    recommendation: { type: "string" },
  },
  required: ["observations", "suspectedIssues", "confidence", "recommendation"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = [
  "Você é um técnico eletrônico sênior analisando uma foto de placa ou equipamento",
  "de bancada. Responda em português do Brasil. Descreva apenas o que é visivelmente",
  "observável na imagem: sinais de queima, corrosão, capacitor estufado ou vazando,",
  "solda fria ou fraturada, componente ausente, trilha rompida, superaquecimento,",
  "dano por líquido, ou ausência de sinais visíveis de defeito. Não invente causas",
  "que não podem ser vistas na imagem. Se a imagem não mostrar uma placa ou",
  "componente eletrônico com clareza, diga isso em 'observations' e deixe",
  "'suspectedIssues' vazio. 'confidence' reflete o quanto a imagem permite uma",
  "leitura técnica confiável (qualidade, foco, enquadramento), não a certeza sobre",
  "a causa da falha do equipamento. 'recommendation' deve ser um próximo passo",
  "objetivo de bancada, nunca um diagnóstico definitivo.",
].join(" ");

const OCR_SCHEMA = {
  type: "object",
  properties: {
    componentRef: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    rationale: { type: "string" },
  },
  required: ["componentRef", "confidence", "rationale"],
  additionalProperties: false,
};

const OCR_SYSTEM_PROMPT = [
  "Voce esta olhando uma foto macro de uma placa eletronica.",
  "Sua tarefa e identificar a serigrafia principal de componente visivel na imagem,",
  "como C2800, PL401, U12, Q45, R210 ou F1.",
  "Retorne somente uma referencia quando houver leitura visual plausivel.",
  "Nao invente caracteres ocultos nem chute referencias longas sem base visual.",
  "Se a foto nao permitir leitura confiavel, retorne componentRef como null.",
  "Padronize a referencia em letras maiusculas sem espacos.",
  "Explique em rationale, em portugues do Brasil, o que sustentou a leitura ou por que ela ficou inconclusiva.",
].join(" ");

export function isVisionConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function analyzeBoardImage(imageUrl: string): Promise<BoardImageAnalysis | null> {
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
      model: VISION_MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analise esta foto de bancada e retorne o JSON estruturado pedido.",
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "board_image_analysis",
          strict: true,
          schema: ANALYSIS_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI vision request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
    };
  };

  if (payload.usage) {
    logTokenUsage(
      VISION_MODEL,
      "analise_imagem_placa",
      payload.usage.prompt_tokens,
      payload.usage.completion_tokens,
    );
  }

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty vision analysis.");
  }

  const parsed = JSON.parse(content) as BoardImageAnalysis;

  if (
    !Array.isArray(parsed.observations) ||
    !Array.isArray(parsed.suspectedIssues) ||
    typeof parsed.confidence !== "string" ||
    typeof parsed.recommendation !== "string"
  ) {
    throw new Error("OpenAI returned a malformed vision analysis payload.");
  }

  return parsed;
}

export async function extractComponentReferenceFromImage(
  imageUrl: string,
): Promise<ComponentOcrResult | null> {
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
      model: VISION_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: OCR_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Leia a serigrafia do componente principal desta foto e retorne o JSON estruturado.",
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "component_reference_ocr",
          strict: true,
          schema: OCR_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI OCR request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
    };
  };

  if (payload.usage) {
    logTokenUsage(
      VISION_MODEL,
      "ocr_serigrafia_componente",
      payload.usage.prompt_tokens,
      payload.usage.completion_tokens,
    );
  }

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty OCR analysis.");
  }

  const parsed = JSON.parse(content) as ComponentOcrResult;

  if (
    (parsed.componentRef !== null && typeof parsed.componentRef !== "string") ||
    typeof parsed.confidence !== "string" ||
    typeof parsed.rationale !== "string"
  ) {
    throw new Error("OpenAI returned a malformed OCR payload.");
  }

  return {
    componentRef: parsed.componentRef?.trim().toUpperCase() ?? null,
    confidence: parsed.confidence,
    rationale: parsed.rationale,
  };
}
