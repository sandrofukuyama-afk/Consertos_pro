"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { PDFDocumentProxy, TextItem } from "pdfjs-dist/types/src/display/api";

import {
  findSchematicPdfMatches,
  normalizeSchematicSearchQuery,
  type SchematicPdfPageText,
} from "@/lib/boardview/schematic-pdf";

type PdfJsModule = typeof import("pdfjs-dist");

type RenderedTextItem = {
  id: string;
  text: string;
  left: number;
  top: number;
  width: number;
  fontSize: number;
  rotationDeg: number;
};

type SchematicPdfViewerProps = {
  fileBytes: Uint8Array | null;
  fileName: string | null;
  linkedSearchTerm: string | null;
  isReadingFile: boolean;
  errorMessage: string | null;
};

let workerConfigured = false;

function getTextItems(
  textContent: { items: Array<TextItem | { str?: string }> },
  viewport: { scale: number; transform: number[] },
  pdfjs: PdfJsModule,
) {
  const items: RenderedTextItem[] = [];

  for (const rawItem of textContent.items) {
    if (!("str" in rawItem) || typeof rawItem.str !== "string") {
      continue;
    }

    const item = rawItem as TextItem;
    const transform = pdfjs.Util.transform(viewport.transform, item.transform);
    const rotationDeg = Math.atan2(transform[1], transform[0]) * (180 / Math.PI);
    const fontSize = Math.max(8, Math.hypot(transform[2], transform[3]));

    items.push({
      id: `${rawItem.str}:${items.length}`,
      text: rawItem.str,
      left: transform[4],
      top: transform[5] - fontSize,
      width: Math.max(item.width * viewport.scale, rawItem.str.length * fontSize * 0.2),
      fontSize,
      rotationDeg,
    });
  }

  return items;
}

