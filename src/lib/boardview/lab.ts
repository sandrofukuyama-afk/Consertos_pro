import type {
  BoardviewComponent,
  BoardviewMountingSide,
  BoardviewNet,
  BoardviewPadPin,
  BoardviewPoint,
  BoardviewTestPoint,
  ParsedBoardview,
} from "@/types/boardview";

export type BoardviewLabSideFilter = "top" | "bottom" | "both";

export function inferNetVoltageHint(netName: string): string | null {
  const normalized = netName.trim().toUpperCase();

  const isGround =
    /^(A|D|P)?GND(_|\d*$)/.test(normalized) ||
    /_GND(_|\d*$)/.test(normalized) ||
    /^VSS(_|\d*$)/.test(normalized);

  if (isGround) {
    return "0V (GND)";
  }

  const railMatches = [...normalized.matchAll(/P{1,2}(\d+)V(\d+)?(?=_|$)/g)];
  if (!railMatches.length) {
    return null;
  }

  const distinctValues = new Set(
    railMatches.map(([, whole, decimals]) => (decimals ? `${whole}.${decimals}` : whole)),
  );

  if (distinctValues.size !== 1) {
    return null;
  }

  const value = `${[...distinctValues][0]}V`;
  const isDerivedReference = /(VREF|_REF\d*$|SENSE)/.test(normalized);

  return isDerivedReference ? `${value} (referencia, pode ser reduzida - confira)` : value;
}

export type BoardviewViewport = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type BoardviewLabComponent = BoardviewComponent & {
  centerXMil: number;
  centerYMil: number;
  minXMil: number;
  maxXMil: number;
  minYMil: number;
  maxYMil: number;
};

export type BoardviewLabSelection =
  | {
      kind: "component";
      component: BoardviewLabComponent;
    }
  | {
      kind: "padPin";
      padPin: BoardviewPadPin;
      component: BoardviewLabComponent | null;
      net: BoardviewNet | null;
    }
  | {
      kind: "net";
      net: BoardviewNet;
    }
  | {
      kind: "testPoint";
      testPoint: BoardviewTestPoint;
      net: BoardviewNet | null;
    };

export type BoardviewSearchHit = {
  id: string;
  title: string;
  subtitle: string;
  keywords: string[];
  selection: BoardviewLabSelection;
};

type SpatialItemKind = "padPin" | "testPoint" | "component";

type SpatialItem = {
  id: string;
  kind: SpatialItemKind;
  xMil: number;
  yMil: number;
};

type SpatialIndex = {
  cellSizeMil: number;
  buckets: Map<string, SpatialItem[]>;
};

export type BoardviewLabNetDetails = {
  net: BoardviewNet;
  components: BoardviewLabComponent[];
  padPins: BoardviewPadPin[];
  testPoints: BoardviewTestPoint[];
};

export type BoardviewLabModel = {
  parsed: ParsedBoardview;
  components: BoardviewLabComponent[];
  componentsByIndex: Map<number, BoardviewLabComponent>;
  componentsByRef: Map<string, BoardviewLabComponent>;
  padPins: BoardviewPadPin[];
  padPinsById: Map<string, BoardviewPadPin>;
  padPinsByPartIndex: Map<number, BoardviewPadPin[]>;
  testPoints: BoardviewTestPoint[];
  testPointsById: Map<string, BoardviewTestPoint>;
  nets: BoardviewNet[];
  netsByName: Map<string, BoardviewNet>;
  testPointsByNetName: Map<string, BoardviewTestPoint[]>;
  padPinsByNetName: Map<string, BoardviewPadPin[]>;
  spatialIndex: SpatialIndex;
};

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function bucketKey(x: number, y: number) {
  return `${x}:${y}`;
}

function matchesSide(
  value: "top" | "bottom" | "both",
  filter: BoardviewLabSideFilter,
) {
  if (filter === "both") {
    return true;
  }

  return value === "both" || value === filter;
}

function buildComponentGeometry(
  component: BoardviewComponent,
  padPins: BoardviewPadPin[],
): BoardviewLabComponent {
  const componentPins = padPins.filter(
    (padPin) => padPin.partIndex === component.partIndex,
  );
  const xs = componentPins.map((padPin) => padPin.xMil);
  const ys = componentPins.map((padPin) => padPin.yMil);
  const centerXMil = xs.length ? average(xs) : 0;
  const centerYMil = ys.length ? average(ys) : 0;

  return {
    ...component,
    centerXMil,
    centerYMil,
    minXMil: xs.length ? Math.min(...xs) : centerXMil,
    maxXMil: xs.length ? Math.max(...xs) : centerXMil,
    minYMil: ys.length ? Math.min(...ys) : centerYMil,
    maxYMil: ys.length ? Math.max(...ys) : centerYMil,
  };
}

