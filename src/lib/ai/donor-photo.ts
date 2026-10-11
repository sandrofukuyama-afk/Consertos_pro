import Anthropic from "@anthropic-ai/sdk";

import { getClaudeChatModelName, isClaudeChatConfigured } from "@/lib/ai/assistant-llm-claude";

export type DonorPhotoReading = {
  codigo_placa: string;
  fabricante: string;
  modelo: string;
  tipo: "notebook" | "desktop" | "placa_de_video" | "celular" | "outro";
  marcacoes: string[];
};

const SCHEMA = {
  type: "object",
  properties: {
    codigo_placa: {
      type: "string",
      description:
        "Codigo da placa impresso na serigrafia (ex.: LA-D801P, DA0HK9MB6D0, 820-00164, 6050A2556301, MS-V389, NM-D521). Vazio se nao estiver legivel.",
    },
    fabricante: { type: "string", description: "Marca do aparelho, se identificavel. Vazio se nao souber." },
    modelo: { type: "string", description: "Modelo do aparelho, se identificavel. Vazio se nao souber." },
    tipo: { type: "string", enum: ["notebook", "desktop", "placa_de_video", "celular", "outro"] },
    marcacoes: {
      type: "array",
      items: { type: "string" },
      description:
        "Textos legiveis nos componentes: CIs, MOSFETs, diodos, controladores (ex.: BQ24780S, AON6414A, 4407A, ITE IT8987E). Um por item, sem inventar.",
    },
  },
  required: ["codigo_placa", "fabricante", "modelo", "tipo", "marcacoes"],
  additionalProperties: false,
};

const SYSTEM = [
  "Voce le fotos de placas eletronicas de sucata usadas como doadoras de componentes numa oficina.",
  "Identifique o codigo da placa na serigrafia e transcreva as marcacoes legiveis dos componentes.",
  "Copie os textos exatamente como aparecem; nao complete nem adivinhe codigos ilegiveis.",
].join(" ");

/** Le a(s) foto(s) da placa doadora. Retorna null se a IA nao estiver configurada. */
export async function readDonorPhotos(images: Array<{ base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }>) {
  if (!isClaudeChatConfigured() || !images.length) {
    return null;
  }

  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: getClaudeChatModelName(),
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...images.map((image) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: image.mediaType, data: image.base64 },
          })),
          { type: "text" as const, text: "Leia esta placa doadora." },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    return null;
  }

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return JSON.parse(text) as DonorPhotoReading;
}
