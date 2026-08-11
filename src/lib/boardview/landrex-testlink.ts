import type {
  BoardviewBounds,
  BoardviewComponent,
  BoardviewCounts,
  BoardviewMountingSide,
  BoardviewNet,
  BoardviewPadPin,
  BoardviewPartKind,
  BoardviewPoint,
  BoardviewTestPoint,
  BoardviewVariant,
  ParsedBoardview,
} from "@/types/boardview";

const ENCODED_HEADER = new Uint8Array([0x23, 0xe2, 0x63, 0x28]);
const MIL_TO_MM = 0.0254;
const BLOCK_HEADERS = new Set([
  "str_length:",
  "var_data:",
  "Format:",
  "format:",
  "Parts:",
  "Pins1:",
  "Pins:",
  "Pins2:",
  "Nails:",
]);

type CurrentBlock =
  | "str_length:"
  | "var_data:"
  | "Format:"
  | "format:"
  | "Parts:"
  | "Pins1:"
  | "Pins:"
  | "Pins2:"
  | "Nails:"
  | null;

type RawPart = {
  ref: string;
  rawType: number;
  endOfPins: number;
};

type RawPin = {
  xMil: number;
  yMil: number;
  probe: number;
  partIndex: number;
  netName: string;
};

type RawNail = {
  probe: number;
  xMil: number;
  yMil: number;
  sideValue: number;
  netName: string;
};

export class LandrexBoardviewParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LandrexBoardviewParserError";
  }
}

function milToMm(value: number) {
  return Number((value * MIL_TO_MM).toFixed(4));
}

function hasEncodedHeader(bytes: Uint8Array) {
  if (bytes.length < ENCODED_HEADER.length) {
    return false;
  }

  return ENCODED_HEADER.every((value, index) => bytes[index] === value);
}

function decodeBytes(bytes: Uint8Array): {
  variant: BoardviewVariant;
  decoded: Uint8Array;
} {
  if (!hasEncodedHeader(bytes)) {
    return {
      variant: "plain-text-or-unknown-variant",
      decoded: bytes,
    };
  }

  const decoded = new Uint8Array(bytes);

  for (let index = 0; index < decoded.length; index += 1) {
    const value = decoded[index];

    if (value === 0 || value === 10 || value === 13) {
      continue;
    }

    const rotated = ((value >> 6) & 0x03) | ((value << 2) & 0xff);
    decoded[index] = (~rotated) & 0xff;
  }

  return {
    variant: "encoded-landrex-testlink",
    decoded,
  };
}

function decodeText(bytes: Uint8Array) {
  return new TextDecoder("latin1").decode(bytes);
}

function normalizeSideFromRawType(rawType: number): BoardviewMountingSide {
  if (rawType === 1 || (rawType >= 4 && rawType < 8)) {
    return "top";
  }

  if (rawType === 2 || rawType >= 8) {
    return "bottom";
  }

  return "both";
}

function normalizeKindFromRawType(rawType: number): BoardviewPartKind {
  return rawType & 0x0c ? "smd" : "through_hole";
}

function normalizeTestPointSide(sideValue: number): BoardviewMountingSide {
  return sideValue === 1 ? "top" : "bottom";
}

function assertTokenCount(tokens: string[], minCount: number, line: string) {
  if (tokens.length < minCount) {
    throw new LandrexBoardviewParserError(
      `Linha invalida no boardview: ${line}`,
    );
  }
}

function buildCounts(input: {
  contourPoints: number;
  components: number;
  padPins: number;
  testPoints: number;
  nets: number;
}): BoardviewCounts {
  return input;
}

