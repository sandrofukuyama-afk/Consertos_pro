import { createHash } from "node:crypto";

const TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/javascript",
  "application/xml",
]);
const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".xml", ".log"];
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 180;

type DocumentIndexInput = {
  title: string;
  documentType: string;
  manufacturerName?: string | null;
  notes?: string | null;
  fileName: string;
  mimeType: string;
  extractedText?: string | null;
};

type DocumentIndexPayload = {
  summaryText: string;
  summaryHash: string;
  chunks: Array<{
    chunkOrder: number;
    sectionLabel: string;
    chunkText: string;
    tokenEstimate: number;
  }>;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function hashContent(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function isTextLikeFile(file: File) {
  if (file.type.startsWith("text/") || TEXT_MIME_TYPES.has(file.type)) {
    return true;
  }

  const lowerName = file.name.toLowerCase();
  return TEXT_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function chunkText(value: string): DocumentIndexPayload["chunks"] {
  const normalized = normalizeWhitespace(value);
  const chunks: DocumentIndexPayload["chunks"] = [];

  if (!normalized) {
    return chunks;
  }

  let start = 0;
  let order = 1;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    const chunkTextValue = normalized.slice(start, end).trim();

    if (chunkTextValue) {
      chunks.push({
        chunkOrder: order,
        sectionLabel: `Chunk ${order}`,
        chunkText: chunkTextValue,
        tokenEstimate: estimateTokens(chunkTextValue),
      });
      order += 1;
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

export async function extractTechnicalDocumentText(file: File) {
  if (file.type === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({
      data: Buffer.from(await file.arrayBuffer()),
    });

    try {
      const result = await parser.getText();
      return normalizeWhitespace(result.text);
    } finally {
      await parser.destroy();
    }
  }

  if (isTextLikeFile(file)) {
    return normalizeWhitespace(await file.text());
  }

  return "";
}

export function buildTechnicalDocumentIndexPayload(
  input: DocumentIndexInput,
): DocumentIndexPayload {
  const metadataText = normalizeWhitespace(
    [
      `Documento técnico ${input.title}.`,
      `Tipo ${input.documentType}.`,
      input.manufacturerName ? `Fabricante ${input.manufacturerName}.` : "",
      input.notes ? `Notas ${input.notes}.` : "",
      `Arquivo ${input.fileName}.`,
      `Mime ${input.mimeType}.`,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const extractedText = normalizeWhitespace(input.extractedText ?? "");
  const summaryText = extractedText
    ? `${metadataText}\n\n${extractedText}`
    : metadataText;

  return {
    summaryText: summaryText.slice(0, 8000),
    summaryHash: hashContent(summaryText),
    chunks: chunkText(summaryText),
  };
}
