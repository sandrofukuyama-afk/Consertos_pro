import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAvailableViewportHeight,
  calculatePdfFitScale,
  cancelPdfRenderTask,
  getPdfJsWorkerSrc,
  isPdfRenderingCancelledError,
  PDFJS_WORKER_VERSION,
  resolveObservedCanvasMetrics,
  shouldAttachBoardviewObserver,
  shouldScheduleBoardFitAfterLoad,
} from "./viewer-utils.ts";

test("resolveObservedCanvasMetrics derives css size and device pixel ratio safely", () => {
  const metrics = resolveObservedCanvasMetrics({
    cssWidth: 640.4,
    cssHeight: 359.6,
    devicePixelWidth: 1280,
    devicePixelHeight: 720,
    fallbackPixelRatio: 1,
  });

  assert.deepEqual(metrics, {
    width: 640,
    height: 360,
    pixelRatio: 2,
  });
});

test("resolveObservedCanvasMetrics falls back when no device pixel box is exposed", () => {
  const metrics = resolveObservedCanvasMetrics({
    cssWidth: 0,
    cssHeight: 0,
    fallbackPixelRatio: 1.5,
  });

  assert.deepEqual(metrics, {
    width: 0,
    height: 0,
    pixelRatio: 1.5,
  });
});

test("getPdfJsWorkerSrc stays pinned to the installed worker version", () => {
  assert.equal(
    getPdfJsWorkerSrc(),
    `/pdfjs/pdf.worker-${PDFJS_WORKER_VERSION}.min.mjs`,
  );
});

test("calculateAvailableViewportHeight subtracts top offset and parent padding", () => {
  assert.equal(calculateAvailableViewportHeight(180, 28, 900), 692);
});

test("calculatePdfFitScale supports fit page and fit width", () => {
  assert.equal(
    calculatePdfFitScale({
      mode: "page",
      pageWidth: 1000,
      pageHeight: 1400,
      containerWidth: 500,
      containerHeight: 600,
    }),
    Math.min(0.5, 600 / 1400),
  );
  assert.equal(
    calculatePdfFitScale({
      mode: "width",
      pageWidth: 1000,
      pageHeight: 1400,
      containerWidth: 500,
      containerHeight: 600,
    }),
    0.5,
  );
});

test("cancelPdfRenderTask awaits cancellation before allowing the next render", async () => {
  const events: string[] = [];
  let rejectTask!: (error: Error) => void;
  const task = {
    promise: new Promise((_, reject: (error: Error) => void) => {
      rejectTask = reject;
    }),
    cancel() {
      events.push("cancel");
      queueMicrotask(() => {
        events.push("settled");
        const error = new Error("cancelled");
        error.name = "RenderingCancelledException";
        rejectTask(error);
      });
    },
  };

  await cancelPdfRenderTask(task);
  events.push("next-render");

  assert.deepEqual(events, ["cancel", "settled", "next-render"]);
});

test("isPdfRenderingCancelledError only ignores rendering cancellation", () => {
  const cancelled = new Error("cancelled");
  cancelled.name = "RenderingCancelledException";

  assert.equal(isPdfRenderingCancelledError(cancelled), true);
  assert.equal(isPdfRenderingCancelledError(new Error("boom")), false);
});

test("shouldScheduleBoardFitAfterLoad waits for non-zero canvas dimensions", () => {
  assert.equal(
    shouldScheduleBoardFitAfterLoad(true, { width: 0, height: 490 }),
    false,
  );
  assert.equal(
    shouldScheduleBoardFitAfterLoad(true, { width: 620, height: 490 }),
    true,
  );
  assert.equal(
    shouldScheduleBoardFitAfterLoad(false, { width: 620, height: 490 }),
    false,
  );
});

test("boardview observer attaches only after the host mounts", () => {
  assert.equal(shouldAttachBoardviewObserver(null), false);
  assert.equal(shouldAttachBoardviewObserver({} as Element), true);
});