function buildSpatialIndex(
  components: BoardviewLabComponent[],
  padPins: BoardviewPadPin[],
  testPoints: BoardviewTestPoint[],
): SpatialIndex {
  const cellSizeMil = 160;
  const buckets = new Map<string, SpatialItem[]>();

  function add(item: SpatialItem) {
    const bucketX = Math.floor(item.xMil / cellSizeMil);
    const bucketY = Math.floor(item.yMil / cellSizeMil);
    const key = bucketKey(bucketX, bucketY);
    const current = buckets.get(key) ?? [];
    current.push(item);
    buckets.set(key, current);
  }

  for (const component of components) {
    add({
      id: component.ref,
      kind: "component",
      xMil: component.centerXMil,
      yMil: component.centerYMil,
    });
  }

  for (const padPin of padPins) {
    add({
      id: padPin.id,
      kind: "padPin",
      xMil: padPin.xMil,
      yMil: padPin.yMil,
    });
  }

  for (const testPoint of testPoints) {
    add({
      id: testPoint.id,
      kind: "testPoint",
      xMil: testPoint.xMil,
      yMil: testPoint.yMil,
    });
  }

  return {
    cellSizeMil,
    buckets,
  };
}

export function buildBoardviewLabModel(
  parsed: ParsedBoardview,
): BoardviewLabModel {
  const components = parsed.components.map((component) =>
    buildComponentGeometry(component, parsed.padPins),
  );
  const componentsByIndex = new Map(
    components.map((component) => [component.partIndex, component] as const),
  );
  const componentsByRef = new Map(
    components.map((component) => [component.ref.toLowerCase(), component] as const),
  );
  const padPinsByPartIndex = new Map<number, BoardviewPadPin[]>();
  const padPinsByNetName = new Map<string, BoardviewPadPin[]>();
  const testPointsByNetName = new Map<string, BoardviewTestPoint[]>();

  for (const padPin of parsed.padPins) {
    const byPart = padPinsByPartIndex.get(padPin.partIndex) ?? [];
    byPart.push(padPin);
    padPinsByPartIndex.set(padPin.partIndex, byPart);

    const byNet = padPinsByNetName.get(padPin.netName) ?? [];
    byNet.push(padPin);
    padPinsByNetName.set(padPin.netName, byNet);
  }

  for (const testPoint of parsed.testPoints) {
    const byNet = testPointsByNetName.get(testPoint.netName) ?? [];
    byNet.push(testPoint);
    testPointsByNetName.set(testPoint.netName, byNet);
  }

  return {
    parsed,
    components,
    componentsByIndex,
    componentsByRef,
    padPins: parsed.padPins,
    padPinsById: new Map(parsed.padPins.map((padPin) => [padPin.id, padPin] as const)),
    padPinsByPartIndex,
    testPoints: parsed.testPoints,
    testPointsById: new Map(
      parsed.testPoints.map((testPoint) => [testPoint.id, testPoint] as const),
    ),
    nets: parsed.nets,
    netsByName: new Map(parsed.nets.map((net) => [net.name, net] as const)),
    testPointsByNetName,
    padPinsByNetName,
    spatialIndex: buildSpatialIndex(components, parsed.padPins, parsed.testPoints),
  };
}

export function fitBoardviewViewport(
  contour: BoardviewPoint[],
  canvasWidth: number,
  canvasHeight: number,
  padding = 28,
): BoardviewViewport {
  if (!contour.length || canvasWidth <= 0 || canvasHeight <= 0) {
    return {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    };
  }

  const xs = contour.map((point) => point.xMil);
  const ys = contour.map((point) => point.yMil);
  const minXMil = Math.min(...xs);
  const maxXMil = Math.max(...xs);
  const minYMil = Math.min(...ys);
  const maxYMil = Math.max(...ys);
  const boardWidthMil = Math.max(1, maxXMil - minXMil);
  const boardHeightMil = Math.max(1, maxYMil - minYMil);
  const availableWidth = Math.max(1, canvasWidth - padding * 2);
  const availableHeight = Math.max(1, canvasHeight - padding * 2);
  const scale = Math.min(
    availableWidth / boardWidthMil,
    availableHeight / boardHeightMil,
  );
  const renderedWidth = boardWidthMil * scale;
  const renderedHeight = boardHeightMil * scale;
  const offsetX = padding + (availableWidth - renderedWidth) / 2;
  const offsetY = padding + (availableHeight - renderedHeight) / 2;

  return {
    scale,
    offsetX,
    offsetY,
  };
}

