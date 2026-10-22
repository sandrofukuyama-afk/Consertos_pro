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

function openCasesText(openCases) {
  if (!openCases?.length) return "";
  const lines = openCases.map((item) =>
    `- ${[item.fabricante, item.modelo, item.placa].filter(Boolean).join(" | ")}${item.rotulo ? ` (caso: ${item.rotulo})` : ""}`,
  );
  return [
    "",
    "Aparelhos na bancada agora (casos abertos, com os nomes do catalogo). Quase sempre o arquivo e de um deles:",
    "se for, devolva EXATAMENTE esses fabricante/modelo/placa, mesmo que o nome do arquivo escreva diferente ou",
    "tenha erro de digitacao no codigo da placa (ex.: DAAM9AMB8D0 no arquivo = DA0AM9MB8D0 no catalogo).",
    "Se nao for de nenhum, ignore a lista.",
    ...lines,
  ].join("\n");
}

export async function aiClassify(relativePath, kind, openCases = []) {
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
      messages: [
        { role: "user", content: `Tipo detectado: ${kind}\nCaminho: ${relativePath}${openCasesText(openCases)}` },
      ],
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
