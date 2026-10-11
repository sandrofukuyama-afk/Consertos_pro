// Extracao de texto de PDF no servidor.
//
// O pdfjs (usado pelo pdf-parse) referencia DOMMatrix/Path2D/ImageData ao
// carregar, e essas APIs nao existem no Node. O modulo "pdf-parse/worker"
// define esses globais a partir do @napi-rs/canvas, entao ele precisa ser
// importado ANTES do "pdf-parse". Sem isso a leitura falha em producao com
// "ReferenceError: DOMMatrix is not defined".

type PdfTextResult = {
  text: string;
  pages: Array<{ num: number; text: string }>;
};

async function loadPdfParse() {
  const { CanvasFactory } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  return { PDFParse, CanvasFactory };
}

export async function extractPdfText(data: Uint8Array | Buffer): Promise<PdfTextResult> {
  const { PDFParse, CanvasFactory } = await loadPdfParse();
  const parser = new PDFParse({
    data: Buffer.from(data),
    CanvasFactory,
  });

  try {
    const result = await parser.getText();
    return {
      text: result.text,
      pages: result.pages.map((page) => ({ num: page.num, text: page.text })),
    };
  } finally {
    await parser.destroy();
  }
}
