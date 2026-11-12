import type { DiagnosticDetail } from "@/types/domain";

/**
 * Caso exportado em Markdown para continuar o diagnostico no Claude Code (plano
 * Pro do dono), sem gastar credito de API. Funcao pura: a rota busca os dados e
 * os links temporarios dos arquivos.
 */

export type CaseExportFile = {
  title: string;
  documentType: string;
  association: string;
  /** Link temporario do Storage (nao precisa de login); null se falhou. */
  url: string | null;
};

export type CaseExportInput = {
  detail: Pick<
    DiagnosticDetail,
    | "id"
    | "label"
    | "category"
    | "manufacturer"
    | "model"
    | "serialNumber"
    | "status"
    | "summary"
    | "initialReport"
    | "physicalNotes"
    | "equipmentDetails"
    | "resolvedCase"
    | "measurements"
    | "hypotheses"
    | "chatMessages"
  >;
  files: CaseExportFile[];
  appUrl: string;
  generatedAt: Date;
  linkValidityDays: number;
};

function cell(value: string | null | undefined) {
  return (value ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim() || "—";
}

function slug(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "caso"
  );
}

export function buildCaseExportFileName(detail: Pick<DiagnosticDetail, "id" | "label">) {
  return `caso-${slug(detail.label)}-${detail.id.slice(0, 8)}.md`;
}

export function buildCaseExportMarkdown(input: CaseExportInput) {
  const { detail, files } = input;
  const caseUrl = `${input.appUrl}/diagnosticos/${detail.id}`;
  const lines: string[] = [];

  lines.push(
    `# Caso de bancada: ${detail.label}`,
    "",
    `Exportado do ConsertosPro em ${input.generatedAt.toLocaleString("pt-BR", { timeZone: "Asia/Tokyo" })} (horário do Japão).`,
    `Caso no app: ${caseUrl}`,
    "",
    "## Instruções para o Claude Code",
    "",
    "Você vai continuar o diagnóstico de bancada desta placa com o técnico, em português do Brasil.",
    "O técnico está com a placa na mão: ele mede, você conduz o raciocínio e diz exatamente a próxima medição",
    "(componente, pino, net ou test point), em que condição da placa (fonte/bateria, ligada ou não) e o valor esperado.",
    "",
    "- Leia este arquivo inteiro antes de responder: relato, medições já feitas, hipóteses e a conversa anterior.",
    "  Não peça de novo medição que já está aqui; respeite a condição em que cada uma foi feita.",
    `- Baixe os arquivos técnicos da lista abaixo para uma pasta \`arquivos/\` (ex.: \`curl -L -o "arquivos/NOME" "LINK"\`).`,
    `  Os links valem ${input.linkValidityDays} dias. Esquema PDF: extraia o texto por página (ex.: \`pdftotext -layout\`)`,
    "  e procure nets/referências. Boardview .brd/.cad/.asc costuma ser texto: procure o componente e as nets dele.",
    "- Confira toda referência no boardview da placa real antes de mandar medir, retirar ou gravar algo; o esquema",
    "  pode ser de outra revisão. Antes de gravar BIOS, conte quantos chips de flash a placa tem.",
    "- Não invente medições, nets ou tensões. Separe o que foi confirmado do que é inferência.",
    "- Respostas curtas: o que a medição mostra e o próximo passo em negrito.",
    "- Ao terminar (ou quando o técnico pedir), escreva um resumo pronto para colar no chat do caso no app:",
    "  medições novas com ponto, condição e valor; hipóteses confirmadas/descartadas; causa e solução, se houver.",
    "",
  );

  lines.push("## Aparelho", "");
  lines.push(`- Equipamento: ${detail.label}`);
  lines.push(`- Categoria: ${detail.category}`);
  lines.push(`- Fabricante / modelo: ${detail.manufacturer} / ${detail.model}`);
  if (detail.serialNumber) lines.push(`- Série: ${detail.serialNumber}`);
  lines.push(`- Status do caso: ${detail.status}`);
  for (const item of detail.equipmentDetails) {
    if (item.value) lines.push(`- ${item.label}: ${item.value}`);
  }
  lines.push("");

  lines.push("## Relato inicial", "", detail.initialReport || "—", "");
  if (detail.physicalNotes) lines.push("## Estado físico", "", detail.physicalNotes, "");
  lines.push("## Resumo atual do caso", "", detail.summary || "—", "");

  if (detail.resolvedCase) {
    const resolved = detail.resolvedCase;
    lines.push("## Encerramento", "", `- Resultado: ${resolved.repairOutcome}`, `- Resumo: ${resolved.resolutionSummary}`);
    if (resolved.finalFailureMode) lines.push(`- Modo de falha: ${resolved.finalFailureMode}`);
    if (resolved.cause) lines.push(`- Causa: ${resolved.cause.title} — ${resolved.cause.explanation}`);
    if (resolved.solution) lines.push(`- Solução: ${resolved.solution.title} — ${resolved.solution.procedure}`);
    lines.push("");
  }

  lines.push("## Arquivos técnicos", "");
  if (files.length) {
    for (const file of files) {
      const target = file.url ? `[baixar](${file.url})` : "(link indisponível; baixe pelo app)";
      lines.push(`- **${file.title}** — ${file.documentType}, ${file.association}: ${target}`);
    }
  } else {
    lines.push("Nenhum arquivo técnico associado ao caso.");
  }
  lines.push("");

  lines.push(`## Medições registradas (${detail.measurements.length})`, "");
  if (detail.measurements.length) {
    lines.push("| Ponto | Medido | Esperado | Fora da faixa | Condição | Quando |", "|---|---|---|---|---|---|");
    for (const item of detail.measurements) {
      lines.push(
        `| ${cell(item.pointLabel)} | ${cell(item.measuredValue)} | ${cell(item.expectedValue)} | ${item.isOutOfRange ? "sim" : "não"} | ${cell(item.context)} | ${cell(item.measuredAt)} |`,
      );
    }
  } else {
    lines.push("Nenhuma medição registrada.");
  }
  lines.push("");

  lines.push(`## Hipóteses (${detail.hypotheses.length})`, "");
  if (detail.hypotheses.length) {
    for (const item of detail.hypotheses) {
      lines.push(`- **${item.title}** — ${item.status}, confiança ${item.confidence}. ${item.description} Evidência: ${item.evidence}`);
    }
  } else {
    lines.push("Nenhuma hipótese registrada.");
  }
  lines.push("");

  lines.push(`## Conversa anterior com a IA do app (${detail.chatMessages.length} mensagens)`, "");
  if (detail.chatMessages.length) {
    for (const message of detail.chatMessages) {
      const who = message.role === "user" ? "Técnico" : "IA";
      const photos = message.photos.length ? ` [${message.photos.length} foto(s) no app]` : "";
      lines.push(`### ${who} — ${message.createdAt}${photos}`, "", message.text.trim() || "(sem texto)", "");
    }
  } else {
    lines.push("Sem conversa ainda.", "");
  }

  return lines.join("\n");
}
