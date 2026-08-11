export type ObservedCanvasMetrics = {
  width: number;
  height: number;
  pixelRatio: number;
};

export type PdfViewportFitMode = "page" | "width";
export type PdfRenderTaskLike = {
  promise: Promise<unknown>;
  cancel: () => void;
};

type ObservedCanvasSnapshot = {
  cssWidth: number;
  cssHeight: number;
  devicePixelWidth?: number;
  devicePixelHeight?: number;
  fallbackPixelRatio?: number;
};

export const PDFJS_WORKER_VERSION = "6.2.108";

export function getPdfJsWorkerSrc(version = PDFJS_WORKER_VERSION) {
  return `/pdfjs/pdf.worker-${version}.min.mjs`;
}

export function resolveObservedCanvasMetrics(
  snapshot: ObservedCanvasSnapshot,
): ObservedCanvasMetrics {
  const width = Math.max(0, Math.round(snapshot.cssWidth));
  const height = Math.max(0, Math.round(snapshot.cssHeight));
  const fallbackPixelRatio = Math.max(1, snapshot.fallbackPixelRatio ?? 1);

  if (!width || !height) {
    return {
      width,
      height,
      pixelRatio: fallbackPixelRatio,
    };
  }

  const widthRatio =
    snapshot.devicePixelWidth && snapshot.devicePixelWidth > 0
      ? snapshot.devicePixelWidth / width
      : null;
  const heightRatio =
    snapshot.devicePixelHeight && snapshot.devicePixelHeight > 0
      ? snapshot.devicePixelHeight / height
      : null;
  const ratios = [widthRatio, heightRatio].filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );

  return {
    width,
    height,
    pixelRatio: ratios.length
      ? Math.max(1, Math.max(...ratios))
      : fallbackPixelRatio,
  };
}

export function calculateAvailableViewportHeight(
  elementTop: number,
  parentPaddingBottom: number,
  viewportHeight: number,
) {
  return Math.max(
    0,
    Math.floor(viewportHeight - Math.max(0, elementTop) - Math.max(0, parentPaddingBottom)),
  );
}

export function calculatePdfFitScale({
  mode,
  pageWidth,
  pageHeight,
  containerWidth,
  containerHeight,
}: {
  mode: PdfViewportFitMode;
  pageWidth: number;
  pageHeight: number;
  containerWidth: number;
  containerHeight: number;
}) {
  if (
    pageWidth <= 0 ||
    pageHeight <= 0 ||
    containerWidth <= 0 ||
    containerHeight <= 0
  ) {
    return 1;
  }

  if (mode === "width") {
    return containerWidth / pageWidth;
  }

  return Math.min(containerWidth / pageWidth, containerHeight / pageHeight);
}

export function isPdfRenderingCancelledError(error: unknown) {
  return (
    error instanceof Error &&
    error.name === "RenderingCancelledException"
  );
}

export async function cancelPdfRenderTask(
  task: PdfRenderTaskLike | null,
) {
  if (!task) {
    return;
  }

  task.cancel();

  try {
    await task.promise;
  } catch (error) {
    if (!isPdfRenderingCancelledError(error)) {
      throw error;
    }
  }
}

export function shouldScheduleBoardFitAfterLoad(
  hasPendingFit: boolean,
  canvasSize: { width: number; height: number },
) {
  return hasPendingFit && canvasSize.width > 0 && canvasSize.height > 0;
}

export function shouldAttachBoardviewObserver(
  hostElement: Element | null,
) {
  return hostElement !== null;
}