export function SchematicPdfViewer({
  fileBytes,
  fileName,
  linkedSearchTerm,
  isReadingFile,
  errorMessage,
}: SchematicPdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const autoFocusedQueryRef = useRef<string | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  }>({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  const [pdfjs, setPdfjs] = useState<PdfJsModule | null>(null);
  const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.1);
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [pageTexts, setPageTexts] = useState<SchematicPdfPageText[]>([]);
  const [renderedPageSize, setRenderedPageSize] = useState({ width: 0, height: 0 });
  const [renderedTextItems, setRenderedTextItems] = useState<RenderedTextItem[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isIndexingText, setIsIndexingText] = useState(false);
  const [isRenderingPage, setIsRenderingPage] = useState(false);

  const effectiveSearchQuery = manualSearchQuery.trim() || linkedSearchTerm || "";
  const normalizedSearchQuery = normalizeSchematicSearchQuery(effectiveSearchQuery);
  const searchMatches = useMemo(
    () => findSchematicPdfMatches(pageTexts, effectiveSearchQuery),
    [effectiveSearchQuery, pageTexts],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPdfJs() {
      const nextPdfJs = await import("pdfjs-dist");
      if (!workerConfigured) {
        nextPdfJs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        workerConfigured = true;
      }

      if (!cancelled) {
        setPdfjs(nextPdfJs);
      }
    }

    void loadPdfJs();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      if (!pdfjs || !fileBytes) {
        setDocumentProxy(null);
        setPageTexts([]);
        setPageCount(0);
        setRenderedTextItems([]);
        setRenderedPageSize({ width: 0, height: 0 });
        return;
      }

      setIsLoadingDocument(true);
      setLocalError(null);

      try {
        const loadingTask = pdfjs.getDocument({
          data: fileBytes,
          useWorkerFetch: false,
        });
        const nextDocument = await loadingTask.promise;

        if (cancelled) {
          return;
        }

        setDocumentProxy(nextDocument);
        setPageCount(nextDocument.numPages);
        setCurrentPage(1);
        setZoom(1.1);
      } catch (error) {
        if (!cancelled) {
          setDocumentProxy(null);
          setPageTexts([]);
          setPageCount(0);
          setLocalError(
            error instanceof Error
              ? error.message
              : "Nao foi possivel abrir o PDF local.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDocument(false);
        }
      }
    }

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [fileBytes, pdfjs]);

  useEffect(() => {
    let cancelled = false;

    async function indexText() {
      if (!documentProxy) {
        setPageTexts([]);
        return;
      }

      setIsIndexingText(true);

      try {
        const collected: SchematicPdfPageText[] = [];

        for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
          const page = await documentProxy.getPage(pageNumber);
          const textContent = await page.getTextContent();
          const text = textContent.items
            .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
            .join(" ");
          collected.push({ pageNumber, text });
        }

        if (!cancelled) {
          setPageTexts(collected);
        }
      } catch (error) {
        if (!cancelled) {
          setLocalError(
            error instanceof Error
              ? error.message
              : "Nao foi possivel indexar o texto do PDF.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsIndexingText(false);
        }
      }
    }

    void indexText();

    return () => {
      cancelled = true;
    };
  }, [documentProxy]);

  useEffect(() => {
    const normalizedLinkedQuery = normalizeSchematicSearchQuery(linkedSearchTerm ?? "");
    if (
      manualSearchQuery.trim() ||
      !normalizedLinkedQuery ||
      normalizedSearchQuery !== normalizedLinkedQuery ||
      !searchMatches.length
    ) {
      return;
    }

    if (autoFocusedQueryRef.current === normalizedLinkedQuery) {
      return;
    }

    autoFocusedQueryRef.current = normalizedLinkedQuery;
    setCurrentPage(searchMatches[0]!.pageNumber);
  }, [linkedSearchTerm, manualSearchQuery, normalizedSearchQuery, searchMatches]);

  useEffect(() => {
    if (!normalizedSearchQuery) {
      autoFocusedQueryRef.current = null;
    }
  }, [normalizedSearchQuery]);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      if (!documentProxy || !pdfjs || !canvasRef.current) {
        setRenderedTextItems([]);
        return;
      }

      setIsRenderingPage(true);

      try {
        const page = await documentProxy.getPage(currentPage);
        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }

        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }

        const devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.ceil(viewport.width * devicePixelRatio);
        canvas.height = Math.ceil(viewport.height * devicePixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);

        await page.render({
          canvas,
          canvasContext: context,
          viewport,
        }).promise;

        const textContent = await page.getTextContent();
        const textItems = getTextItems(textContent as never, viewport, pdfjs);

        if (!cancelled) {
          setRenderedPageSize({
            width: viewport.width,
            height: viewport.height,
          });
          setRenderedTextItems(textItems);
        }
      } catch (error) {
        if (!cancelled) {
          setLocalError(
            error instanceof Error
              ? error.message
              : "Nao foi possivel renderizar a pagina do PDF.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsRenderingPage(false);
        }
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
    };
  }, [currentPage, documentProxy, pdfjs, zoom]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!scrollContainerRef.current) {
      return;
    }

    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: scrollContainerRef.current.scrollLeft,
      scrollTop: scrollContainerRef.current.scrollTop,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStateRef.current.active || !scrollContainerRef.current) {
      return;
    }

    const deltaX = event.clientX - dragStateRef.current.startX;
    const deltaY = event.clientY - dragStateRef.current.startY;
    scrollContainerRef.current.scrollLeft = dragStateRef.current.scrollLeft - deltaX;
    scrollContainerRef.current.scrollTop = dragStateRef.current.scrollTop - deltaY;
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current.active = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const combinedErrorMessage = errorMessage ?? localError;

  return (
    <section className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
      <div className="flex flex-col gap-3 border-b border-[var(--panel-border)] pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Esquema PDF
            </p>
            <h4 className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">
              Visualizador local de esquema
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              O PDF e aberto somente no navegador, com texto pesquisavel, destaque e navegacao por pagina.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[auto_auto_auto]">
            <button
              type="button"
              onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
              disabled={!documentProxy || currentPage <= 1}
              className="rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Pagina anterior
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((value) => Math.min(pageCount, value + 1))}
              disabled={!documentProxy || currentPage >= pageCount}
              className="rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Proxima pagina
            </button>
            <div className="flex rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] p-1">
              {[
                { label: "-", value: Math.max(0.6, zoom - 0.15) },
                { label: "+", value: Math.min(2.6, zoom + 0.15) },
              ].map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  onClick={() => setZoom(entry.value)}
                  className="rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/5"
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
          <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-[var(--foreground)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              PDF atual
            </p>
            <p className="mt-1 truncate">{fileName ?? "Nenhum PDF aberto"}</p>
          </div>
          <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-[var(--foreground)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Pagina
            </p>
            <p className="mt-1">
              {documentProxy ? `${currentPage} / ${pageCount}` : "-"}
            </p>
          </div>
          <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-[var(--foreground)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Zoom
            </p>
            <p className="mt-1">{(zoom * 100).toFixed(0)}%</p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <input
            type="text"
            value={manualSearchQuery || linkedSearchTerm || ""}
            onChange={(event) => setManualSearchQuery(event.target.value)}
            placeholder="Buscar referencia ou net no PDF"
            className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[rgba(109,94,242,0.55)]"
          />
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-[var(--foreground)]">
            {isReadingFile || isLoadingDocument
              ? "Abrindo PDF..."
              : isIndexingText
                ? "Indexando texto..."
                : isRenderingPage
                  ? "Renderizando..."
                  : searchMatches.length
                    ? `${searchMatches.length} paginas encontradas`
                    : normalizedSearchQuery
                      ? "Nenhuma pagina encontrada"
                      : "Aguardando busca"}
          </div>
        </div>

        {combinedErrorMessage ? (
          <div className="rounded-[20px] border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
            {combinedErrorMessage}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div
          ref={scrollContainerRef}
          className="min-h-[420px] overflow-auto rounded-[20px] border border-[var(--panel-border)] bg-[#0d0c14] p-3 md:min-h-[560px]"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {documentProxy ? (
            <div
              className="relative mx-auto"
              style={{
                width: renderedPageSize.width || 1,
                height: renderedPageSize.height || 1,
              }}
            >
              <canvas ref={canvasRef} className="block rounded-[14px] shadow-[0_18px_50px_rgba(0,0,0,0.35)]" />
              <div
                className="absolute left-0 top-0 select-text"
                style={{
                  width: renderedPageSize.width || 1,
                  height: renderedPageSize.height || 1,
                }}
              >
                {renderedTextItems.map((item) => {
                  const normalizedItemText = normalizeSchematicSearchQuery(item.text);
                  const isHighlighted =
                    normalizedSearchQuery.length > 0 &&
                    (normalizedItemText.includes(normalizedSearchQuery) ||
                      normalizedSearchQuery.includes(normalizedItemText));

                  return (
                    <span
                      key={item.id}
                      className={`absolute whitespace-pre ${
                        isHighlighted
                          ? "rounded bg-[rgba(216,166,84,0.65)] text-[#1a1628]"
                          : "text-transparent"
                      }`}
                      style={{
                        left: item.left,
                        top: item.top,
                        minWidth: item.width,
                        fontSize: item.fontSize,
                        transform: `rotate(${item.rotationDeg}deg)`,
                        transformOrigin: "left top",
                        lineHeight: 1,
                      }}
                    >
                      {item.text}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[380px] items-center justify-center rounded-[18px] border border-dashed border-[var(--panel-border)] text-center text-sm text-[var(--muted)]">
              Abra um PDF de esquema local para habilitar a busca cruzada com o boardview.
            </div>
          )}
        </div>

        <aside className="grid gap-4">
          <div className="rounded-[20px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Ocorrencias
            </p>
            <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto pr-1">
              {searchMatches.length ? (
                searchMatches.map((match) => (
                  <button
                    key={`${match.pageNumber}:${match.occurrences}`}
                    type="button"
                    onClick={() => setCurrentPage(match.pageNumber)}
                    className={`w-full rounded-[18px] border px-3 py-3 text-left transition ${
                      currentPage === match.pageNumber
                        ? "border-[rgba(109,94,242,0.55)] bg-[rgba(109,94,242,0.12)]"
                        : "border-[var(--panel-border)] bg-[var(--background)] hover:bg-white/5"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      Pagina {match.pageNumber}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      {match.occurrences} ocorrencia(s)
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                      {match.excerpt}
                    </p>
                  </button>
                ))
              ) : normalizedSearchQuery ? (
                <div className="rounded-[18px] border border-dashed border-[var(--panel-border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                  Nenhuma ocorrencia para esta busca.
                </div>
              ) : (
                <div className="rounded-[18px] border border-dashed border-[var(--panel-border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                  Selecione um componente ou digite uma busca manual para localizar paginas.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
