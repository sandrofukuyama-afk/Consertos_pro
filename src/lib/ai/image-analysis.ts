const VISION_MODEL = "gpt-4o-mini";

export type BoardImageAnalysis = {
  observations: string[];
  suspectedIssues: string[];
  confidence: "low" | "medium" | "high";
  recommendation: string;
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
  };
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