function buildBounds(contour: BoardviewPoint[]): {
  bounds: BoardviewBounds;
  widthMil: number;
  heightMil: number;
  widthMm: number;
  heightMm: number;
} {
  if (!contour.length) {
    throw new LandrexBoardviewParserError(
      "O boardview nao possui pontos de contorno suficientes.",
    );
  }

  const xs = contour.map((point) => point.xMil);
  const ys = contour.map((point) => point.yMil);
  const minXMil = Math.min(...xs);
  const maxXMil = Math.max(...xs);
  const minYMil = Math.min(...ys);
  const maxYMil = Math.max(...ys);
  const widthMil = maxXMil - minXMil;
  const heightMil = maxYMil - minYMil;
  const widthMm = milToMm(widthMil);
  const heightMm = milToMm(heightMil);

  return {
    bounds: {
      minXMil,
      maxXMil,
      minYMil,
      maxYMil,
      minXMm: milToMm(minXMil),
      maxXMm: milToMm(maxXMil),
      minYMm: milToMm(minYMil),
      maxYMm: milToMm(maxYMil),
    },
    widthMil,
    heightMil,
    widthMm,
    heightMm,
  };
}

export function parseLandrexTestlinkBoardview(
  bytes: Uint8Array | ArrayBuffer,
): ParsedBoardview {
  const inputBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const { decoded, variant } = decodeBytes(inputBytes);
  const text = decodeText(decoded);
  const lines = text
    .split(/\r\n|\n|\r/g)
    .map((line) => line.trim())
    .filter(Boolean);

  let currentBlock: CurrentBlock = null;
  let declaredContourPoints = 0;
  let declaredComponents = 0;
  let declaredPadPins = 0;
  let declaredTestPoints = 0;

  const contour: BoardviewPoint[] = [];
  const rawParts: RawPart[] = [];
  const rawPins: RawPin[] = [];
  const rawNails: RawNail[] = [];

  for (const line of lines) {
    if (BLOCK_HEADERS.has(line)) {
      currentBlock = line as CurrentBlock;
      continue;
    }

    const tokens = line.split(/\s+/);

    switch (currentBlock) {
      case "var_data:": {
        assertTokenCount(tokens, 4, line);
        declaredContourPoints = Number.parseInt(tokens[0] ?? "", 10);
        declaredComponents = Number.parseInt(tokens[1] ?? "", 10);
        declaredPadPins = Number.parseInt(tokens[2] ?? "", 10);
        declaredTestPoints = Number.parseInt(tokens[3] ?? "", 10);
        break;
      }
      case "Format:":
      case "format:": {
        assertTokenCount(tokens, 2, line);
        const xMil = Number.parseInt(tokens[0] ?? "", 10);
        const yMil = Number.parseInt(tokens[1] ?? "", 10);
        contour.push({
          xMil,
          yMil,
          xMm: milToMm(xMil),
          yMm: milToMm(yMil),
        });
        break;
      }
      case "Parts:":
      case "Pins1:": {
        assertTokenCount(tokens, 3, line);
        rawParts.push({
          ref: tokens[0] ?? "",
          rawType: Number.parseInt(tokens[1] ?? "", 10),
          endOfPins: Number.parseInt(tokens[2] ?? "", 10),
        });
        break;
      }
      case "Pins:":
      case "Pins2:": {
        assertTokenCount(tokens, 5, line);
        rawPins.push({
          xMil: Number.parseInt(tokens[0] ?? "", 10),
          yMil: Number.parseInt(tokens[1] ?? "", 10),
          probe: Number.parseInt(tokens[2] ?? "", 10),
          partIndex: Number.parseInt(tokens[3] ?? "", 10),
          netName: tokens.slice(4).join(" "),
        });
        break;
      }
      case "Nails:": {
        assertTokenCount(tokens, 5, line);
        rawNails.push({
          probe: Number.parseInt(tokens[0] ?? "", 10),
          xMil: Number.parseInt(tokens[1] ?? "", 10),
          yMil: Number.parseInt(tokens[2] ?? "", 10),
          sideValue: Number.parseInt(tokens[3] ?? "", 10),
          netName: tokens.slice(4).join(" "),
        });
        break;
      }
      default:
        break;
    }
  }

  if (!contour.length || !rawParts.length) {
    throw new LandrexBoardviewParserError(
      "Nao foi possivel localizar os blocos esperados do boardview Landrex/Testlink.",
    );
  }

  const components: BoardviewComponent[] = [];
  let firstPinIndex = 1;

  rawParts.forEach((part, index) => {
    const lastPinIndex = part.endOfPins;
    const pinCount = Math.max(0, lastPinIndex - firstPinIndex + 1);
    components.push({
      ref: part.ref,
      partIndex: index + 1,
      rawType: part.rawType,
      mountingSide: normalizeSideFromRawType(part.rawType),
      kind: normalizeKindFromRawType(part.rawType),
      firstPinIndex,
      lastPinIndex,
      pinCount,
    });
    firstPinIndex = lastPinIndex + 1;
  });

  const componentByIndex = new Map(
    components.map((component) => [component.partIndex, component] as const),
  );

  const padPins: BoardviewPadPin[] = [];
  const pinOrdinalByPart = new Map<number, number>();

  for (const rawPin of rawPins) {
    const component = componentByIndex.get(rawPin.partIndex);

    if (!component) {
      throw new LandrexBoardviewParserError(
        `Pin associado a componente inexistente: partIndex=${rawPin.partIndex}.`,
      );
    }

    const nextOrdinal = (pinOrdinalByPart.get(rawPin.partIndex) ?? 0) + 1;
    pinOrdinalByPart.set(rawPin.partIndex, nextOrdinal);

    padPins.push({
      id: `${component.ref}:${nextOrdinal}`,
      partIndex: component.partIndex,
      partRef: component.ref,
      pinOrdinalWithinPart: nextOrdinal,
      probe: rawPin.probe,
      netName: rawPin.netName,
      side: component.mountingSide,
      xMil: rawPin.xMil,
      yMil: rawPin.yMil,
      xMm: milToMm(rawPin.xMil),
      yMm: milToMm(rawPin.yMil),
    });
  }

  const testPoints: BoardviewTestPoint[] = rawNails.map((nail, index) => ({
    id: `TP-${index + 1}`,
    probe: nail.probe,
    side: normalizeTestPointSide(nail.sideValue),
    netName: nail.netName,
    xMil: nail.xMil,
    yMil: nail.yMil,
    xMm: milToMm(nail.xMil),
    yMm: milToMm(nail.yMil),
  }));

  const connectedNetNames = new Set<string>();
  const netAccumulator = new Map<
    string,
    {
      probeIds: Set<number>;
      padPinCount: number;
      testPointCount: number;
    }
  >();

  function registerNet(name: string, probe: number | null, kind: "pad" | "test") {
    const normalizedName = name.trim();

    if (!normalizedName || normalizedName.toUpperCase() === "UNCONNECTED") {
      return;
    }

    connectedNetNames.add(normalizedName);

    const entry = netAccumulator.get(normalizedName) ?? {
      probeIds: new Set<number>(),
      padPinCount: 0,
      testPointCount: 0,
    };

    if (probe !== null && probe >= 0) {
      entry.probeIds.add(probe);
    }

    if (kind === "pad") {
      entry.padPinCount += 1;
    } else {
      entry.testPointCount += 1;
    }

    netAccumulator.set(normalizedName, entry);
  }

  for (const padPin of padPins) {
    registerNet(padPin.netName, padPin.probe, "pad");
  }

  for (const testPoint of testPoints) {
    registerNet(testPoint.netName, testPoint.probe, "test");
  }

  const nets: BoardviewNet[] = [...netAccumulator.entries()]
    .map(([name, entry]) => ({
      name,
      padPinCount: entry.padPinCount,
      testPointCount: entry.testPointCount,
      probeIds: [...entry.probeIds].sort((left, right) => left - right),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const { bounds, widthMil, heightMil, widthMm, heightMm } =
    buildBounds(contour);

  return {
    metadata: {
      format: "landrex-testlink",
      variant,
      sourceEncoding: "latin1",
      declaredCounts: buildCounts({
        contourPoints: declaredContourPoints,
        components: declaredComponents,
        padPins: declaredPadPins,
        testPoints: declaredTestPoints,
        nets: connectedNetNames.size,
      }),
      parsedCounts: buildCounts({
        contourPoints: contour.length,
        components: components.length,
        padPins: padPins.length,
        testPoints: testPoints.length,
        nets: nets.length,
      }),
      bounds,
      boardWidthMil: widthMil,
      boardHeightMil: heightMil,
      boardWidthMm: widthMm,
      boardHeightMm: heightMm,
    },
    contour,
    components,
    padPins,
    nets,
    testPoints,
  };
}
