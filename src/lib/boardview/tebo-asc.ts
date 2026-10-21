import type {
  BoardviewComponent,
  BoardviewMountingSide,
  BoardviewNet,
  BoardviewPadPin,
  BoardviewPoint,
  BoardviewTestPoint,
  ParsedBoardview,
} from "@/types/boardview";

// Boardview ASC (exportado pelo Tebo-ICT, ex.: Microsoft Surface): 5 arquivos de
// texto -- Format.asc (contorno), Parts.asc (pecas), Pins.asc (pinos com
// posicao e net), Nets.asc e Nails.asc (test points). O servidor junta os
// arquivos do mesmo conjunto num so texto, separados por ASC_BUNDLE_MARKER;
// so o Pins.asc ja basta para montar a placa.

export const ASC_BUNDLE_MARKER = "### CONSERTOSPRO ASC FILE:";

const MIL_TO_MM = 0.0254;
const CONTOUR_MARGIN_MIL = 200;
const NUMBER = String.raw`-?\d+(?:\.\d+)?`;

const PIN_LINE = new RegExp(String.raw`^\s*(\S+)\s+(\S+)\s+(${NUMBER})\s+(${NUMBER})\s+(\d+)(?:\s+(\S+))?`);
const PART_HEADER = /^\s*Part\s+(\S+)\s+\((T|B)\)/i;
const NAIL_LINE = new RegExp(
  String.raw`^\s*\$(\d+)\s+(${NUMBER})\s+(${NUMBER})\s+\S+\s+\S+\s+\((T|B)\)\s+#\d+\s+(\S+)`,
);
const OUTLINE_LINE = new RegExp(String.raw`^\s*(${NUMBER})\s+(${NUMBER})\s+(${NUMBER})\s*$`);

export class TeboAscParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeboAscParserError";
  }
}

function milToMm(value: number) {
  return Number((value * MIL_TO_MM).toFixed(4));
}

function point(xMil: number, yMil: number): BoardviewPoint {
  return { xMil, yMil, xMm: milToMm(xMil), yMm: milToMm(yMil) };
}

function sideOf(value: string): BoardviewMountingSide {
  return value.toUpperCase() === "B" ? "bottom" : "top";
}

export function isTeboAscBoardview(bytesOrBuffer: Uint8Array | ArrayBuffer): boolean {
  const bytes = bytesOrBuffer instanceof Uint8Array ? bytesOrBuffer : new Uint8Array(bytesOrBuffer);
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 2048));
  return (
    head.includes(ASC_BUNDLE_MARKER) ||
    /Part Pins List|Board Outline Contour|Test Fixture Nails|Parts List\s+\d+\/\d+/i.test(head)
  );
}

type Section = "outline" | "parts" | "pins" | "nets" | "nails" | null;

export function parseTeboAscBoardview(bytesOrBuffer: Uint8Array | ArrayBuffer): ParsedBoardview {
  const bytes = bytesOrBuffer instanceof Uint8Array ? bytesOrBuffer : new Uint8Array(bytesOrBuffer);
  const lines = new TextDecoder("latin1").decode(bytes).split(/\r?\n/);

  let section: Section = null;
  // Fator para mil (milesimo de polegada); o cabecalho de cada arquivo diz a unidade.
  let unitToMil = 1000;

  const outline: BoardviewPoint[] = [];
  const pinsByPart = new Map<string, { side: BoardviewMountingSide; pins: BoardviewPadPin[] }>();
  const partOrder: string[] = [];
  const testPoints: BoardviewTestPoint[] = [];
  let currentPart: string | null = null;

  for (const line of lines) {
    if (line.startsWith(ASC_BUNDLE_MARKER)) {
      section = null;
      currentPart = null;
      continue;
    }
    if (/Board Outline Contour/i.test(line)) {
      section = "outline";
    } else if (/Part Pins List/i.test(line)) {
      section = "pins";
    } else if (/Parts List/i.test(line)) {
      section = "parts";
    } else if (/Net Listing/i.test(line)) {
      section = "nets";
    } else if (/Test Fixture Nails/i.test(line)) {
      section = "nails";
    }
    if (/\bINCH units\b/i.test(line)) {
      unitToMil = 1000;
    } else if (/\bMM units\b/i.test(line)) {
      unitToMil = 1 / MIL_TO_MM;
    } else if (/\bMILS? units\b/i.test(line)) {
      unitToMil = 1;
    }

    if (section === "outline") {
      const match = OUTLINE_LINE.exec(line);
      if (match) {
        outline.push(point(Number(match[1]) * unitToMil, Number(match[2]) * unitToMil));
      }
    } else if (section === "pins") {
      const header = PART_HEADER.exec(line);
      if (header) {
        currentPart = header[1];
        if (!pinsByPart.has(currentPart)) {
          pinsByPart.set(currentPart, { side: sideOf(header[2]), pins: [] });
          partOrder.push(currentPart);
        }
        continue;
      }
      const match = currentPart ? PIN_LINE.exec(line) : null;
      if (match && currentPart) {
        const part = pinsByPart.get(currentPart)!;
        const xMil = Number(match[3]) * unitToMil;
        const yMil = Number(match[4]) * unitToMil;
        part.pins.push({
          ...point(xMil, yMil),
          id: `${currentPart}.${match[1]}`,
          partIndex: 0,
          partRef: currentPart,
          pinOrdinalWithinPart: part.pins.length + 1,
          probe: -1,
          netName: match[6] ?? "",
          side: part.side,
        });
      }
    } else if (section === "nails") {
      const match = NAIL_LINE.exec(line);
      if (match) {
        const xMil = Number(match[2]) * unitToMil;
        const yMil = Number(match[3]) * unitToMil;
        testPoints.push({
          ...point(xMil, yMil),
          id: `TP-${match[1]}`,
          probe: Number(match[1]),
          side: sideOf(match[4]),
          netName: match[5],
        });
      }
    }
  }

  const components: BoardviewComponent[] = [];
  const padPins: BoardviewPadPin[] = [];

  partOrder.forEach((ref, index) => {
    const part = pinsByPart.get(ref)!;
    if (!part.pins.length) {
      return;
    }
    const firstPinIndex = padPins.length;
    for (const pin of part.pins) {
      padPins.push({ ...pin, partIndex: index + 1 });
    }
    components.push({
      ref,
      partIndex: index + 1,
      rawType: 0,
      mountingSide: part.side,
      kind: "smd",
      firstPinIndex,
      lastPinIndex: padPins.length - 1,
      pinCount: part.pins.length,
    });
  });

  if (!padPins.length) {
    throw new TeboAscParserError(
      "Boardview ASC sem pinos: falta o arquivo Pins.asc do conjunto (Format, Parts, Pins, Nets, Nails).",
    );
  }

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

  // Contorno real do Format.asc quando veio; senao, a caixa dos pinos com margem.
  const allXs = [...padPins.map((pin) => pin.xMil), ...testPoints.map((tp) => tp.xMil), ...outline.map((p) => p.xMil)];
  const allYs = [...padPins.map((pin) => pin.yMil), ...testPoints.map((tp) => tp.yMil), ...outline.map((p) => p.yMil)];
  const margin = outline.length >= 3 ? 0 : CONTOUR_MARGIN_MIL;
  const minXMil = Math.min(...allXs) - margin;
  const maxXMil = Math.max(...allXs) + margin;
  const minYMil = Math.min(...allYs) - margin;
  const maxYMil = Math.max(...allYs) + margin;
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
      format: "tebo-asc",
      variant: "tebo-ict-asc",
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
