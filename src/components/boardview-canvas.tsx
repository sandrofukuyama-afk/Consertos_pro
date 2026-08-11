"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";

import {
  type BoardviewLabModel,
  type BoardviewLabSelection,
  type BoardviewLabSideFilter,
  type BoardviewViewport,
  boardToCanvasPoint,
  canvasToBoardPoint,
  findNearestBoardviewSelection,
  fitBoardviewViewport,
  focusBoardviewViewportOnComponent,
  getSelectionHighlightNetName,
  getSelectionVisibleComponents,
} from "@/lib/boardview/lab";
import {
  resolveObservedCanvasMetrics,
  shouldAttachBoardviewObserver,
} from "@/lib/boardview/viewer-utils";

const DEFAULT_VIEWPORT: BoardviewViewport = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

type CanvasSize = {
  width: number;
  height: number;
};

type CanvasMetrics = CanvasSize;

export type BoardviewCanvasHandle = {
  fitToScreen: () => void;
  focusSelection: () => void;
  zoomBy: (multiplier: number) => void;
};

type BoardviewCanvasProps = {
  model: BoardviewLabModel | null;
  side: BoardviewLabSideFilter;
  selectedItem: BoardviewLabSelection | null;
  onSelectItem: (selection: BoardviewLabSelection) => void;
  onCanvasMetricsChange?: (metrics: CanvasMetrics) => void;
  onViewportChange?: (viewport: BoardviewViewport) => void;
};

function getSelectionComponent(selection: BoardviewLabSelection | null) {
  if (!selection) {
    return null;
  }

  if (selection.kind === "component") {
    return selection.component;
  }

  if (selection.kind === "padPin") {
    return selection.component;
  }

  return null;
}

function sameViewport(left: BoardviewViewport, right: BoardviewViewport) {
  return (
    Math.abs(left.scale - right.scale) < 0.0001 &&
    Math.abs(left.offsetX - right.offsetX) < 0.0001 &&
    Math.abs(left.offsetY - right.offsetY) < 0.0001
  );
}

export const BoardviewCanvas = forwardRef<
  BoardviewCanvasHandle,
  BoardviewCanvasProps
