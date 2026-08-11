"use client";

import {
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  BoardviewCanvas,
  type BoardviewCanvasHandle,
} from "@/components/boardview-canvas";
import { SchematicPdfViewer } from "@/components/schematic-pdf-viewer";
import {
  type BoardviewLabModel,
  type BoardviewLabSelection,
  type BoardviewLabSideFilter,
  buildBoardviewLabModel,
  getComponentPadPins,
  getNetDetails,
  isSelectionOnVisibleSide,
  searchBoardviewLabModel,
} from "@/lib/boardview/lab";
import {
  LandrexBoardviewParserError,
  parseLandrexTestlinkBoardview,
} from "@/lib/boardview/landrex-testlink";
import { getBoardviewSelectionSchematicQuery } from "@/lib/boardview/schematic-pdf";
import { calculateAvailableViewportHeight } from "@/lib/boardview/viewer-utils";

type CanvasSize = {
  width: number;
  height: number;
};

type LabViewerMode = "split" | "boardview" | "schematic";
type MobileWorkspaceTab = "boardview" | "schematic" | "details";

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

export function BoardviewLab() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const boardviewCanvasRef = useRef<BoardviewCanvasHandle | null>(null);
  const pendingSelectionFocusRef = useRef(false);
  const splitResizeStateRef = useRef<{
    active: boolean;
    pointerId: number;
  }>({
    active: false,
    pointerId: -1,
  });

  const [canvasSize, setCanvasSize] = useState<CanvasSize>({
    width: 0,
    height: 0,
  });
  const [boardScale, setBoardScale] = useState(1);
  const [rootHeight, setRootHeight] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [model, setModel] = useState<BoardviewLabModel | null>(null);
  const [sideFilter, setSideFilter] = useState<BoardviewLabSideFilter>("both");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BoardviewLabSelection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfErrorMessage, setPdfErrorMessage] = useState<string | null>(null);
  const [isReadingPdfFile, setIsReadingPdfFile] = useState(false);
  const [viewerMode, setViewerMode] = useState<LabViewerMode>("split");
  const [mobileTab, setMobileTab] = useState<MobileWorkspaceTab>("boardview");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.52);
  const deferredQuery = useDeferredValue(query);

  const visibleSelected =
    selected && isSelectionOnVisibleSide(selected, sideFilter) ? selected : null;
  const selectedComponent = getSelectionComponent(visibleSelected);
  const hasAnyFileOpen = Boolean(model || pdfBytes);
  const resolvedMobileTab =
    mobileTab === "boardview" && !model && pdfBytes
      ? "schematic"
      : mobileTab === "schematic" && !pdfBytes
        ? "boardview"
        : mobileTab;
  const linkedSchematicQuery = useMemo(
    () => getBoardviewSelectionSchematicQuery(selected),
    [selected],
  );
  const searchHits = model
    ? searchBoardviewLabModel(model, deferredQuery, sideFilter)
    : [];

  const componentPadPins = useMemo(
    () =>
      model && selectedComponent
        ? getComponentPadPins(model, selectedComponent)
        : [],
    [model, selectedComponent],
  );

  const selectedNetDetails = useMemo(() => {
    if (!model) {
      return null;
    }

    if (visibleSelected?.kind === "net") {
      return getNetDetails(model, visibleSelected.net.name);
    }

    if (visibleSelected?.kind === "padPin") {
      return getNetDetails(model, visibleSelected.padPin.netName);
    }

    if (visibleSelected?.kind === "testPoint") {
      return getNetDetails(model, visibleSelected.testPoint.netName);
    }

    return null;
  }, [model, visibleSelected]);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const element = rootRef.current;
    const parent = element.parentElement;
    const parentStyles = parent ? window.getComputedStyle(parent) : null;

    function syncRootHeight() {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const parentPaddingBottom = parentStyles
        ? Number.parseFloat(parentStyles.paddingBottom) || 0
        : 0;
      const nextHeight = calculateAvailableViewportHeight(
        element.getBoundingClientRect().top,
        parentPaddingBottom,
        viewportHeight,
      );

      setRootHeight((current) => (current === nextHeight ? current : nextHeight));
    }

    const observer = new ResizeObserver(() => {
      syncRootHeight();
    });

    observer.observe(document.body);
    if (parent) {
      observer.observe(parent);
    }

    syncRootHeight();
    window.addEventListener("resize", syncRootHeight);
    window.visualViewport?.addEventListener("resize", syncRootHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncRootHeight);
      window.visualViewport?.removeEventListener("resize", syncRootHeight);
    };
  }, []);

  useEffect(() => {
    if (!pendingSelectionFocusRef.current || !visibleSelected) {
      return;
    }

    boardviewCanvasRef.current?.focusSelection();
    pendingSelectionFocusRef.current = false;
  }, [visibleSelected]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!splitResizeStateRef.current.active || !workspaceRef.current) {
        return;
      }

      const rect = workspaceRef.current.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      const nextRatio = (event.clientX - rect.left) / rect.width;
      setSplitRatio(Math.min(0.72, Math.max(0.28, nextRatio)));
    }

    function handlePointerEnd() {
      splitResizeStateRef.current = {
        active: false,
        pointerId: -1,
      };
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
    };
  }, []);

  function selectEntry(selection: BoardviewLabSelection, autoFocus = false) {
    setSelected(selection);
    setDetailsOpen(true);
    pendingSelectionFocusRef.current = autoFocus;
  }

  function handleFitToScreen() {
    boardviewCanvasRef.current?.fitToScreen();
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
        setBoardScale(1);
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

  async function handlePdfFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsReadingPdfFile(true);
    setPdfErrorMessage(null);

    try {
      const arrayBuffer = await file.arrayBuffer();

      startTransition(() => {
        setPdfFileName(file.name);
        setPdfBytes(new Uint8Array(arrayBuffer));
        setViewerMode("split");
      });
    } catch (error) {
      setPdfBytes(null);
      setPdfFileName(file.name);
      setPdfErrorMessage(
        error instanceof Error
          ? `Falha ao abrir o PDF local. Detalhe: ${error.message}`
          : "Falha ao abrir o PDF local.",
      );
    } finally {
      setIsReadingPdfFile(false);
      event.target.value = "";
    }
  }

  function handleZoomStep(multiplier: number) {
    boardviewCanvasRef.current?.zoomBy(multiplier);
  }

  function handleSplitPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    splitResizeStateRef.current = {
      active: true,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleSplitPointerEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    if (splitResizeStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    splitResizeStateRef.current = {
      active: false,
      pointerId: -1,
    };
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const detailDrawerContent = (
    <div className="grid gap-4">
      <section className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          Selecao
        </p>
        <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--foreground)]">
          {selectionTitle(visibleSelected)}
        </h3>

        {!visibleSelected ? (
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Selecione um componente, pad, pino ou net para abrir os detalhes tecnicos.
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
            <button
              type="button"
              onClick={() =>
                visibleSelected.net &&
                selectEntry({ kind: "net", net: visibleSelected.net })
              }
              className="text-left text-[var(--accent-copper)] underline decoration-transparent transition hover:decoration-current"
            >
              Net: {visibleSelected.padPin.netName}
            </button>
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
            <button
              type="button"
              onClick={() =>
                visibleSelected.net &&
                selectEntry({ kind: "net", net: visibleSelected.net })
              }
              className="text-left text-[var(--accent-copper)] underline decoration-transparent transition hover:decoration-current"
            >
              Net: {visibleSelected.testPoint.netName}
            </button>
            <p>Lado: {visibleSelected.testPoint.side}</p>
            <p>Probe: {visibleSelected.testPoint.probe}</p>
            <p>
              Coordenadas: {visibleSelected.testPoint.xMil} /{" "}
              {visibleSelected.testPoint.yMil} mil
            </p>
          </div>
        ) : null}
      </section>

      {model ? (
        <section className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Detalhamento tecnico
          </p>

          {!visibleSelected ? (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Abra um item para navegar entre pinos, nets e conexoes relacionadas.
            </p>
          ) : null}

          {selectedComponent ? (
            <div className="mt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-[var(--foreground)]">
                  Pads/pinos do componente
                </h4>
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  {componentPadPins.length}
                </span>
              </div>
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {componentPadPins.map((padPin) => (
                  <div
                    key={padPin.id}
                    className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-3"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        selectEntry(
                          {
                            kind: "padPin",
                            padPin,
                            component: selectedComponent,
                            net: model.netsByName.get(padPin.netName) ?? null,
                          },
                          true,
                        )
                      }
                      className="w-full text-left transition hover:text-white"
                    >
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        Pin {padPin.pinOrdinalWithinPart}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                        Nome: {padPin.id}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const net = model.netsByName.get(padPin.netName);
                        if (net) {
                          selectEntry({ kind: "net", net });
                        }
                      }}
                      className="mt-2 text-xs text-[var(--accent-copper)] underline decoration-transparent transition hover:decoration-current"
                    >
                      Net ligada: {padPin.netName}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedNetDetails ? (
            <div className="mt-4 grid gap-4">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-[var(--foreground)]">
                    Componentes conectados
                  </h4>
                  <span className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    {selectedNetDetails.components.length}
                  </span>
                </div>
                <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
                  {selectedNetDetails.components.map((component) => (
                    <button
                      key={component.ref}
                      type="button"
                      onClick={() =>
                        selectEntry({ kind: "component", component }, true)
                      }
                      className="w-full rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-3 text-left transition hover:bg-white/5"
                    >
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {component.ref}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                        {component.pinCount} pads • {component.mountingSide}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-[var(--foreground)]">
                    Pads desta net
                  </h4>
                  <span className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    {selectedNetDetails.padPins.length}
                  </span>
                </div>
                <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                  {selectedNetDetails.padPins.map((padPin) => {
                    const component =
                      model.componentsByIndex.get(padPin.partIndex) ?? null;
                    return (
                      <button
                        key={`${padPin.id}:${padPin.netName}`}
                        type="button"
                        onClick={() =>
                          selectEntry(
                            {
                              kind: "padPin",
                              padPin,
                              component,
                              net: selectedNetDetails.net,
                            },
                            true,
                          )
                        }
                        className="w-full rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-3 text-left transition hover:bg-white/5"
                      >
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {padPin.partRef} • Pin {padPin.pinOrdinalWithinPart}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                          Nome: {padPin.id}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );

  const boardviewWorkspace = (
    <section className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)]">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--panel-border)] px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
            {fileName ?? "Boardview"}
          </p>
        </div>
        {selectedComponent ? (
          <button
            type="button"
            onClick={() => boardviewCanvasRef.current?.focusSelection()}
            className="rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-white/5"
          >
            Componente
          </button>
        ) : null}
      </div>

      <div className="relative h-full min-h-0 min-w-0 w-full flex-1 overflow-hidden bg-[#12111a]">
        <BoardviewCanvas
          ref={boardviewCanvasRef}
          model={model}
          side={sideFilter}
          selectedItem={visibleSelected}
          onSelectItem={(selection) =>
            selectEntry(
              selection,
              selection.kind === "component" || selection.kind === "padPin",
            )
          }
          onCanvasMetricsChange={setCanvasSize}
          onViewportChange={(nextViewport) => setBoardScale(nextViewport.scale)}
        />
        {query.trim() ? (
          <div className="absolute left-3 top-3 z-10 w-[min(24rem,calc(100%-1.5rem))] overflow-hidden rounded-[20px] border border-[var(--panel-border)] bg-[rgba(18,17,26,0.94)] shadow-[0_18px_40px_rgba(0,0,0,0.3)] backdrop-blur">
            <div className="max-h-[22rem] overflow-y-auto p-2">
              {searchHits.length ? (
                searchHits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() =>
                      selectEntry(
                        hit.selection,
                        hit.selection.kind === "component" ||
                          hit.selection.kind === "padPin",
                      )
                    }
                    className="w-full rounded-[16px] px-3 py-3 text-left transition hover:bg-white/5"
                  >
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {hit.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      {hit.subtitle}
                    </p>
                  </button>
                ))
              ) : (
                <div className="px-3 py-5 text-center text-sm text-[var(--muted)]">
                  Nenhum resultado para esta busca.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );

  const emptyWorkspace = (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
        Laboratorio tecnico
      </p>
      <h3 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
        Abra um BRD ou esquema local
      </h3>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <label className="cursor-pointer rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#5b4ed9]">
          Abrir BRD
          <input
            type="file"
            accept=".brd"
            className="hidden"
            onChange={handleFileSelection}
          />
        </label>
        <label className="cursor-pointer rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/5">
          Abrir PDF
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handlePdfFileSelection}
          />
        </label>
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="relative flex min-h-0 flex-col overflow-hidden rounded-[26px] border border-[var(--panel-border)] bg-[var(--card-surface)]"
      style={{
        height: rootHeight ? `${rootHeight}px` : undefined,
      }}
    >
      <div className="border-b border-[var(--panel-border)] px-3 py-2.5 sm:px-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-full bg-[var(--accent-copper)] px-3.5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#5b4ed9]">
            {isReadingFile ? "Lendo BRD..." : "Abrir BRD"}
            <input
              type="file"
              accept=".brd"
              className="hidden"
              onChange={handleFileSelection}
            />
          </label>
          <label className="cursor-pointer rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-3.5 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/5">
            {isReadingPdfFile ? "Lendo PDF..." : "Abrir PDF"}
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handlePdfFileSelection}
            />
          </label>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar referencia ou net"
            className="min-w-[12rem] flex-1 rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-3.5 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[rgba(109,94,242,0.55)]"
          />
          <div className="hidden rounded-full border border-[var(--panel-border)] bg-[var(--background)] p-1 lg:flex">
            {[
              { value: "split", label: "Lado a lado" },
              { value: "boardview", label: "Boardview" },
              { value: "schematic", label: "Esquema" },
            ].map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => {
                  const nextMode = entry.value as LabViewerMode;
                  setViewerMode(nextMode);
                  if (nextMode === "boardview") {
                    setMobileTab("boardview");
                  } else if (nextMode === "schematic") {
                    setMobileTab("schematic");
                  }
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                  viewerMode === entry.value
                    ? "bg-[var(--accent-copper)] text-white"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <div className="hidden rounded-full border border-[var(--panel-border)] bg-[var(--background)] p-1 lg:flex">
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
          <button
            type="button"
            onClick={handleFitToScreen}
            disabled={!model}
            className="rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-3.5 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ajustar a tela
          </button>
          <div className="flex items-center rounded-full border border-[var(--panel-border)] bg-[var(--background)] p-1">
            <button
              type="button"
              onClick={() => handleZoomStep(0.89)}
              disabled={!model}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              -
            </button>
            <span className="px-2 text-xs font-medium text-[var(--muted)]">
              {boardScale.toFixed(2)} px/mil
            </span>
            <button
              type="button"
              onClick={() => handleZoomStep(1.12)}
              disabled={!model}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => setDetailsOpen((value) => !value)}
            className="hidden rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-3.5 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/5 lg:block"
          >
            {detailsOpen ? "Fechar detalhes" : "Detalhes"}
          </button>
          <div className="hidden items-center rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-3 py-2 text-xs font-medium text-[var(--muted)] xl:flex">
            Canvas: {canvasSize.width} x {canvasSize.height}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 lg:hidden">
          <div className="flex rounded-full border border-[var(--panel-border)] bg-[var(--background)] p-1">
            {[
              { value: "split", label: "Ambos" },
              { value: "boardview", label: "BRD" },
              { value: "schematic", label: "PDF" },
            ].map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => setViewerMode(entry.value as LabViewerMode)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                  viewerMode === entry.value
                    ? "bg-[var(--accent-copper)] text-white"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                {entry.label}
              </button>
            ))}
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
          <div className="flex items-center rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-3 py-2 text-xs font-medium text-[var(--muted)]">
            Canvas: {canvasSize.width} x {canvasSize.height}
          </div>
        </div>

        <div className="mt-2 flex rounded-full border border-[var(--panel-border)] bg-[var(--background)] p-1 lg:hidden">
          {[
            { value: "boardview", label: "Boardview" },
            { value: "schematic", label: "Esquema" },
            { value: "details", label: "Detalhes" },
          ].map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setMobileTab(entry.value as MobileWorkspaceTab)}
              className={`min-w-0 flex-1 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                mobileTab === entry.value
                  ? "bg-[var(--accent-copper)] text-white"
                  : "text-[var(--muted)] hover:text-white"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {(errorMessage || pdfErrorMessage) && hasAnyFileOpen ? (
        <div className="border-b border-[var(--panel-border)] px-4 py-3 text-sm text-[var(--danger)]">
          {[errorMessage, pdfErrorMessage].filter(Boolean).join(" ")}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden p-2.5 sm:p-3">
        {!hasAnyFileOpen ? (
          emptyWorkspace
        ) : (
          <>
            <div className="hidden h-full min-h-0 lg:block">
              <div
                ref={workspaceRef}
                className="grid h-full min-h-0 min-w-0 gap-2.5"
                style={{
                  gridTemplateColumns:
                    viewerMode === "split"
                      ? `${splitRatio}fr 14px ${1 - splitRatio}fr`
                      : "minmax(0,1fr)",
                }}
              >
                {viewerMode !== "schematic" ? boardviewWorkspace : null}

                {viewerMode === "split" ? (
                  <button
                    type="button"
                    aria-label="Redimensionar paineis"
                    onPointerDown={handleSplitPointerDown}
                    onPointerUp={handleSplitPointerEnd}
                    onPointerCancel={handleSplitPointerEnd}
                    className="rounded-full bg-[var(--background)] text-[var(--muted)] transition hover:bg-white/5"
                  >
                    ||
                  </button>
                ) : null}

                {viewerMode !== "boardview" ? (
                  <div className="min-h-0 min-w-0">
                    <SchematicPdfViewer
                      fileBytes={pdfBytes}
                      fileName={pdfFileName}
                      linkedSearchTerm={linkedSchematicQuery}
                      searchQuery={query}
                      isReadingFile={isReadingPdfFile}
                      errorMessage={pdfErrorMessage}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="h-full min-h-0 lg:hidden">
              {resolvedMobileTab === "boardview" ? (
                boardviewWorkspace
              ) : resolvedMobileTab === "schematic" ? (
                <SchematicPdfViewer
                  fileBytes={pdfBytes}
                  fileName={pdfFileName}
                  linkedSearchTerm={linkedSchematicQuery}
                  searchQuery={query}
                  isReadingFile={isReadingPdfFile}
                  errorMessage={pdfErrorMessage}
                />
              ) : (
                <div className="h-full min-h-0 overflow-y-auto">
                  {detailDrawerContent}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {detailsOpen ? (
        <div className="fixed inset-0 z-50 bg-[rgba(7,7,10,0.14)]">
          <div className="absolute inset-y-2 right-2 w-[min(94vw,26rem)] sm:w-[min(92vw,24rem)] lg:w-[min(26rem,calc(100vw-1.5rem))]">
            <div className="ml-auto flex h-full w-full flex-col overflow-hidden rounded-[24px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 shadow-[-24px_0_48px_rgba(0,0,0,0.25)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Drawer tecnico
              </p>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-white/5"
              >
                Fechar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {detailDrawerContent}
            </div>
          </div>
        </div>
        </div>
      ) : null}
    </div>
  );
}
