import type {
  BoardviewComponent,
  BoardviewMountingSide,
  BoardviewNet,
  BoardviewPadPin,
  BoardviewPartKind,
  BoardviewPoint,
  BoardviewTestPoint,
  ParsedBoardview,
} from "@/types/boardview";

const MIL_TO_MM = 0.0254;
const CONTOUR_MARGIN_MIL = 200;

export class GenCadParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenCadParserError";
  }
}

function milToMm(value: number) {
  return Number((value * MIL_TO_MM).toFixed(4));
}

export function isGenCadBoardview(bytesOrBuffer: Uint8Array | ArrayBuffer): boolean {
  const bytes =
    bytesOrBuffer instanceof Uint8Array ? bytesOrBuffer : new Uint8Array(bytesOrBuffer);
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 512)).toUpperCase();
  return head.includes("$HEADER") && head.includes("GENCAD");
}

function normalizeSide(value: string | undefined): BoardviewMountingSide {
  const normalized = (value ?? "").trim().toUpperCase();

  if (normalized === "BOTTOM") {
    return "bottom";
  }

  if (normalized === "TOP") {
    return "top";
  }

  return "both";
}

function splitTokens(line: string): string[] {
  return line.trim().split(/\s+/);
}

type ShapePin = {
  pinNumber: string;
  offsetXMil: number;
  offsetYMil: number;
};

type ShapeDef = {
  pins: ShapePin[];
  technology: BoardviewPartKind | null;
};

type RawComponent = {
  ref: string;
  xMil: number;
  yMil: number;
  side: BoardviewMountingSide;
  rotationDeg: number;
  mirrorX: boolean;
  mirrorY: boolean;
  shapeName: string;
  technology: BoardviewPartKind | null;
};

type RawTestPin = {
  xMil: number;
  yMil: number;
  netName: string;
  side: BoardviewMountingSide;
};

/**
 * Parses GenCAD 1.4 boardview exports (plain-text, documented PCB
 * interchange format produced by tools like CAMCAD) into the same
 * ParsedBoardview shape the Landrex/Testlink .brd parser produces, so
 * both can drive the same boardview lab viewer.
 *
 * GenCAD has no explicit board outline polygon in the sections we care
 * about ($BOARD only carries THICKNESS; the real outline lives in
 * $SHAPES/$MECH and would need full polygon resolution to recover), so
 * the contour here is a padded bounding box of every pad/test point
 * instead of the true board edge.
 */