export function focusBoardviewViewportOnBounds(
  boundsMil: {
    minXMil: number;
    maxXMil: number;
    minYMil: number;
    maxYMil: number;
  },
  boardBounds: ParsedBoardview["metadata"]["bounds"],
  canvasWidth: number,
  canvasHeight: number,
  padding = 48,
): BoardviewViewport {
  const widthMil = Math.max(1, boundsMil.maxXMil - boundsMil.minXMil);
  const heightMil = Math.max(1, boundsMil.maxYMil - boundsMil.minYMil);
  const availableWidth = Math.max(1, canvasWidth - padding * 2);
  const availableHeight = Math.max(1, canvasHeight - padding * 2);
  const scale = Math.max(
    0.04,
    Math.min(6, Math.min(availableWidth / widthMil, availableHeight / heightMil)),
  );
  const centerXMil = (boundsMil.minXMil + boundsMil.maxXMil) / 2;
  const centerYMil = (boundsMil.minYMil + boundsMil.maxYMil) / 2;
  const normalizedX = centerXMil - boardBounds.minXMil;
  const normalizedY = boardBounds.maxYMil - centerYMil;

  return {
    scale,
    offsetX: canvasWidth / 2 - normalizedX * scale,
    offsetY: canvasHeight / 2 - normalizedY * scale,
  };
}

export function focusBoardviewViewportOnComponent(
  component: BoardviewLabComponent,
  boardBounds: ParsedBoardview["metadata"]["bounds"],
  canvasWidth: number,
  canvasHeight: number,
) {
  return focusBoardviewViewportOnBounds(
    {
      minXMil: component.minXMil - 120,
      maxXMil: component.maxXMil + 120,
      minYMil: component.minYMil - 120,
      maxYMil: component.maxYMil + 120,
    },
    boardBounds,
    canvasWidth,
    canvasHeight,
  );
}

export function boardToCanvasPoint(
  point: { xMil: number; yMil: number },
  viewport: BoardviewViewport,
  bounds: ParsedBoardview["metadata"]["bounds"],
  mirrorX: boolean,
) {
  const normalizedX = point.xMil - bounds.minXMil;
  const widthMil = bounds.maxXMil - bounds.minXMil;
  const mirroredX = mirrorX ? widthMil - normalizedX : normalizedX;

  return {
    x: viewport.offsetX + mirroredX * viewport.scale,
    y: viewport.offsetY + (bounds.maxYMil - point.yMil) * viewport.scale,
  };
}

export function canvasToBoardPoint(
  point: { x: number; y: number },
  viewport: BoardviewViewport,
  bounds: ParsedBoardview["metadata"]["bounds"],
  mirrorX: boolean,
) {
  const xMilFromView = (point.x - viewport.offsetX) / viewport.scale;
  const yMilFromView = (point.y - viewport.offsetY) / viewport.scale;
  const widthMil = bounds.maxXMil - bounds.minXMil;
  const normalizedX = mirrorX ? widthMil - xMilFromView : xMilFromView;

  return {
    xMil: bounds.minXMil + normalizedX,
    yMil: bounds.maxYMil - yMilFromView,
  };
}

function distanceSquared(
  left: { xMil: number; yMil: number },
  right: { xMil: number; yMil: number },
) {
  const dx = left.xMil - right.xMil;
  const dy = left.yMil - right.yMil;
  return dx * dx + dy * dy;
}

