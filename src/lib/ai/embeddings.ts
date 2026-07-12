import { createHash } from "node:crypto";
import { logTokenUsage } from "@/lib/services/token-logger";

export const EMBEDDING_DIMENSIONS = 1536;
const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  const words = normalizeText(value)
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length > 1);
  const tokens = [...words];

  for (let index = 0; index < words.length - 1; index += 1) {
    tokens.push(`${words[index]}_${words[index + 1]}`);
  }

  return tokens;
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(
    vector.reduce((accumulator, value) => accumulator + value * value, 0),
  );

  if (!magnitude) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

export function createHashedEmbedding(input: string) {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = tokenize(input);

  if (!tokens.length) {
    return vector;
  }

  tokens.forEach((token, tokenIndex) => {
    const digest = createHash("sha256")
      .update(`${token}:${tokenIndex % 7}`)
      .digest();

    const index = ((digest[0] << 8) + digest[1]) % EMBEDDING_DIMENSIONS;
    const sign = digest[2] % 2 === 0 ? 1 : -1;
    const weight = 1 + digest[3] / 255;

    vector[index] += sign * weight;
  });

  return normalizeVector(vector);
}

async function createOpenAIEmbedding(input: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embeddings request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
    usage?: {
      prompt_tokens: number;
      total_tokens: number;
    };
  };

  // Log token consumption asynchronously
  if (payload.usage) {
    logTokenUsage(
      OPENAI_EMBEDDING_MODEL,
      "gerar_embedding",
      payload.usage.prompt_tokens,
      0
    );
  }

  const embedding = payload.data?.[0]?.embedding;

  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error("OpenAI returned an invalid embedding payload.");
  }

  return embedding;
}

export function getEmbeddingProviderName() {
  return process.env.OPENAI_API_KEY ? OPENAI_EMBEDDING_MODEL : "hashing-v1";
}

export function isExternalEmbeddingConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function formatVectorLiteral(vector: number[]) {
  return `[${vector.map((value) => value.toFixed(8)).join(",")}]`;
}

export async function generateTextEmbedding(input: string) {
  const normalized = normalizeText(input);

  if (!normalized) {
    return {
      vector: new Array<number>(EMBEDDING_DIMENSIONS).fill(0),
      model: getEmbeddingProviderName(),
    };
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const vector = await createOpenAIEmbedding(normalized);

      if (vector) {
        return {
          vector,
          model: OPENAI_EMBEDDING_MODEL,
        };
      }
    } catch {
      // Fall back to the local hashing model if the external provider fails.
    }
  }

  return {
    vector: createHashedEmbedding(normalized),
    model: "hashing-v1",
  };
}
