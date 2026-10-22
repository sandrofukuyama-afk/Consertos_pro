import type {
  BoardviewComponent,
  BoardviewMountingSide,
  BoardviewNet,
  BoardviewPadPin,
  BoardviewPoint,
  BoardviewTestPoint,
  ParsedBoardview,
} from "@/types/boardview";

// Boardview BRD2 (texto, mesmo formato que o OpenBoardView le como "BRD2"; ex.: Dell 7559
// DA0AM9MB8D0). Blocos com contagem no cabecalho:
//   BRDOUT: n largura altura   -> n pontos "x y" do contorno
//   NETS: n                    -> "id nome"
//   PARTS: n                   -> "ref x1 y1 x2 y2 primeiro_pino lado" (lado 1 = topo, 2 = fundo)
//   PINS: n                    -> "x y id_da_net lado"; os pinos de cada peca vao do primeiro_pino
//                                 dela ate o primeiro_pino da peca seguinte (indice a partir de 0)
//   NAILS: n                   -> "probe x y id_da_net lado"
// Coordenadas em mil.

const MIL_TO_MM = 0.0254;
const BLOCK = /^(BRDOUT|NETS|PARTS|PINS|NAILS):\s*(\d+)/;

export class Brd2ParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Brd2ParserError";
  }
}

function milToMm(value: number) {
  return Number((value * MIL_TO_MM).toFixed(4));
}

function point(xMil: number, yMil: number): BoardviewPoint {
  return { xMil, yMil, xMm: milToMm(xMil), yMm: milToMm(yMil) };
}

function sideOf(value: number): BoardviewMountingSide {
  return value === 1 ? "top" : value === 2 ? "bottom" : "both";
}

export function isBrd2Boardview(bytesOrBuffer: Uint8Array | ArrayBuffer): boolean {
  const bytes = bytesOrBuffer instanceof Uint8Array ? bytesOrBuffer : new Uint8Array(bytesOrBuffer);
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 512));
  return /^BRDOUT:\s*\d+/m.test(head);
}

type RawPart = { ref: string; firstPin: number; side: BoardviewMountingSide; order: number };
type RawPin = { xMil: number; yMil: number; netId: number; side: number };