>(function BoardviewCanvas(
  {
    model,
    side,
    selectedItem,
    onSelectItem,
    onCanvasMetricsChange,
    onViewportChange,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pendingFitToScreenRef = useRef(true);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  }>({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });

  const [canvasHostElement, setCanvasHostElement] =
    useState<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({
    width: 0,
    height: 0,
  });
  const [canvasPixelRatio, setCanvasPixelRatio] = useState(1);
  const [viewport, setViewport] = useState<BoardviewViewport>(DEFAULT_VIEWPORT);

  useEffect(() => {
    pendingFitToScreenRef.current = true;
    setViewport(DEFAULT_VIEWPORT);
  }, [model]);

  useEffect(() => {
    onViewportChange?.(viewport);
  }, [onViewportChange, viewport]);

  useEffect(() => {
    if (!shouldAttachBoardviewObserver(canvasHostElement)) {
      return;
    }

    const element = canvasHostElement;
    let frameId = 0;

    function applyMetrics(
      nextWidth: number,
      nextHeight: number,
      nextPixelRatio: number,
    ) {
      setCanvasSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : {
              width: nextWidth,
              height: nextHeight,
            },
      );
      setCanvasPixelRatio((current) =>
        Math.abs(current - nextPixelRatio) < 0.001 ? current : nextPixelRatio,
      );
      onCanvasMetricsChange?.({
        width: nextWidth,
        height: nextHeight,
      });
    }

    function measureCurrentPanel() {
      const rect = element.getBoundingClientRect();
      const metrics = resolveObservedCanvasMetrics({
        cssWidth: rect.width,
        cssHeight: rect.height,
        fallbackPixelRatio: window.devicePixelRatio || 1,
      });

      applyMetrics(metrics.width, metrics.height, metrics.pixelRatio);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const devicePixelBox = Array.isArray(
        (entry as ResizeObserverEntry & {
          devicePixelContentBoxSize?: ResizeObserverSize | ResizeObserverSize[];
        }).devicePixelContentBoxSize,
      )
        ? (
            entry as ResizeObserverEntry & {
              devicePixelContentBoxSize?: ResizeObserverSize[];
            }
          ).devicePixelContentBoxSize?.[0]
        : (
            entry as ResizeObserverEntry & {
              devicePixelContentBoxSize?: ResizeObserverSize;
            }
          ).devicePixelContentBoxSize;

      const metrics = resolveObservedCanvasMetrics({
        cssWidth: entry.contentRect.width,
        cssHeight: entry.contentRect.height,
        devicePixelWidth: devicePixelBox?.inlineSize,
        devicePixelHeight: devicePixelBox?.blockSize,
        fallbackPixelRatio: window.devicePixelRatio || 1,
      });

      applyMetrics(metrics.width, metrics.height, metrics.pixelRatio);
    });

    observer.observe(element);
    frameId = window.requestAnimationFrame(measureCurrentPanel);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, [canvasHostElement, onCanvasMetricsChange]);

  const applyZoom = useCallback(
    (clientX: number, clientY: number, multiplier: number) => {
      if (!model || !canvasRef.current) {
        return;
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const anchorPoint = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
      const mirrorX = side === "bottom";
      const boardPoint = canvasToBoardPoint(
        anchorPoint,
        viewport,
        model.parsed.metadata.bounds,
        mirrorX,
      );
      const nextScale = Math.min(6, Math.max(0.04, viewport.scale * multiplier));
      const boardWidthMil =
        model.parsed.metadata.bounds.maxXMil -
        model.parsed.metadata.bounds.minXMil;
      const normalizedX = mirrorX
        ? boardWidthMil - (boardPoint.xMil - model.parsed.metadata.bounds.minXMil)
        : boardPoint.xMil - model.parsed.metadata.bounds.minXMil;

      pendingFitToScreenRef.current = false;
      setViewport({
        scale: nextScale,
        offsetX: anchorPoint.x - normalizedX * nextScale,
        offsetY:
          anchorPoint.y -
          (model.parsed.metadata.bounds.maxYMil - boardPoint.yMil) * nextScale,
      });
    },
    [model, side, viewport],
  );

  const fitToScreen = useCallback(() => {
    if (!model || canvasSize.width <= 0 || canvasSize.height <= 0) {
      pendingFitToScreenRef.current = true;
      return;
    }

    pendingFitToScreenRef.current = false;
    setViewport(
      fitBoardviewViewport(model.parsed.contour, canvasSize.width, canvasSize.height),
    );
  }, [canvasSize.height, canvasSize.width, model]);

  const focusSelection = useCallback(() => {
    const component = getSelectionComponent(selectedItem);

    if (
      !component ||
      !model ||
      canvasSize.width <= 0 ||
      canvasSize.height <= 0
    ) {
      return;
    }

    pendingFitToScreenRef.current = false;
    setViewport(
      focusBoardviewViewportOnComponent(
        component,
        model.parsed.metadata.bounds,
        canvasSize.width,
        canvasSize.height,
      ),
    );
  }, [canvasSize.height, canvasSize.width, model, selectedItem]);

  useImperativeHandle(
    ref,
    () => ({
      fitToScreen,
      focusSelection,
      zoomBy(multiplier: number) {
        if (!canvasRef.current || !model) {
          return;
        }

        const rect = canvasRef.current.getBoundingClientRect();
        applyZoom(rect.left + rect.width / 2, rect.top + rect.height / 2, multiplier);
      },
    }),
    [applyZoom, fitToScreen, focusSelection, model],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    function handleWheel(event: globalThis.WheelEvent) {
      if (!model) {
        return;
      }

      event.preventDefault();
      const multiplier = event.deltaY < 0 ? 1.12 : 0.89;
      applyZoom(event.clientX, event.clientY, multiplier);
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [applyZoom, model]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    if (
      canvasSize.width <= 0 ||
      canvasSize.height <= 0 ||
      canvasPixelRatio <= 0
    ) {
      return;
    }

    if (model && pendingFitToScreenRef.current) {
      const nextViewport = fitBoardviewViewport(
        model.parsed.contour,
        canvasSize.width,
        canvasSize.height,
      );
      pendingFitToScreenRef.current = false;
      setViewport((current) => (sameViewport(current, nextViewport) ? current : nextViewport));
      return;
    }

    canvas.width = Math.floor(canvasSize.width * canvasPixelRatio);
    canvas.height = Math.floor(canvasSize.height * canvasPixelRatio);
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
    context.setTransform(canvasPixelRatio, 0, 0, canvasPixelRatio, 0, 0);
    context.clearRect(0, 0, canvasSize.width, canvasSize.height);
    context.fillStyle = "#12111a";
    context.fillRect(0, 0, canvasSize.width, canvasSize.height);

    if (!model) {
      context.fillStyle = "rgba(230,228,245,0.6)";
      context.font = "14px monospace";
      context.fillText("Abra um arquivo .brd local.", 24, 32);
      return;
    }

    const mirrorX = side === "bottom";
    const bounds = model.parsed.metadata.bounds;
    const topLeftBoard = canvasToBoardPoint(
      { x: 0, y: 0 },
      viewport,
      bounds,
      mirrorX,
    );
    const bottomRightBoard = canvasToBoardPoint(
      { x: canvasSize.width, y: canvasSize.height },
      viewport,
      bounds,
      mirrorX,
    );
    const visibleMinX = Math.min(topLeftBoard.xMil, bottomRightBoard.xMil) - 80;
    const visibleMaxX = Math.max(topLeftBoard.xMil, bottomRightBoard.xMil) + 80;
    const visibleMinY = Math.min(topLeftBoard.yMil, bottomRightBoard.yMil) - 80;
    const visibleMaxY = Math.max(topLeftBoard.yMil, bottomRightBoard.yMil) + 80;

    const highlightNetName = getSelectionHighlightNetName(selectedItem);
    const selectedComponents = new Set(
      getSelectionVisibleComponents(model, selectedItem).map(
        (component) => component.ref,
      ),
    );

    context.beginPath();
    model.parsed.contour.forEach((point, index) => {
      const canvasPoint = boardToCanvasPoint(point, viewport, bounds, mirrorX);
      if (index === 0) {
        context.moveTo(canvasPoint.x, canvasPoint.y);
      } else {
        context.lineTo(canvasPoint.x, canvasPoint.y);
      }
    });
    context.closePath();
    context.lineWidth = 1.25;
    context.strokeStyle = "rgba(230,228,245,0.75)";
    context.stroke();

    const visibleComponents = model.components.filter((component) => {
      if (
        !(
          component.maxXMil >= visibleMinX &&
          component.minXMil <= visibleMaxX &&
          component.maxYMil >= visibleMinY &&
          component.minYMil <= visibleMaxY
        )
      ) {
        return false;
      }

      return side === "both"
        ? true
        : component.mountingSide === "both" || component.mountingSide === side;
    });

    const visiblePads = model.padPins.filter((padPin) => {
      if (
        !(
          padPin.xMil >= visibleMinX &&
          padPin.xMil <= visibleMaxX &&
          padPin.yMil >= visibleMinY &&
          padPin.yMil <= visibleMaxY
        )
      ) {
        return false;
      }

      return side === "both"
        ? true
        : padPin.side === "both" || padPin.side === side;
    });

    const visibleTestPoints = model.testPoints.filter((testPoint) => {
      if (
        !(
          testPoint.xMil >= visibleMinX &&
          testPoint.xMil <= visibleMaxX &&
          testPoint.yMil >= visibleMinY &&
          testPoint.yMil <= visibleMaxY
        )
      ) {
        return false;
      }

      return side === "both"
        ? true
        : testPoint.side === "both" || testPoint.side === side;
    });

    for (const padPin of visiblePads) {
      const point = boardToCanvasPoint(padPin, viewport, bounds, mirrorX);
      const isPadOnSelectedComponent =
        selectedItem?.kind === "component" &&
        selectedItem.component.ref === padPin.partRef;
      const size =
        padPin.netName === highlightNetName || selectedComponents.has(padPin.partRef)
          ? 4.4
          : viewport.scale > 0.45
            ? 2.7
            : 1.5;
      context.fillStyle =
        padPin.netName === highlightNetName
          ? "rgba(216,166,84,0.95)"
          : selectedComponents.has(padPin.partRef)
            ? "rgba(109,94,242,0.95)"
            : "rgba(113,221,199,0.85)";
      context.fillRect(point.x - size / 2, point.y - size / 2, size, size);

      if (
        viewport.scale > 2.35 &&
        (isPadOnSelectedComponent ||
          (padPin.netName === highlightNetName && viewport.scale > 3.2))
      ) {
        context.fillStyle = "rgba(230,228,245,0.86)";
        context.font = "10px monospace";
        context.fillText(String(padPin.pinOrdinalWithinPart), point.x + 4, point.y - 4);
      }
    }

    for (const testPoint of visibleTestPoints) {
      const point = boardToCanvasPoint(testPoint, viewport, bounds, mirrorX);
      const size = testPoint.netName === highlightNetName ? 7 : 5;
      context.strokeStyle =
        testPoint.netName === highlightNetName
          ? "rgba(255,214,102,0.95)"
          : "rgba(255,122,122,0.85)";
      context.lineWidth = 1.2;
      context.strokeRect(point.x - size / 2, point.y - size / 2, size, size);
    }

    for (const component of visibleComponents) {
      const center = boardToCanvasPoint(
        {
          xMil: component.centerXMil,
          yMil: component.centerYMil,
        },
        viewport,
        bounds,
        mirrorX,
      );
      const min = boardToCanvasPoint(
        {
          xMil: component.minXMil,
          yMil: component.maxYMil,
        },
        viewport,
        bounds,
        mirrorX,
      );
      const max = boardToCanvasPoint(
        {
          xMil: component.maxXMil,
          yMil: component.minYMil,
        },
        viewport,
        bounds,
        mirrorX,
      );
      const width = Math.max(4, Math.abs(max.x - min.x));
      const height = Math.max(4, Math.abs(max.y - min.y));
      const isPrimarySelectedComponent =
        selectedItem?.kind === "component" &&
        selectedItem.component.ref === component.ref;
      const isConnectedToSelection =
        !isPrimarySelectedComponent && selectedComponents.has(component.ref);

      context.strokeStyle = isPrimarySelectedComponent
        ? "rgba(109,94,242,0.98)"
        : isConnectedToSelection
          ? "rgba(216,166,84,0.66)"
          : "rgba(255,255,255,0.16)";
      context.lineWidth = isPrimarySelectedComponent
        ? 2.2
        : isConnectedToSelection
          ? 1.35
          : 1;
      context.strokeRect(
        Math.min(min.x, max.x) - 6,
        Math.min(min.y, max.y) - 6,
        width + 12,
        height + 12,
      );

      context.fillStyle = isPrimarySelectedComponent
        ? "rgba(109,94,242,0.98)"
        : isConnectedToSelection
          ? "rgba(216,166,84,0.92)"
          : component.mountingSide === "top"
            ? "rgba(85,192,150,0.9)"
            : component.mountingSide === "bottom"
              ? "rgba(120,170,255,0.9)"
              : "rgba(255,255,255,0.75)";
      context.fillRect(center.x - 2, center.y - 2, 4, 4);

      if (
        viewport.scale > 0.9 ||
        (isPrimarySelectedComponent && viewport.scale > 0.45) ||
        (isConnectedToSelection && viewport.scale > 1.45)
      ) {
        context.fillStyle = isPrimarySelectedComponent
          ? "rgba(255,255,255,0.98)"
          : isConnectedToSelection
            ? "rgba(255,244,214,0.92)"
            : "rgba(230,228,245,0.72)";
        context.font = "11px monospace";
        context.fillText(component.ref, center.x + 6, center.y - 8);
      }
    }
  }, [
    canvasPixelRatio,
    canvasSize.height,
    canvasSize.width,
    model,
    selectedItem,
    side,
    viewport,
  ]);

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!model || !canvasRef.current) {
      return;
    }

    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
    };

    canvasRef.current.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dragStateRef.current.active) {
      return;
    }

    const deltaX = event.clientX - dragStateRef.current.lastX;
    const deltaY = event.clientY - dragStateRef.current.lastY;
    dragStateRef.current.lastX = event.clientX;
    dragStateRef.current.lastY = event.clientY;
    pendingFitToScreenRef.current = false;

    setViewport((current) => ({
      ...current,
      offsetX: current.offsetX + deltaX,
      offsetY: current.offsetY + deltaY,
    }));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!model || !canvasRef.current) {
      return;
    }

    const dragState = dragStateRef.current;
    const movedDistance =
      Math.abs(event.clientX - dragState.startX) +
      Math.abs(event.clientY - dragState.startY);

    if (dragState.pointerId === event.pointerId) {
      dragState.active = false;
      canvasRef.current.releasePointerCapture(event.pointerId);
    }

    if (movedDistance > 4) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const mirrorX = side === "bottom";
    const boardPoint = canvasToBoardPoint(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      viewport,
      model.parsed.metadata.bounds,
      mirrorX,
    );
    const radiusMil = Math.max(18 / viewport.scale, 45);
    const nearest = findNearestBoardviewSelection(model, boardPoint, side, radiusMil);

    if (nearest) {
      onSelectItem(nearest);
    }
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!canvasRef.current) {
      return;
    }

    if (dragStateRef.current.pointerId === event.pointerId) {
      dragStateRef.current.active = false;
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="relative h-full min-h-0 min-w-0 w-full flex-1 overflow-hidden bg-[#12111a]">
      <div
        ref={setCanvasHostElement}
        className="relative h-full min-h-0 min-w-0 w-full"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        />
      </div>
    </div>
  );
});