export function parseGenCadBoardview(
  bytesOrBuffer: Uint8Array | ArrayBuffer,
): ParsedBoardview {
  const bytes = bytesOrBuffer instanceof Uint8Array ? bytesOrBuffer : new Uint8Array(bytesOrBuffer);
  const text = new TextDecoder("latin1").decode(bytes);
  const lines = text.split(/\r\n|\n|\r/g);

  const shapes = new Map<string, ShapeDef>();
  const rawComponents: RawComponent[] = [];
  const netByRefPin = new Map<string, string>();
  const rawTestPins: RawTestPin[] = [];

  let section: string | null = null;

  let currentShapeName: string | null = null;
  let currentShapePins: ShapePin[] = [];
  let currentShapeTechnology: BoardviewPartKind | null = null;

  let currentComponent: Partial<RawComponent> | null = null;
  let currentSignalName: string | null = null;

  function flushShape() {
    if (currentShapeName) {
      shapes.set(currentShapeName, {
        pins: currentShapePins,
        technology: currentShapeTechnology,
      });
    }

    currentShapeName = null;
    currentShapePins = [];
    currentShapeTechnology = null;
  }

  function flushComponent() {
    if (currentComponent?.ref) {
      rawComponents.push({
        ref: currentComponent.ref,
        xMil: currentComponent.xMil ?? 0,
        yMil: currentComponent.yMil ?? 0,
        side: currentComponent.side ?? "top",
        rotationDeg: currentComponent.rotationDeg ?? 0,
        mirrorX: Boolean(currentComponent.mirrorX),
        mirrorY: Boolean(currentComponent.mirrorY),
        shapeName: currentComponent.shapeName ?? "",
        technology: currentComponent.technology ?? null,
      });
    }

    currentComponent = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith("$")) {
      const upper = line.toUpperCase();

      if (upper.startsWith("$END")) {
        if (section === "SHAPES") {
          flushShape();
        }
        if (section === "COMPONENTS") {
          flushComponent();
        }
        section = null;
      } else {
        section = upper.slice(1);
      }

      continue;
    }

    const tokens = splitTokens(line);
    const keyword = tokens[0]?.toUpperCase();

    switch (section) {
      case "SHAPES": {
        if (keyword === "SHAPE") {
          flushShape();
          currentShapeName = tokens[1] ?? null;
        } else if (keyword === "PIN" && currentShapeName) {
          currentShapePins.push({
            pinNumber: tokens[1] ?? "",
            offsetXMil: Number.parseFloat(tokens[3] ?? "0"),
            offsetYMil: Number.parseFloat(tokens[4] ?? "0"),
          });
        } else if (keyword === "ATTRIBUTE" && /technology/i.test(line)) {
          if (/"SMD"/i.test(line)) {
            currentShapeTechnology = "smd";
          } else if (/"THRU"/i.test(line)) {
            currentShapeTechnology = "through_hole";
          }
        }
        break;
      }
      case "COMPONENTS": {
        if (keyword === "COMPONENT") {
          flushComponent();
          currentComponent = { ref: tokens[1] ?? "" };
        } else if (currentComponent) {
          if (keyword === "PLACE") {
            currentComponent.xMil = Number.parseFloat(tokens[1] ?? "0");
            currentComponent.yMil = Number.parseFloat(tokens[2] ?? "0");
          } else if (keyword === "LAYER") {
            currentComponent.side = normalizeSide(tokens[1]);
          } else if (keyword === "ROTATION") {
            currentComponent.rotationDeg = Number.parseFloat(tokens[1] ?? "0");
          } else if (keyword === "SHAPE") {
            currentComponent.shapeName = tokens[1] ?? "";
            const flags = tokens.slice(2).join(" ").toUpperCase();
            currentComponent.mirrorX = flags.includes("MIRRORX");
            currentComponent.mirrorY = flags.includes("MIRRORY");
          } else if (keyword === "ATTRIBUTE" && /technology/i.test(line)) {
            if (/"SMD"/i.test(line)) {
              currentComponent.technology = "smd";
            } else if (/"THRU"/i.test(line)) {
              currentComponent.technology = "through_hole";
            }
          }
        }
        break;
      }
      case "SIGNALS": {
        if (keyword === "SIGNAL") {
          currentSignalName = tokens.slice(1).join(" ");
        } else if (keyword === "NODE" && currentSignalName) {
          const ref = tokens[1] ?? "";
          const pin = tokens[2] ?? "";
          if (ref && pin) {
            netByRefPin.set(`${ref}\u0000${pin}`, currentSignalName);
          }
        }
        break;
      }
      case "TESTPINS": {
        if (keyword === "TESTPIN") {
          rawTestPins.push({
            xMil: Number.parseFloat(tokens[2] ?? "0"),
            yMil: Number.parseFloat(tokens[3] ?? "0"),
            netName: tokens[4] ?? "",
            side: normalizeSide(tokens[tokens.length - 1]),
          });
        }
        break;
      }
      default:
        break;
    }
  }

  flushShape();
  flushComponent();

  if (!rawComponents.length) {
    throw new GenCadParserError(
      "Nao foi possivel localizar componentes no bloco $COMPONENTS do arquivo GenCAD.",
    );
  }

  const components: BoardviewComponent[] = [];
  const padPins: BoardviewPadPin[] = [];
  let runningPinIndex = 1;

  rawComponents.forEach((raw, index) => {
    const shape = shapes.get(raw.shapeName);
    const pins = shape?.pins ?? [];
    const firstPinIndex = runningPinIndex;
    const rotationRad = (raw.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rotationRad);
    const sin = Math.sin(rotationRad);

    pins.forEach((pin, pinOrdinal) => {
      let offsetX = pin.offsetXMil;
      let offsetY = pin.offsetYMil;

      if (raw.mirrorY) {
        offsetY = -offsetY;
      }
      if (raw.mirrorX) {
        offsetX = -offsetX;
      }

      const rotatedX = offsetX * cos - offsetY * sin;
      const rotatedY = offsetX * sin + offsetY * cos;
      const xMil = raw.xMil + rotatedX;
      const yMil = raw.yMil + rotatedY;
      const netName = netByRefPin.get(`${raw.ref}\u0000${pin.pinNumber}`) ?? "UNCONNECTED";

      padPins.push({
        id: `${raw.ref}:${pinOrdinal + 1}`,
        partIndex: index + 1,
        partRef: raw.ref,
        pinOrdinalWithinPart: pinOrdinal + 1,
        probe: -1,
        netName,
        side: raw.side,
        xMil,
        yMil,
        xMm: milToMm(xMil),
        yMm: milToMm(yMil),
      });

      runningPinIndex += 1;
    });

    components.push({
      ref: raw.ref,
      partIndex: index + 1,
      rawType: 0,
      mountingSide: raw.side,
      kind: raw.technology ?? shape?.technology ?? "smd",
      firstPinIndex,
      lastPinIndex: runningPinIndex - 1,
      pinCount: pins.length,
    });
  });

  const testPoints: BoardviewTestPoint[] = rawTestPins.map((testPin, index) => ({
    id: `TP-${index + 1}`,
    probe: -1,
    side: testPin.side,
    netName: testPin.netName,
    xMil: testPin.xMil,
    yMil: testPin.yMil,
    xMm: milToMm(testPin.xMil),
    yMm: milToMm(testPin.yMil),
  }));

  const connectedNetNames = new Set<string>();
  const netAccumulator = new Map<string, { padPinCount: number; testPointCount: number }>();

  function registerNet(name: string, kind: "pad" | "test") {
    const normalizedName = name.trim();

    if (!normalizedName || normalizedName.toUpperCase() === "UNCONNECTED") {
      return;
    }

    connectedNetNames.add(normalizedName);

    const entry = netAccumulator.get(normalizedName) ?? { padPinCount: 0, testPointCount: 0 };

    if (kind === "pad") {
      entry.padPinCount += 1;
    } else {
      entry.testPointCount += 1;
    }

    netAccumulator.set(normalizedName, entry);
  }

  for (const padPin of padPins) {
    registerNet(padPin.netName, "pad");
  }

  for (const testPoint of testPoints) {
    registerNet(testPoint.netName, "test");
  }

  const nets: BoardviewNet[] = [...netAccumulator.entries()]
    .map(([name, entry]) => ({
      name,
      padPinCount: entry.padPinCount,
      testPointCount: entry.testPointCount,
      probeIds: [],
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const boundaryXs = [...padPins.map((pad) => pad.xMil), ...testPoints.map((tp) => tp.xMil)];
  const boundaryYs = [...padPins.map((pad) => pad.yMil), ...testPoints.map((tp) => tp.yMil)];

  if (!boundaryXs.length) {
    throw new GenCadParserError(
      "Nao foi possivel calcular os limites do board: nenhum pad com posicao valida foi encontrado.",
    );
  }

  const minXMil = Math.min(...boundaryXs) - CONTOUR_MARGIN_MIL;
  const maxXMil = Math.max(...boundaryXs) + CONTOUR_MARGIN_MIL;
  const minYMil = Math.min(...boundaryYs) - CONTOUR_MARGIN_MIL;
  const maxYMil = Math.max(...boundaryYs) + CONTOUR_MARGIN_MIL;

  const contour: BoardviewPoint[] = [
    { xMil: minXMil, yMil: minYMil, xMm: milToMm(minXMil), yMm: milToMm(minYMil) },
    { xMil: maxXMil, yMil: minYMil, xMm: milToMm(maxXMil), yMm: milToMm(minYMil) },
    { xMil: maxXMil, yMil: maxYMil, xMm: milToMm(maxXMil), yMm: milToMm(maxYMil) },
    { xMil: minXMil, yMil: maxYMil, xMm: milToMm(minXMil), yMm: milToMm(maxYMil) },
  ];

  const counts = {
    contourPoints: contour.length,
    components: components.length,
    padPins: padPins.length,
    testPoints: testPoints.length,
    nets: nets.length,
  };

  return {
    metadata: {
      format: "gencad",
      variant: "gencad-1.4",
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
  };
}
