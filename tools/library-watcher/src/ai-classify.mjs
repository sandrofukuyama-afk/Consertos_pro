// Classificacao com o Claude para nomes que as regras nao reconhecem.
// Opcional: so roda com ANTHROPIC_API_KEY configurada.

import Anthropic from "@anthropic-ai/sdk";

const CATEGORIES = ["Notebook", "Desktop", "Smartphone", "Tablet", "Televisão", "Placa de vídeo"];

const SCHEMA = {
  type: "object",
  properties: {
    fabricante: { type: "string", description: "Marca do aparelho (ex.: Dell, Asus, MSI). Vazio se nao souber." },
    categoria: { type: "string", enum: CATEGORIES },
    modelo: { type: "string", description: "Modelo comercial (ex.: Inspiron 15 5567). Vazio se nao souber." },
    placa: {
      type: "string",
      description: "Codigo da placa/PCB (ex.: LA-D801P, DA0HK9MB6D0, 820-3437, MS-V389). Vazio se nao houver.",
    },
    confianca: { type: "string", enum: ["alta", "media", "baixa"] },
  },
  required: ["fabricante", "categoria", "modelo", "placa", "confianca"],
  additionalProperties: false,
};

const SYSTEM = [
  "Voce identifica arquivos tecnicos de uma oficina de eletronica (esquemas, boardviews, BIOS).",
  "Recebe o caminho do arquivo (pastas e nome) e devolve fabricante, categoria, modelo e codigo da placa.",
  "Use conhecimento de ODMs: Compal LA-xxxxP, Quanta DA0xxxxxxxx, Wistron, Inventec 6050Axxxxxxx,",
  "LCFC NM-xxxx, Apple 820-xxxxx, MSI MS-xxxxx/MS-Vxxx, Asus 60NRxxxx/CGxxxx.",
  "Nao invente: deixe vazio o que o caminho nao permite deduzir e use confianca 'baixa' se for chute.",
].join(" ");

let client = null;

export function isAiClassifyEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function aiClassify(relativePath, kind) {
  if (!isAiClassifyEnabled()) {
    return null;
  }

  client ??= new Anthropic();

  try {
    const response = await client.beta.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: `Tipo detectado: ${kind}\nCaminho: ${relativePath}` }],
    });

    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      return null;
    }

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    const result = JSON.parse(text);

    return result.confianca === "baixa" ? null : result;
  } catch (error) {
    console.warn("[ia] classificacao falhou:", error.message);
    return null;
  }
}
