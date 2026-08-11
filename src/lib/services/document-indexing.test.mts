import assert from "node:assert/strict";
import test from "node:test";

import {
  assertExtractedTechnicalDocumentText,
  buildTechnicalDocumentIndexPayload,
  resolveTechnicalDocumentFileName,
  TechnicalDocumentIndexingError,
} from "./document-indexing.ts";

test("resolveTechnicalDocumentFileName extracts the basename from storage paths", () => {
  assert.equal(
    resolveTechnicalDocumentFileName("manuals/notebooks/quanta-la.pdf"),
    "quanta-la.pdf",
  );
  assert.equal(
    resolveTechnicalDocumentFileName("quanta-la.pdf"),
    "quanta-la.pdf",
  );
});

test("assertExtractedTechnicalDocumentText rejects missing real document text", () => {
  assert.throws(
    () => assertExtractedTechnicalDocumentText("   ", "empty.pdf"),
    (error: unknown) =>
      error instanceof TechnicalDocumentIndexingError &&
      error.message.includes("empty.pdf"),
  );
});

test("buildTechnicalDocumentIndexPayload keeps real extracted content in the summary and chunks", () => {
  const extractedText = assertExtractedTechnicalDocumentText(
    "Linha 19V presente. PU301 aquece apos start. Verificar curto na linha LCD_VDD.",
    "boardview.txt",
  );

  const payload = buildTechnicalDocumentIndexPayload({
    title: "Esquema MSI",
    documentType: "schematic",
    manufacturerName: "MSI",
    notes: "Documento interno",
    fileName: "boardview.txt",
    mimeType: "text/plain",
    extractedText,
  });

  assert.match(payload.summaryText, /Linha 19V presente/);
  assert.ok(payload.chunks.length > 0);
  assert.match(payload.chunks[0].chunkText, /PU301 aquece/);
});
