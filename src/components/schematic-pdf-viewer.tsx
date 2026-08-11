"use client";

import {
  Fragment,
  type PointerEvent as ReactPointerEvent,
  useCallback,
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
import {
  calculatePdfFitScale,
  cancelPdfRenderTask,
  getPdfJsWorkerSrc,
  isPdfRenderingCancelledError,
  type PdfRenderTaskLike,
  type PdfViewportFitMode,
} from "@/lib/boardview/viewer-utils";

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
  selectedMarkerTerm: string | null;
  searchQuery: string;
  isReadingFile: boolean;
  errorMessage: string | null;
};

type PdfZoomMode = PdfViewportFitMode | "manual";
type PendingZoomAnchor = {
  relativeX: number;
  relativeY: number;
  offsetX: number;
  offsetY: number;
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
  selectedMarkerTerm,
  searchQuery,
  isReadingFile,
  errorMessage,
}: SchematicPdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const autoFocusedQueryRef = useRef<string | null>(null);
  const renderTaskRef = useRef<PdfRenderTaskLike | null>(null);
  const renderGenerationRef = useRef(0);
  const pendingZoomAnchorRef = useRef<PendingZoomAnchor | null>(null);
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
  const [zoomMode, setZoomMode] = useState<PdfZoomMode>("page");
  const [manualZoom, setManualZoom] = useState(1);
  const [pageTexts, setPageTexts] = useState<SchematicPdfPageText[]>([]);
  const [basePageSize, setBasePageSize] = useState({ width: 0, height: 0 });
  const [viewportFrameSize, setViewportFrameSize] = useState({ width: 0, height: 0 });
  const [renderedPageSize, setRenderedPageSize] = useState({ width: 0, height: 0 });
  const [renderedTextItems, setRenderedTextItems] = useState<RenderedTextItem[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isIndexingText, setIsIndexingText] = useState(false);
  const [isRenderingPage, setIsRenderingPage] = useState(false);
  const [occurrencesOpen, setOccurrencesOpen] = useState(false);

  const effectiveSearchQuery = searchQuery.trim() || linkedSearchTerm || "";
  const normalizedSearchQuery = normalizeSchematicSearchQuery(effectiveSearchQuery);
  const normalizedManualSearchQuery = normalizeSchematicSearchQuery(searchQuery);
  const normalizedLinkedQuery = normalizeSchematicSearchQuery(linkedSearchTerm ?? "");
  const normalizedSelectedMarkerTerm = normalizeSchematicSearchQuery(
    selectedMarkerTerm ?? "",
  );
  const searchMatches = useMemo(
    () => findSchematicPdfMatches(pageTexts, effectiveSearchQuery),
    [effectiveSearchQuery, pageTexts],
  );
  const occurrencesDrawerVisible = occurrencesOpen && searchMatches.length > 0;
  const zoom =
    zoomMode === "manual"
      ? manualZoom
      : calculatePdfFitScale({
          mode: zoomMode,
          pageWidth: basePageSize.width,
          pageHeight: basePageSize.height,
          containerWidth: viewportFrameSize.width,
          containerHeight: viewportFrameSize.height,
        });
  const clampedManualZoom = Math.min(2.6, Math.max(0.6, manualZoom));

  useEffect(() => {
    let cancelled = false;

    async function loadPdfJs() {
      const nextPdfJs = await import("pdfjs-dist");
      if (!workerConfigured) {
        nextPdfJs.GlobalWorkerOptions.workerSrc = getPdfJsWorkerSrc();
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
        setBasePageSize({ width: 0, height: 0 });
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
        setZoomMode("page");
        setManualZoom(1);
      } catch (error) {
        if (!cancelled) {
          setDocumentProxy(null);
          setPageTexts([]);
          setPageCount(0);
          setBasePageSize({ width: 0, height: 0 });
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
    const activeDocument = documentProxy;
    if (!activeDocument) {
      return;
    }

    let cancelled = false;

    async function measurePageAtBaseScale() {
      if (!activeDocument) {
        return;
      }

      const page = await activeDocument.getPage(currentPage);
      const viewport = page.getViewport({ scale: 1 });

      if (!cancelled) {
        setBasePageSize({
          width: viewport.width,
          height: viewport.height,
        });
      }
    }

    void measurePageAtBaseScale();

    return () => {
      cancelled = true;
    };
  }, [currentPage, documentProxy]);

  useEffect(() => {
    if (!scrollContainerRef.current) {
      return;
    }

    const element = scrollContainerRef.current;
    function syncViewportFrameSize() {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      const horizontalPadding =
        (Number.parseFloat(styles.paddingLeft) || 0) +
        (Number.parseFloat(styles.paddingRight) || 0);
      const verticalPadding =
        (Number.parseFloat(styles.paddingTop) || 0) +
        (Number.parseFloat(styles.paddingBottom) || 0);

      setViewportFrameSize({
        width: Math.max(0, Math.floor(rect.width - horizontalPadding)),
        height: Math.max(0, Math.floor(rect.height - verticalPadding)),
      });
    }

    const observer = new ResizeObserver(() => {
      syncViewportFrameSize();
    });

    observer.observe(element);
    syncViewportFrameSize();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const normalizedLinkedQuery = normalizeSchematicSearchQuery(linkedSearchTerm ?? "");
    if (
      searchQuery.trim() ||
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
  }, [linkedSearchTerm, normalizedSearchQuery, searchMatches, searchQuery]);

  useEffect(() => {
    if (!normalizedSearchQuery) {
      autoFocusedQueryRef.current = null;
    }
  }, [normalizedSearchQuery]);

  useEffect(() => {
    let cancelled = false;
    const generation = renderGenerationRef.current + 1;
    renderGenerationRef.current = generation;

    async function renderPage() {
      if (!documentProxy || !pdfjs || !canvasRef.current) {
        setRenderedTextItems([]);
        return;
      }

      setIsRenderingPage(true);

      try {
        await cancelPdfRenderTask(renderTaskRef.current);

        if (
          cancelled ||
          renderGenerationRef.current !== generation ||
          !canvasRef.current
        ) {
          return;
        }

        const page = await documentProxy.getPage(currentPage);
        const cssViewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas || renderGenerationRef.current !== generation) {
          return;
        }

        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }

        const devicePixelRatio = window.devicePixelRatio || 1;
        const renderViewport = page.getViewport({
          scale: zoom * devicePixelRatio,
        });
        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);
        canvas.style.width = `${cssViewport.width}px`;
        canvas.style.height = `${cssViewport.height}px`;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);

        const renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport: renderViewport,
        });
        renderTaskRef.current = renderTask;

        await renderTask.promise;

        if (
          cancelled ||
          renderGenerationRef.current !== generation ||
          renderTaskRef.current !== renderTask
        ) {
          return;
        }

        const textContent = await page.getTextContent();
        const textItems = getTextItems(textContent as never, cssViewport, pdfjs);

        if (!cancelled) {
          setRenderedPageSize({
            width: cssViewport.width,
            height: cssViewport.height,
          });
          setRenderedTextItems(textItems);
        }
      } catch (error) {
        if (isPdfRenderingCancelledError(error)) {
          return;
        }

        if (!cancelled && renderGenerationRef.current === generation) {
          setLocalError(
            error instanceof Error
              ? error.message
              : "Nao foi possivel renderizar a pagina do PDF.",
          );
        }
      } finally {
        if (renderGenerationRef.current === generation) {
          renderTaskRef.current = null;
        }

        if (!cancelled && renderGenerationRef.current === generation) {
          setIsRenderingPage(false);
        }
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderGenerationRef.current += 1;
      void cancelPdfRenderTask(renderTaskRef.current);
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

  const handleManualZoom = useCallback(
    (
      nextZoom: number,
      anchorPoint?: { clientX: number; clientY: number },
    ) => {
      const clampedZoom = Math.min(2.6, Math.max(0.6, nextZoom));
      const scrollContainer = scrollContainerRef.current;

      if (
        scrollContainer &&
        renderedPageSize.width > 0 &&
        renderedPageSize.height > 0
      ) {
        const rect = scrollContainer.getBoundingClientRect();
        const offsetX = anchorPoint ? anchorPoint.clientX - rect.left : rect.width / 2;
        const offsetY = anchorPoint ? anchorPoint.clientY - rect.top : rect.height / 2;
        const contentX = scrollContainer.scrollLeft + offsetX;
        const contentY = scrollContainer.scrollTop + offsetY;

        pendingZoomAnchorRef.current = {
          relativeX: contentX / renderedPageSize.width,
          relativeY: contentY / renderedPageSize.height,
          offsetX,
          offsetY,
        };
      }

      setZoomMode("manual");
      setManualZoom(clampedZoom);
    },
    [renderedPageSize.height, renderedPageSize.width],
  );

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    function handleWheel(event: globalThis.WheelEvent) {
      if (!documentProxy) {
        return;
      }

      event.preventDefault();
      const multiplier = event.deltaY < 0 ? 1.12 : 0.89;
      const baseZoom = zoomMode === "manual" ? clampedManualZoom : zoom;
      handleManualZoom(baseZoom * multiplier, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    scrollContainer.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      scrollContainer.removeEventListener("wheel", handleWheel);
    };
  }, [clampedManualZoom, documentProxy, handleManualZoom, zoom, zoomMode]);

  useEffect(() => {
    const pendingAnchor = pendingZoomAnchorRef.current;
    const scrollContainer = scrollContainerRef.current;

    if (
      !pendingAnchor ||
      !scrollContainer ||
      renderedPageSize.width <= 0 ||
      renderedPageSize.height <= 0
    ) {
      return;
    }

    pendingZoomAnchorRef.current = null;
    const nextContentX = pendingAnchor.relativeX * renderedPageSize.width;
    const nextContentY = pendingAnchor.relativeY * renderedPageSize.height;
    scrollContainer.scrollLeft = Math.max(0, nextContentX - pendingAnchor.offsetX);
    scrollContainer.scrollTop = Math.max(0, nextContentY - pendingAnchor.offsetY);
  }, [renderedPageSize.height, renderedPageSize.width]);

  const combinedErrorMessage = errorMessage ?? localError;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)]">
      <div className="border-b border-[var(--panel-border)] px-4 py-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
              {fileName ?? "Esquema PDF"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
              {documentProxy ? `${currentPage} / ${pageCount}` : "Sem PDF"}
            </div>
            <div className="rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
              {(zoom * 100).toFixed(0)}%
            </div>
            {searchMatches.length ? (
              <button
                type="button"
                onClick={() => setOccurrencesOpen(true)}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-white/5"
              >
                Ocorrencias ({searchMatches.length})
              </button>
            ) : null}
            <div className="rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
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
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] p-1">
              {[
                { value: "page", label: "Ajustar pagina" },
                { value: "width", label: "Ajustar largura" },
              ].map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => setZoomMode(entry.value as PdfViewportFitMode)}
                  className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                    zoomMode === entry.value
                      ? "bg-[var(--accent-copper)] text-white"
                      : "text-[var(--muted)] hover:text-white"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <div className="flex rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] p-1">
              <button
                type="button"
                onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                disabled={!documentProxy || currentPage <= 1}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((value) => Math.min(pageCount, value + 1))}
                disabled={!documentProxy || currentPage >= pageCount}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Proxima
              </button>
            </div>
            <div className="flex rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] p-1">
              {[
                { label: "-", value: Math.max(0.6, zoom - 0.15) },
                { label: "+", value: Math.min(2.6, zoom + 0.15) },
              ].map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  onClick={() => handleManualZoom(entry.value)}
                  className="rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/5"
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs leading-5 text-[var(--muted)]">
            Arraste o painel para navegar pela pagina renderizada.
          </p>
        </div>
      </div>

      {combinedErrorMessage ? (
        <div className="border-b border-[var(--panel-border)] px-4 py-3 text-sm text-[var(--danger)]">
          {combinedErrorMessage}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 min-w-0">
        <div
          ref={scrollContainerRef}
          className="h-full min-h-0 min-w-0 overflow-auto bg-[#0d0c14]"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {documentProxy ? (
            <div
              className="flex min-h-full min-w-full items-center justify-center p-3"
            >
              <div
                className="relative shrink-0"
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
                  {renderedTextItems
                    .map((item) => {
                      const normalizedItemText = normalizeSchematicSearchQuery(item.text);
                      const isSelectedHighlight =
                        normalizedSelectedMarkerTerm.length > 0 &&
                        normalizedItemText === normalizedSelectedMarkerTerm;
                      const isRelatedHighlight =
                        !isSelectedHighlight &&
                        normalizedManualSearchQuery.length > 0 &&
                        (normalizedItemText.includes(normalizedManualSearchQuery) ||
                          normalizedManualSearchQuery.includes(normalizedItemText));
                      const isFallbackHighlight =
                        !isSelectedHighlight &&
                        !normalizedManualSearchQuery.length &&
                        normalizedLinkedQuery.length > 0 &&
                        (normalizedItemText.includes(normalizedLinkedQuery) ||
                          normalizedLinkedQuery.includes(normalizedItemText));

                      return {
                        item,
                        isSelectedHighlight,
                        isHighlighted:
                          isSelectedHighlight ||
                          isRelatedHighlight ||
                          isFallbackHighlight ||
                          (!normalizedManualSearchQuery.length &&
                            !normalizedLinkedQuery.length &&
                            normalizedSearchQuery.length > 0 &&
                            (normalizedItemText.includes(normalizedSearchQuery) ||
                              normalizedSearchQuery.includes(normalizedItemText))),
                      };
                    })
                    .sort((left, right) =>
                      Number(left.isSelectedHighlight) - Number(right.isSelectedHighlight),
                    )
                    .map(({ item, isSelectedHighlight, isHighlighted }) => {
                      if (!isHighlighted) {
                        return (
                          <span
                            key={item.id}
                            className="absolute whitespace-pre text-transparent"
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
                      }

                      if (isSelectedHighlight) {
                        return (
                          <Fragment key={item.id}>
                            <span
                              className="absolute whitespace-pre rounded border-2 border-[rgba(66,226,255,0.98)] bg-[rgba(66,226,255,0.34)] px-1.5 py-0.5 text-[#f4fdff] shadow-[0_0_0_1px_rgba(66,226,255,0.62),0_0_18px_rgba(66,226,255,0.38)]"
                              style={{
                                left: item.left - 6,
                                top: item.top - 4,
                                minWidth: item.width + 12,
                                fontSize: item.fontSize,
                                transform: `rotate(${item.rotationDeg}deg)`,
                                transformOrigin: "left top",
                                lineHeight: 1,
                                zIndex: 3,
                              }}
                            >
                              {item.text}
                            </span>
                            <span
                              className="absolute rounded-full border border-[rgba(66,226,255,0.98)] bg-[rgba(10,31,40,0.92)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[rgba(210,248,255,0.98)] shadow-[0_0_12px_rgba(66,226,255,0.35)]"
                              style={{
                                left: item.left + Math.max(item.width - 6, 0),
                                top: Math.max(item.top - 16, 0),
                                zIndex: 4,
                              }}
                            >
                              Selecionado
                            </span>
                          </Fragment>
                        );
                      }

                      return (
                        <span
                          key={item.id}
                          className="absolute whitespace-pre rounded border border-[rgba(255,73,185,0.84)] bg-[rgba(255,73,185,0.16)] text-[#fff7fc] shadow-[0_0_0_1px_rgba(255,73,185,0.22)]"
                          style={{
                            left: item.left,
                            top: item.top,
                            minWidth: item.width,
                            fontSize: item.fontSize,
                            transform: `rotate(${item.rotationDeg}deg)`,
                            transformOrigin: "left top",
                            lineHeight: 1,
                            zIndex: 1,
                          }}
                        >
                          {item.text}
                        </span>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-[18px] border border-dashed border-[var(--panel-border)] text-center text-sm text-[var(--muted)]">
              Abra um PDF local.
            </div>
          )}
        </div>

        {occurrencesDrawerVisible ? (
          <div className="absolute inset-y-0 right-0 z-20 w-full max-w-[22rem] bg-[rgba(7,7,10,0.42)] backdrop-blur-sm">
            <aside className="ml-auto flex h-full w-full flex-col border-l border-[var(--panel-border)] bg-[var(--card-surface)] shadow-[-24px_0_48px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--panel-border)] px-4 py-3">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Ocorrencias
                </p>
                <button
                  type="button"
                  onClick={() => setOccurrencesOpen(false)}
                  className="rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-white/5"
                >
                  Fechar
                </button>
              </div>
              <div className="min-h-0 space-y-2 overflow-y-auto p-4">
                {searchMatches.map((match) => (
                  <button
                    key={`${match.pageNumber}:${match.occurrences}`}
                    type="button"
                    onClick={() => {
                      setCurrentPage(match.pageNumber);
                      setOccurrencesOpen(false);
                    }}
                    className={`w-full rounded-[18px] border px-3 py-3 text-left transition ${
                      currentPage === match.pageNumber
                        ? "border-[rgba(255,73,185,0.88)] bg-[rgba(255,73,185,0.16)] shadow-[0_0_0_1px_rgba(255,73,185,0.32)]"
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
                ))}
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </section>
  );
}