export function searchBoardviewLabModel(
  model: BoardviewLabModel,
  query: string,
  sideFilter: BoardviewLabSideFilter,
  limit = 18,
): BoardviewSearchHit[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  const results: Array<BoardviewSearchHit & { score: number }> = [];

  for (const component of model.components) {
    const haystack =
      `${component.ref} ${component.kind} ${component.mountingSide}`.toLowerCase();

    if (
      !haystack.includes(normalized) ||
      !matchesSide(component.mountingSide, sideFilter)
    ) {
      continue;
    }

    const score =
      component.ref.toLowerCase() === normalized
        ? 0
        : component.ref.toLowerCase().startsWith(normalized)
          ? 1
          : 2;

    results.push({
      id: `component:${component.ref}`,
      title: component.ref,
      subtitle: `${component.pinCount} pads • ${component.mountingSide}`,
      keywords: [component.ref],
      score,
      selection: {
        kind: "component",
        component,
      },
    });
  }

  for (const net of model.nets) {
    const haystack = net.name.toLowerCase();

    if (!haystack.includes(normalized)) {
      continue;
    }

    const score =
      haystack === normalized ? 0 : haystack.startsWith(normalized) ? 1 : 2;

    results.push({
      id: `net:${net.name}`,
      title: net.name,
      subtitle: `${net.padPinCount} pads • ${net.testPointCount} test points`,
      keywords: [net.name],
      score,
      selection: {
        kind: "net",
        net,
      },
    });
  }

  // Test points: o arquivo muitas vezes nao traz nome (o GenCAD grava "Probe_"),
  // entao o app numera TP-1, TP-2... e e esse numero que a IA cita. Aceita
  // "tp-672", "TP672" ou "tp 672"; so busca quando parece um TP, para nao
  // encher a lista ao procurar uma net.
  const compactQuery = compactSearchValue(normalized);
  if (/^tp\d+$/.test(compactQuery)) {
    for (const testPoint of model.testPoints) {
      const compactId = compactSearchValue(testPoint.id);

      if (!compactId.startsWith(compactQuery) || !matchesSide(testPoint.side, sideFilter)) {
        continue;
      }

      results.push({
        id: `testPoint:${testPoint.id}`,
        title: testPoint.id,
        subtitle: `test point • ${testPoint.netName || "sem net"} • ${testPoint.side}`,
        keywords: [testPoint.id, testPoint.netName],
        score: compactId === compactQuery ? 0 : 1,
        selection: {
          kind: "testPoint",
          testPoint,
          net: model.netsByName.get(testPoint.netName) ?? null,
        },
      });
    }
  }

  results.sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score;
    }

    return left.title.localeCompare(right.title, undefined, { numeric: true });
  });

  return results.slice(0, limit);
}

function compactSearchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function collectSpatialCandidates(
  spatialIndex: SpatialIndex,
  point: { xMil: number; yMil: number },
  radiusMil: number,
) {
  const minBucketX = Math.floor((point.xMil - radiusMil) / spatialIndex.cellSizeMil);
  const maxBucketX = Math.floor((point.xMil + radiusMil) / spatialIndex.cellSizeMil);
  const minBucketY = Math.floor((point.yMil - radiusMil) / spatialIndex.cellSizeMil);
  const maxBucketY = Math.floor((point.yMil + radiusMil) / spatialIndex.cellSizeMil);
  const candidates: SpatialItem[] = [];

  for (let bucketX = minBucketX; bucketX <= maxBucketX; bucketX += 1) {
    for (let bucketY = minBucketY; bucketY <= maxBucketY; bucketY += 1) {
      const bucket = spatialIndex.buckets.get(bucketKey(bucketX, bucketY));
      if (bucket) {
        candidates.push(...bucket);
      }
    }
  }

  return candidates;
}

