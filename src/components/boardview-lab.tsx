"use client";

import {
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  type BoardviewLabModel,
  type BoardviewLabSelection,
  type BoardviewLabSideFilter,
  boardToCanvasPoint,
  buildBoardviewLabModel,
  canvasToBoardPoint,
  findNearestBoardviewSelection,
  fitBoardviewViewport,
  getSelectionHighlightNetName,
  getSelectionVisibleComponents,
  isSelectionOnVisibleSide,
  searchBoardviewLabModel,
  type BoardviewViewport,
} from "@/lib/boardview/lab";
import {
  LandrexBoardviewParserError,
  parseLandrexTestlinkBoardview,
} from "@/lib/boardview/landrex-testlink";

const DEFAULT_VIEWPORT: BoardviewViewport = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

type CanvasSize = {
  width: number;
  height: number;
};

function selectionTitle(selection: BoardviewLabSelection | null) {
  if (!selection) {
    return "Nada selecionado";
  }

  switch (selection.kind) {
    case "component":
      return selection.component.ref;
    case "padPin":
      return selection.padPin.id;
    case "net":
      return selection.net.name;
    case "testPoint":
      return selection.testPoint.id;
  }
}

export function BoardviewLab() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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

  const [canvasSize, setCanvasSize] = useState<CanvasSize>({
    width: 0,
    height: 0,
  });
  const [fileName, setFileName] = useState<string | null>(null);
  const [model, setModel] = useState<BoardviewLabModel | null>(null);
  const [viewport, setViewport] = useState<BoardviewViewport>(DEFAULT_VIEWPORT);
  const [sideFilter, setSideFilter] = useState<BoardviewLabSideFilter>("both");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BoardviewLabSelection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const visibleSelected =
    selected && isSelectionOnVisibleSide(selected, sideFilter) ? selected : null;

  const searchHits = model
    ? searchBoardviewLabModel(model, deferredQuery, sideFilter)
    : [];

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const element = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setCanvasSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      });

      if (model) {
        setViewport(
          fitBoardviewViewport(
            model.parsed.contour,
            Math.round(entry.contentRect.width),
            Math.round(entry.contentRect.height),
          ),
        );
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [model]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(canvasSize.width * devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(canvasSize.height * devicePixelRatio));
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    const frame = requestAnimationFrame(() => {
      context.clearRect(0, 0, canvasSize.width, canvasSize.height);
      context.fillStyle = "#12111a";
      context.fillRect(0, 0, canvasSize.width, canvasSize.height);

      if (!model) {
        context.fillStyle = "rgba(230,228,245,0.6)";
        context.font = "14px monospace";
        context.fillText(
          "Selecione um arquivo .brd local para iniciar o laboratorio.",
          24,
          32,
        );
        return;
      }

      const mirrorX = sideFilter === "bottom";
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

      const highlightNetName = getSelectionHighlightNetName(visibleSelected);
      const selectedComponents = new Set(
        getSelectionVisibleComponents(model, visibleSelected).map(
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

        return sideFilter === "both"
          ? true
          : component.mountingSide === "both" || component.mountingSide === sideFilter;
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

        return sideFilter === "both"
          ? true
          : padPin.side === "both" || padPin.side === sideFilter;
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

        return sideFilter === "both"
          ? true
          : testPoint.side === "both" || testPoint.side === sideFilter;
      });

      context.fillStyle = "rgba(113, 221, 199, 0.85)";
      for (const padPin of visiblePads) {
        const point = boardToCanvasPoint(padPin, viewport, bounds, mirrorX);
        const size =
          padPin.netName === highlightNetName || selectedComponents.has(padPin.partRef)
            ? 4
            : viewport.scale > 0.45
              ? 2.6
              : 1.5;
        context.fillStyle =
          padPin.netName === highlightNetName
            ? "rgba(216,166,84,0.95)"
            : selectedComponents.has(padPin.partRef)
              ? "rgba(109,94,242,0.95)"
              : "rgba(113,221,199,0.85)";
        context.fillRect(point.x - size / 2, point.y - size / 2, size, size);
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
        const isHighlighted =
          selectedComponents.has(component.ref) ||
          (visibleSelected?.kind === "component" &&
            visibleSelected.component.ref === component.ref);

        context.strokeStyle = isHighlighted
          ? "rgba(109,94,242,0.95)"
          : "rgba(255,255,255,0.2)";
        context.lineWidth = isHighlighted ? 1.6 : 1;
        context.strokeRect(
          Math.min(min.x, max.x) - 4,
          Math.min(min.y, max.y) - 4,
          width + 8,
          height + 8,
        );

        context.fillStyle = isHighlighted
          ? "rgba(109,94,242,0.98)"
          : component.mountingSide === "top"
            ? "rgba(85, 192, 150, 0.9)"
            : component.mountingSide === "bottom"
              ? "rgba(120, 170, 255, 0.9)"
              : "rgba(255,255,255,0.75)";
        context.fillRect(center.x - 2, center.y - 2, 4, 4);

        if (viewport.scale > 0.72 || isHighlighted) {
          context.fillStyle = isHighlighted
            ? "rgba(255,255,255,0.95)"
            : "rgba(230,228,245,0.74)";
          context.font = "11px monospace";
          context.fillText(component.ref, center.x + 6, center.y - 6);
        }
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [canvasSize.height, canvasSize.width, model, sideFilter, viewport, visibleSelected]);

  function handleFitToScreen() {
    if (!model || !canvasSize.width || !canvasSize.height) {
      return;
    }

    setViewport(
      fitBoardviewViewport(model.parsed.contour, canvasSize.width, canvasSize.height),
    );
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsReadingFile(true);
    setErrorMessage(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const parsed = parseLandrexTestlinkBoardview(new Uint8Array(arrayBuffer));
      const nextModel = buildBoardviewLabModel(parsed);

      startTransition(() => {
        setFileName(file.name);
        setModel(nextModel);
        setSelected(null);
        setQuery("");
        setSideFilter("both");
        setViewport(
          fitBoardviewViewport(
            nextModel.parsed.contour,
            canvasSize.width || 1200,
            canvasSize.height || 720,
          ),
        );
      });
    } catch (error) {
      const message =
        error instanceof LandrexBoardviewParserError || error instanceof Error
          ? error.message
          : "Nao foi possivel abrir este arquivo .brd.";
      setErrorMessage(
        `Falha ao abrir o boardview. Confirme se o arquivo e um Landrex/Testlink valido. Detalhe: ${message}`,
      );
      setModel(null);
      setFileName(file.name);
      setSelected(null);
    } finally {
      setIsReadingFile(false);
      event.target.value = "";
    }
  }

  function updateZoom(clientX: number, clientY: number, multiplier: number) {
    if (!model || !canvasRef.current) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const anchorPoint = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    const mirrorX = sideFilter === "bottom";
    const boardPoint = canvasToBoardPoint(
      anchorPoint,
      viewport,
      model.parsed.metadata.bounds,
      mirrorX,
    );
    const nextScale = Math.min(6, Math.max(0.04, viewport.scale * multiplier));
    const boardWidthMil =
      model.parsed.metadata.bounds.maxXMil - model.parsed.metadata.bounds.minXMil;
    const normalizedX = mirrorX
      ? boardWidthMil - (boardPoint.xMil - model.parsed.metadata.bounds.minXMil)
      : boardPoint.xMil - model.parsed.metadata.bounds.minXMil;

    setViewport({
      scale: nextScale,
      offsetX: anchorPoint.x - normalizedX * nextScale,
      offsetY:
        anchorPoint.y -
        (model.parsed.metadata.bounds.maxYMil - boardPoint.yMil) * nextScale,
    });
  }

  function handleWheel(event: WheelEvent<HTMLCanvasElement>) {
    if (!model) {
      return;
    }

    event.preventDefault();
    const multiplier = event.deltaY < 0 ? 1.12 : 0.89;
    updateZoom(event.clientX, event.clientY, multiplier);
  }

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
    const mirrorX = sideFilter === "bottom";
    const boardPoint = canvasToBoardPoint(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      viewport,
      model.parsed.metadata.bounds,
      mirrorX,
    );
    const radiusMil = Math.max(18 / viewport.scale, 45);
    const nearest = findNearestBoardviewSelection(
      model,
      boardPoint,
      sideFilter,
      radiusMil,
    );
    setSelected(nearest);
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_380px]">
      <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 shadow-[0_18px_44px_rgba(20,18,28,0.06)] sm:p-5">
        <div className="flex flex-col gap-4 border-b border-[var(--panel-border)] pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                Boardview lab
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                Laboratorio local de arquivos .brd
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                O arquivo e lido somente no navegador. Nada e enviado ao servidor ou ao Supabase.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleFitToScreen}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/5"
              >
                Ajustar a tela
              </button>
              <label className="cursor-pointer rounded-full bg-[var(--accent-copper)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(109,94,242,0.28)] transition hover:-translate-y-0.5 hover:bg-[#5b4ed9]">
                {isReadingFile ? "Lendo arquivo..." : "Abrir .brd local"}
                <input
                  type="file"
                  accept=".brd"
                  className="hidden"
                  onChange={handleFileSelection}
                />
              </label>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
            <div className="rounded-[20px] border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)]">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Arquivo atual
              </p>
              <p className="mt-1 truncate">{fileName ?? "Nenhum arquivo aberto"}</p>
            </div>

            <div className="flex rounded-full border border-[var(--panel-border)] bg-[var(--background)] p-1">
              {(["both", "top", "bottom"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSideFilter(value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                    sideFilter === value
                      ? "bg-[var(--accent-copper)] text-white"
                      : "text-[var(--muted)] hover:text-white"
                  }`}
                >
                  {value === "both"
                    ? "Ambos"
                    : value === "top"
                      ? "Superior"
                      : "Inferior"}
                </button>
              ))}
            </div>

            <div className="rounded-[20px] border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)]">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Zoom
              </p>
              <p className="mt-1">{viewport.scale.toFixed(2)} px/mil</p>
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-[20px] border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div
            ref={containerRef}
            className="relative min-h-[420px] overflow-hidden rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] md:min-h-[560px]"
          >
            <canvas
              ref={canvasRef}
              className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
            />
          </div>

          <aside className="grid gap-4">
            <div className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Busca local
              </p>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar referencia ou net"
                className="mt-3 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[rgba(109,94,242,0.55)]"
              />

              <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {searchHits.length ? (
                  searchHits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => setSelected(hit.selection)}
                      className="w-full rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-3 text-left transition hover:bg-white/5"
                    >
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {hit.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                        {hit.subtitle}
                      </p>
                    </button>
                  ))
                ) : query.trim() ? (
                  <div className="rounded-[18px] border border-dashed border-[var(--panel-border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                    Nenhum resultado para esta busca.
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-dashed border-[var(--panel-border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                    Digite uma referencia ou net para localizar itens no boardview.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Totais lidos
              </p>
              {model ? (
                <div className="mt-3 grid gap-2 text-sm text-[var(--foreground)]">
                  <p>Componentes: {model.parsed.metadata.parsedCounts.components}</p>
                  <p>Pads/pinos: {model.parsed.metadata.parsedCounts.padPins}</p>
                  <p>Test points: {model.parsed.metadata.parsedCounts.testPoints}</p>
                  <p>Nets: {model.parsed.metadata.parsedCounts.nets}</p>
                  <p>
                    Placa: {model.parsed.metadata.boardWidthMm.toFixed(2)} x{" "}
                    {model.parsed.metadata.boardHeightMm.toFixed(2)} mm
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Nenhum boardview carregado.
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>

      <aside className="grid gap-4">
        <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Painel de selecao
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">
            {selectionTitle(visibleSelected)}
          </h3>

          {!visibleSelected ? (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Clique em um componente, pad, test point ou resultado de busca para inspecionar os detalhes.
            </p>
          ) : null}

          {visibleSelected?.kind === "component" ? (
            <div className="mt-4 grid gap-2 text-sm text-[var(--foreground)]">
              <p>Referencia: {visibleSelected.component.ref}</p>
              <p>Lado: {visibleSelected.component.mountingSide}</p>
              <p>Tipo: {visibleSelected.component.kind}</p>
              <p>Pinos: {visibleSelected.component.pinCount}</p>
              <p>
                Centro: {visibleSelected.component.centerXMil.toFixed(1)} /{" "}
                {visibleSelected.component.centerYMil.toFixed(1)} mil
              </p>
            </div>
          ) : null}

          {visibleSelected?.kind === "padPin" ? (
            <div className="mt-4 grid gap-2 text-sm text-[var(--foreground)]">
              <p>Pad/pino: {visibleSelected.padPin.id}</p>
              <p>Componente: {visibleSelected.padPin.partRef}</p>
              <p>Net: {visibleSelected.padPin.netName}</p>
              <p>Lado: {visibleSelected.padPin.side}</p>
              <p>Probe: {visibleSelected.padPin.probe}</p>
              <p>
                Coordenadas: {visibleSelected.padPin.xMil} /{" "}
                {visibleSelected.padPin.yMil} mil
              </p>
            </div>
          ) : null}

          {visibleSelected?.kind === "net" ? (
            <div className="mt-4 grid gap-2 text-sm text-[var(--foreground)]">
              <p>Net: {visibleSelected.net.name}</p>
              <p>Pads: {visibleSelected.net.padPinCount}</p>
              <p>Test points: {visibleSelected.net.testPointCount}</p>
              <p>Probes: {visibleSelected.net.probeIds.length}</p>
            </div>
          ) : null}

          {visibleSelected?.kind === "testPoint" ? (
            <div className="mt-4 grid gap-2 text-sm text-[var(--foreground)]">
              <p>Test point: {visibleSelected.testPoint.id}</p>
              <p>Net: {visibleSelected.testPoint.netName}</p>
              <p>Lado: {visibleSelected.testPoint.side}</p>
              <p>Probe: {visibleSelected.testPoint.probe}</p>
              <p>
                Coordenadas: {visibleSelected.testPoint.xMil} /{" "}
                {visibleSelected.testPoint.yMil} mil
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Como usar
          </p>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-[var(--muted)]">
            <p>1. Abra um arquivo .brd local Landrex/Testlink.</p>
            <p>2. Use o mouse para zoom e arraste para pan.</p>
            <p>3. Clique em componentes, pads ou test points para inspecionar.</p>
            <p>4. Busque por referencia ou net para destacar o resultado.</p>
            <p>5. Alterne entre lado superior, inferior ou ambos.</p>
          </div>
        </section>
      </aside>
    </div>
  );
}
