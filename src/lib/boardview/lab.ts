import type {
  BoardviewComponent,
  BoardviewNet,
  BoardviewPadPin,
  BoardviewPoint,
  BoardviewTestPoint,
  ParsedBoardview,
} from "@/types/boardview";

export type BoardviewLabSideFilter = "top" | "bottom" | "both";

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

export type BoardviewLabModel = {
  parsed: ParsedBoardview;
  components: BoardviewLabComponent[];
  componentsByIndex: Map<number, BoardviewLabComponent>;
  componentsByRef: Map<string, BoardviewLabComponent>;
  padPins: BoardviewPadPin[];
  padPinsById: Map<string, BoardviewPadPin>;
  testPoints: BoardviewTestPoint[];
  testPointsById: Map<string, BoardviewTestPoint>;
  nets: BoardviewNet[];
  netsByName: Map<string, BoardviewNet>;
};

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
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
  const componentPins = padPins.filter((padPin) => padPin.partIndex === component.partIndex);
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

  return {
    parsed,
    components,
    componentsByIndex,
    componentsByRef,
    padPins: parsed.padPins,
    padPinsById: new Map(parsed.padPins.map((padPin) => [padPin.id, padPin] as const)),
    testPoints: parsed.testPoints,
    testPointsById: new Map(
      parsed.testPoints.map((testPoint) => [testPoint.id, testPoint] as const),
    ),
    nets: parsed.nets,
    netsByName: new Map(parsed.nets.map((net) => [net.name, net] as const)),
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
    const haystack = `${component.ref} ${component.kind} ${component.mountingSide}`.toLowerCase();

    if (!haystack.includes(normalized) || !matchesSide(component.mountingSide, sideFilter)) {
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

  results.sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score;
    }

    return left.title.localeCompare(right.title);
  });

  return results.slice(0, limit);
}

export function findNearestBoardviewSelection(
  model: BoardviewLabModel,
  point: { xMil: number; yMil: number },
  sideFilter: BoardviewLabSideFilter,
  radiusMil: number,
): BoardviewLabSelection | null {
  let closestDistance = radiusMil * radiusMil;
  let selected: BoardviewLabSelection | null = null;

  for (const padPin of model.padPins) {
    if (!matchesSide(padPin.side, sideFilter)) {
      continue;
    }

    const squared = distanceSquared(point, padPin);
    if (squared > closestDistance) {
      continue;
    }

    closestDistance = squared;
    const component = model.componentsByIndex.get(padPin.partIndex) ?? null;
    selected = {
      kind: "padPin",
      padPin,
      component,
      net: model.netsByName.get(padPin.netName) ?? null,
    };
  }

  for (const testPoint of model.testPoints) {
    if (!matchesSide(testPoint.side, sideFilter)) {
      continue;
    }

    const squared = distanceSquared(point, testPoint);
    if (squared > closestDistance) {
      continue;
    }

    closestDistance = squared;
    selected = {
      kind: "testPoint",
      testPoint,
      net: model.netsByName.get(testPoint.netName) ?? null,
    };
  }

  if (selected) {
    return selected;
  }

  for (const component of model.components) {
    if (!matchesSide(component.mountingSide, sideFilter)) {
      continue;
    }

    const squared = distanceSquared(point, {
      xMil: component.centerXMil,
      yMil: component.centerYMil,
    });
    if (squared > closestDistance) {
      continue;
    }

    closestDistance = squared;
    selected = {
      kind: "component",
      component,
    };
  }

  return selected;
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
    const refs = new Set(
      model.padPins
        .filter((padPin) => padPin.netName === selection.net.name)
        .map((padPin) => padPin.partRef),
    );

    return model.components.filter((component) => refs.has(component.ref));
  }

  return [];
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
