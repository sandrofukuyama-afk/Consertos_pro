import Anthropic from "@anthropic-ai/sdk";

import {
  getClaudeChatEffort,
  getClaudeChatModelName,
  isClaudeChatConfigured,
  toFriendlyClaudeError,
} from "@/lib/ai/assistant-llm-claude";
import type { CustomerReport, CustomerReportLanguage } from "@/lib/customer-report";
import { logTokenUsage } from "@/lib/services/token-logger";

const MAX_TOKENS = 16000;

const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    problema_relatado: { type: "string" },
    diagnostico: { type: "string" },
    tipo_de_servico: { type: "string" },
    servico_executado: { type: "string" },
    pecas_substituidas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { peca: { type: "string" }, observacao: { type: "string" } },
        required: ["peca", "observacao"],
      },
    },
    verificacoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { item: { type: "string" }, resultado: { type: "string" } },
        required: ["item", "resultado"],
      },
    },
    resultado: { type: "string" },
    recomendacoes: { type: "string" },
  },
  required: [
    "problema_relatado",
    "diagnostico",
    "tipo_de_servico",
    "servico_executado",
    "pecas_substituidas",
    "verificacoes",
    "resultado",
    "recomendacoes",
  ],
};

const LANGUAGE_NAMES: Record<CustomerReportLanguage, string> = {
  pt: "portugues do Brasil",
  ja: "japones (linguagem educada de atendimento ao cliente, です・ます)",
};

function buildSystemPrompt(language: CustomerReportLanguage) {
  return [
    "Voce escreve o relatorio de servico que uma oficina de eletronica entrega ao CLIENTE junto com o aparelho consertado.",
    `Escreva todos os campos em ${LANGUAGE_NAMES[language]}.`,
    "Use os registros do caso (fechamento, testes, medicoes e a conversa do tecnico com o assistente) so como fonte.",
    "Regras:",
    "- Linguagem simples para leigo, profissional e curta. Nada de tensoes, nomes de nets ou raciocinio de bancada.",
    "  Codigo de componente so entre parenteses depois de uma descricao simples, ex.: 'chip de alimentacao da placa (U7090)'.",
    "- problema_relatado: o defeito como o cliente percebia (1-2 frases).",
    "- diagnostico: o que foi encontrado e a causa (2-3 frases).",
    "- tipo_de_servico: curto, ex.: 'Reparo de placa-mae (micro-solda)', 'Regravacao de BIOS', 'Troca de tela'.",
    "- servico_executado: o que foi feito (2-4 frases).",
    "- pecas_substituidas: so pecas que o tecnico disse ter TROCADO de fato. Nada inventado. Lista vazia se nao houve troca.",
    "- verificacoes: testes finais feitos e resultado (ex.: Liga / OK; Carrega a bateria / OK; Tela / OK).",
    "  So o que aparece nos registros. Se nao houver nenhum, lista vazia.",
    "- resultado: como o aparelho foi entregue (1-2 frases). Se o caso nao foi resolvido ou o cliente recusou o reparo, diga isso com clareza.",
    "- recomendacoes: cuidados uteis para o cliente (1-2 frases) ou texto vazio.",
    "- Nunca mencione precos, custos, IA, assistente, chat nem 'o sistema'.",
    "- Se algo nao estiver nos registros, nao preencha com suposicao.",
  ].join("\n");
}

export type CustomerReportFacts = Record<string, unknown>;

export async function generateCustomerReportWithClaude(
  facts: CustomerReportFacts,
  language: CustomerReportLanguage,
): Promise<Omit<CustomerReport, "generatedAt" | "editedAt">> {
  if (!isClaudeChatConfigured()) {
    throw new Error("A IA (Claude) não está configurada: falta a ANTHROPIC_API_KEY.");
  }

  const client = new Anthropic();
  const message = await client.beta.messages
    .stream({
      model: getClaudeChatModelName(false),
      max_tokens: MAX_TOKENS,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: getClaudeChatEffort(false),
        format: { type: "json_schema", schema: REPORT_SCHEMA },
      },
      system: buildSystemPrompt(language),
      messages: [{ role: "user", content: JSON.stringify(facts) }],
    })
    .finalMessage()
    .catch((error: unknown) => {
      throw toFriendlyClaudeError(error);
    });

  logTokenUsage(message.model, "relatorio_cliente_claude", message.usage.input_tokens, message.usage.output_tokens, {
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  });

  if (message.stop_reason === "refusal") {
    throw new Error("A IA recusou gerar o relatório.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("A IA não terminou o relatório (limite de tamanho). Tente de novo.");
  }

  const content = message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  const parsed = JSON.parse(content) as {
    problema_relatado: string;
    diagnostico: string;
    tipo_de_servico: string;
    servico_executado: string;
    pecas_substituidas: Array<{ peca: string; observacao: string }>;
    verificacoes: Array<{ item: string; resultado: string }>;
    resultado: string;
    recomendacoes: string;
  };

  return {
    language,
    problem: parsed.problema_relatado,
    diagnosis: parsed.diagnostico,
    serviceType: parsed.tipo_de_servico,
    serviceDescription: parsed.servico_executado,
    partsReplaced: parsed.pecas_substituidas.map((item) => ({ part: item.peca, note: item.observacao })),
    checks: parsed.verificacoes.map((item) => ({ item: item.item, result: item.resultado })),
    result: parsed.resultado,
    recommendations: parsed.recomendacoes,
  };
}