export function findNearestBoardviewSelection(
  model: BoardviewLabModel,
  point: { xMil: number; yMil: number },
  sideFilter: BoardviewLabSideFilter,
  radiusMil: number,
): BoardviewLabSelection | null {
  // Prioridade: pino > test point > componente. Antes valia so a distancia, e o
  // centro de uma peca pequena (ex.: capacitor 0402, centro entre os 2 pinos)
  // ganhava do pino que o tecnico queria tocar.
  const maxSquared = radiusMil * radiusMil;
  const candidates = collectSpatialCandidates(model.spatialIndex, point, radiusMil);

  let closestPad: { padPin: BoardviewPadPin; squared: number } | null = null;
  let closestTestPoint: { testPoint: BoardviewTestPoint; squared: number } | null = null;

  for (const candidate of candidates) {
    if (candidate.kind === "padPin") {
      const padPin = model.padPinsById.get(candidate.id);
      if (!padPin || !matchesSide(padPin.side, sideFilter)) {
        continue;
      }
      const squared = distanceSquared(point, padPin);
      if (squared <= maxSquared && (!closestPad || squared < closestPad.squared)) {
        closestPad = { padPin, squared };
      }
    } else if (candidate.kind === "testPoint") {
      const testPoint = model.testPointsById.get(candidate.id);
      if (!testPoint || !matchesSide(testPoint.side, sideFilter)) {
        continue;
      }
      const squared = distanceSquared(point, testPoint);
      if (squared <= maxSquared && (!closestTestPoint || squared < closestTestPoint.squared)) {
        closestTestPoint = { testPoint, squared };
      }
    }
  }

  if (closestPad) {
    const { padPin } = closestPad;
    return {
      kind: "padPin",
      padPin,
      component: model.componentsByIndex.get(padPin.partIndex) ?? null,
      net: model.netsByName.get(padPin.netName) ?? null,
    };
  }

  if (closestTestPoint) {
    const { testPoint } = closestTestPoint;
    return {
      kind: "testPoint",
      testPoint,
      net: model.netsByName.get(testPoint.netName) ?? null,
    };
  }

  // Componente: o toque dentro da caixa dele (com a folga do raio); se cair em
  // mais de uma caixa, a menor (a peca de cima de um conector, por exemplo).
  let bestComponent: { component: BoardviewLabComponent; area: number } | null = null;
  for (const component of model.components) {
    if (
      !matchesSide(component.mountingSide, sideFilter) ||
      point.xMil < component.minXMil - radiusMil ||
      point.xMil > component.maxXMil + radiusMil ||
      point.yMil < component.minYMil - radiusMil ||
      point.yMil > component.maxYMil + radiusMil
    ) {
      continue;
    }
    const area = (component.maxXMil - component.minXMil) * (component.maxYMil - component.minYMil);
    if (!bestComponent || area < bestComponent.area) {
      bestComponent = { component, area };
    }
  }

  return bestComponent ? { kind: "component", component: bestComponent.component } : null;
}

export function getSelectionHighlightNetName(
  selection: BoardviewLabSelection | null,
) {
  if (!selection) {
    return null;
  }

  switch (selection.kind) {
    case "net":
      return selection.net.name;
    case "padPin":
      return selection.padPin.netName;
    case "testPoint":
      return selection.testPoint.netName;
    default:
      return null;
  }
}

export function getSelectionVisibleComponents(
  model: BoardviewLabModel,
  selection: BoardviewLabSelection | null,
) {
  if (!selection) {
    return [];
  }

  if (selection.kind === "component") {
    return [selection.component];
  }

  if (selection.kind === "padPin" && selection.component) {
    return [selection.component];
  }

  if (selection.kind === "net") {
    return getNetDetails(model, selection.net.name).components;
  }

  return [];
}

/** Nets grandes demais para desenhar ligacao (viram um borrao na tela). */
export const CONNECTION_MAX_NET_POINTS = 80;
/** Teto de linhas por selecao (componente grande com muitos pinos). */
export const CONNECTION_MAX_LINES = 400;

export type BoardviewConnectionLine = {
  from: { xMil: number; yMil: number };
  to: { xMil: number; yMil: number };
  netName: string;
  /** Lado do ponto de destino, para respeitar o filtro de lado. */
  toSide: BoardviewMountingSide;
};

export type BoardviewConnections = {
  lines: BoardviewConnectionLine[];
  /** Componentes do outro lado da ligacao (sem o proprio componente). */
  connectedRefs: string[];
  /** Nets puladas por serem terra ou grandes demais. */
  skippedNets: string[];
  truncated: boolean;
};

/** Terra e "nets" de pinos sem ligacao: nao ha o que desenhar. */
function isGroundNet(netName: string) {
  return /(^|_)A?D?P?S?GND\d*($|_)|^VSS$|^(UNCONNECTED|NC|N\/C|NOCONNECT)/i.test(netName.trim());
}

/**
 * Linhas de ligacao ("ratsnest") a partir do item selecionado: o boardview nao
 * traz o desenho das trilhas, so quem esta ligado a quem, entao a ligacao vira
 * uma linha reta do ponto selecionado ate cada pino/test point da mesma net.
 * Terra e nets enormes sao puladas.
 */