export function parseBrd2Boardview(bytesOrBuffer: Uint8Array | ArrayBuffer): ParsedBoardview {
  const bytes = bytesOrBuffer instanceof Uint8Array ? bytesOrBuffer : new Uint8Array(bytesOrBuffer);
  const lines = new TextDecoder("latin1").decode(bytes).split(/\r?\n/);

  let section: string | null = null;
  const outline: BoardviewPoint[] = [];
  const netNames = new Map<number, string>();
  const rawParts: RawPart[] = [];
  const rawPins: RawPin[] = [];
  const rawNails: { probe: number; xMil: number; yMil: number; netId: number; side: number }[] = [];

  for (const line of lines) {
    const header = BLOCK.exec(line.trim());
    if (header) {
      section = header[1];
      continue;
    }
    const tokens = line.trim().split(/\s+/);
    if (!tokens[0]) {
      continue;
    }
    const numbers = tokens.map(Number);

    if (section === "BRDOUT" && tokens.length >= 2) {
      outline.push(point(numbers[0], numbers[1]));
    } else if (section === "NETS" && tokens.length >= 2) {
      netNames.set(numbers[0], tokens.slice(1).join(" "));
    } else if (section === "PARTS" && tokens.length >= 7) {
      rawParts.push({ ref: tokens[0], firstPin: numbers[5], side: sideOf(numbers[6]), order: rawParts.length });
    } else if (section === "PINS" && tokens.length >= 4) {
      rawPins.push({ xMil: numbers[0], yMil: numbers[1], netId: numbers[2], side: numbers[3] });
    } else if (section === "NAILS" && tokens.length >= 5) {
      rawNails.push({ probe: numbers[0], xMil: numbers[1], yMil: numbers[2], netId: numbers[3], side: numbers[4] });
    }
  }

  if (!rawParts.length || !rawPins.length) {
    throw new Brd2ParserError("Boardview BRD2 sem os blocos PARTS/PINS.");
  }

  const netName = (id: number) => netNames.get(id) ?? "";

  // Faixa de pinos de cada peca: do primeiro_pino ate o da proxima peca na ordem dos pinos.
  const byFirstPin = [...rawParts].sort((left, right) => left.firstPin - right.firstPin);
  const components: BoardviewComponent[] = [];
  const padPins: BoardviewPadPin[] = [];

  byFirstPin.forEach((part, index) => {
    const end = Math.min(byFirstPin[index + 1]?.firstPin ?? rawPins.length, rawPins.length);
    const pins = rawPins.slice(part.firstPin, end);
    if (!pins.length) {
      return;
    }
    const partIndex = part.order + 1;
    const firstPinIndex = padPins.length;
    pins.forEach((pin, ordinal) => {
      padPins.push({
        ...point(pin.xMil, pin.yMil),
        id: `${part.ref}:${ordinal + 1}`,
        partIndex,
        partRef: part.ref,
        pinOrdinalWithinPart: ordinal + 1,
        probe: -1,
        netName: netName(pin.netId),
        side: part.side,
      });
    });
    components.push({
      ref: part.ref,
      partIndex,
      rawType: 0,
      mountingSide: part.side,
      kind: pins.every((pin) => pin.side === 0) ? "through_hole" : "smd",
      firstPinIndex,
      lastPinIndex: padPins.length - 1,
      pinCount: pins.length,
    });
  });
  components.sort((left, right) => left.partIndex - right.partIndex);

  const testPoints: BoardviewTestPoint[] = rawNails.map((nail, index) => ({
    ...point(nail.xMil, nail.yMil),
    id: `TP-${index + 1}`,
    probe: nail.probe,
    side: nail.side === 1 ? "top" : "bottom",
    netName: netName(nail.netId),
  }));

  const netAccumulator = new Map<string, { padPinCount: number; testPointCount: number }>();
  const registerNet = (name: string, kind: "pad" | "test") => {
    const normalized = name.trim();
    if (!normalized || normalized.toUpperCase() === "UNCONNECTED") {
      return;
    }
    const entry = netAccumulator.get(normalized) ?? { padPinCount: 0, testPointCount: 0 };
    if (kind === "pad") {
      entry.padPinCount += 1;
    } else {
      entry.testPointCount += 1;
    }
    netAccumulator.set(normalized, entry);
  };
  padPins.forEach((pin) => registerNet(pin.netName, "pad"));
  testPoints.forEach((testPoint) => registerNet(testPoint.netName, "test"));

  const nets: BoardviewNet[] = [...netAccumulator.entries()]
    .map(([name, entry]) => ({ name, ...entry, probeIds: [] }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const allXs = [...padPins.map((pin) => pin.xMil), ...outline.map((p) => p.xMil)];
  const allYs = [...padPins.map((pin) => pin.yMil), ...outline.map((p) => p.yMil)];
  const minXMil = Math.min(...allXs);
  const maxXMil = Math.max(...allXs);
  const minYMil = Math.min(...allYs);
  const maxYMil = Math.max(...allYs);
  const contour =
    outline.length >= 3
      ? outline
      : [point(minXMil, minYMil), point(maxXMil, minYMil), point(maxXMil, maxYMil), point(minXMil, maxYMil)];

  const counts = {
    contourPoints: contour.length,
    components: components.length,
    padPins: padPins.length,
    testPoints: testPoints.length,
    nets: nets.length,
  };

  return {
    metadata: {
      format: "brd2",
      variant: "brd2-text",
      sourceEncoding: "latin1",
      declaredCounts: counts,
      parsedCounts: counts,
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
      boardWidthMil: maxXMil - minXMil,
      boardHeightMil: maxYMil - minYMil,
      boardWidthMm: milToMm(maxXMil - minXMil),
      boardHeightMm: milToMm(maxYMil - minYMil),
    },
    contour,
    components,
    padPins,
    nets,
    testPoints,
    traces: [],
  };
}