export function getSelectionConnections(
  model: BoardviewLabModel,
  selection: BoardviewLabSelection | null,
): BoardviewConnections {
  const empty: BoardviewConnections = { lines: [], connectedRefs: [], skippedNets: [], truncated: false };

  if (!selection || selection.kind === "net") {
    return empty;
  }

  type Origin = { xMil: number; yMil: number; netName: string; padId: string | null; partRef: string | null };
  const origins: Origin[] =
    selection.kind === "padPin"
      ? [{ ...pointOf(selection.padPin), netName: selection.padPin.netName, padId: selection.padPin.id, partRef: null }]
      : selection.kind === "testPoint"
        ? [{ ...pointOf(selection.testPoint), netName: selection.testPoint.netName, padId: null, partRef: null }]
        : getComponentPadPins(model, selection.component).map((pad) => ({
            ...pointOf(pad),
            netName: pad.netName,
            padId: pad.id,
            partRef: selection.component.ref,
          }));

  const lines: BoardviewConnectionLine[] = [];
  const connectedRefs = new Set<string>();
  const skippedNets = new Set<string>();
  let truncated = false;

  for (const origin of origins) {
    if (!origin.netName) {
      continue;
    }

    const pads = model.padPinsByNetName.get(origin.netName) ?? [];
    const testPoints = model.testPointsByNetName.get(origin.netName) ?? [];

    if (isGroundNet(origin.netName) || pads.length + testPoints.length > CONNECTION_MAX_NET_POINTS) {
      skippedNets.add(origin.netName);
      continue;
    }

    const targets = [
      ...pads
        .filter((pad) => pad.id !== origin.padId && (!origin.partRef || pad.partRef !== origin.partRef))
        .map((pad) => ({ point: pointOf(pad), side: pad.side, ref: pad.partRef })),
      ...testPoints
        .filter((testPoint) => testPoint.xMil !== origin.xMil || testPoint.yMil !== origin.yMil)
        .map((testPoint) => ({ point: pointOf(testPoint), side: testPoint.side, ref: null })),
    ];

    for (const target of targets) {
      if (lines.length >= CONNECTION_MAX_LINES) {
        truncated = true;
        break;
      }
      lines.push({ from: pointOf(origin), to: target.point, netName: origin.netName, toSide: target.side });
      if (target.ref) {
        connectedRefs.add(target.ref);
      }
    }
  }

  return {
    lines,
    connectedRefs: Array.from(connectedRefs).sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true }),
    ),
    skippedNets: Array.from(skippedNets),
    truncated,
  };
}

function pointOf(value: { xMil: number; yMil: number }) {
  return { xMil: value.xMil, yMil: value.yMil };
}

export function getComponentPadPins(
  model: BoardviewLabModel,
  component: BoardviewLabComponent,
) {
  return (model.padPinsByPartIndex.get(component.partIndex) ?? []).slice().sort(
    (left, right) => left.pinOrdinalWithinPart - right.pinOrdinalWithinPart,
  );
}

export function getNetDetails(
  model: BoardviewLabModel,
  netName: string,
): BoardviewLabNetDetails {
  const net = model.netsByName.get(netName);

  if (!net) {
    return {
      net: {
        name: netName,
        padPinCount: 0,
        testPointCount: 0,
        probeIds: [],
      },
      components: [],
      padPins: [],
      testPoints: [],
    };
  }

  const padPins = (model.padPinsByNetName.get(netName) ?? []).slice();
  const testPoints = (model.testPointsByNetName.get(netName) ?? []).slice();
  const componentIndexes = new Set(padPins.map((padPin) => padPin.partIndex));
  const components = [...componentIndexes]
    .map((partIndex) => model.componentsByIndex.get(partIndex))
    .filter((component): component is BoardviewLabComponent => Boolean(component))
    .sort((left, right) => left.ref.localeCompare(right.ref));

  return {
    net,
    components,
    padPins,
    testPoints,
  };
}

export function isSelectionOnVisibleSide(
  selection: BoardviewLabSelection | null,
  sideFilter: BoardviewLabSideFilter,
) {
  if (!selection) {
    return false;
  }

  switch (selection.kind) {
    case "component":
      return matchesSide(selection.component.mountingSide, sideFilter);
    case "padPin":
      return matchesSide(selection.padPin.side, sideFilter);
    case "testPoint":
      return matchesSide(selection.testPoint.side, sideFilter);
    case "net":
      return true;
  }
}
