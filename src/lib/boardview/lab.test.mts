import assert from "node:assert/strict";
import test from "node:test";

import type { ParsedBoardview } from "@/types/boardview";

import {
  boardToCanvasPoint,
  buildBoardviewLabModel,
  canvasToBoardPoint,
  findNearestBoardviewSelection,
  fitBoardviewViewport,
  getSelectionHighlightNetName,
  searchBoardviewLabModel,
} from "./lab.ts";

const parsedFixture: ParsedBoardview = {
  metadata: {
    format: "landrex-testlink",
    variant: "plain-text-or-unknown-variant",
    sourceEncoding: "latin1",
    declaredCounts: {
      contourPoints: 4,
      components: 2,
      padPins: 3,
      testPoints: 1,
      nets: 3,
    },
    parsedCounts: {
      contourPoints: 4,
      components: 2,
      padPins: 3,
      testPoints: 1,
      nets: 3,
    },
    bounds: {
      minXMil: 0,
      maxXMil: 1000,
      minYMil: 0,
      maxYMil: 500,
      minXMm: 0,
      maxXMm: 25.4,
      minYMm: 0,
      maxYMm: 12.7,
    },
    boardWidthMil: 1000,
    boardHeightMil: 500,
    boardWidthMm: 25.4,
    boardHeightMm: 12.7,
  },
  contour: [
    { xMil: 0, yMil: 0, xMm: 0, yMm: 0 },
    { xMil: 1000, yMil: 0, xMm: 25.4, yMm: 0 },
    { xMil: 1000, yMil: 500, xMm: 25.4, yMm: 12.7 },
    { xMil: 0, yMil: 500, xMm: 0, yMm: 12.7 },
  ],
  components: [
    {
      ref: "U1",
      partIndex: 1,
      rawType: 5,
      mountingSide: "top",
      kind: "smd",
      firstPinIndex: 1,
      lastPinIndex: 2,
      pinCount: 2,
    },
    {
      ref: "R1",
      partIndex: 2,
      rawType: 10,
      mountingSide: "bottom",
      kind: "smd",
      firstPinIndex: 3,
      lastPinIndex: 3,
      pinCount: 1,
    },
  ],
  padPins: [
    {
      id: "U1:1",
      partIndex: 1,
      partRef: "U1",
      pinOrdinalWithinPart: 1,
      probe: 1,
      netName: "GND",
      side: "top",
      xMil: 100,
      yMil: 100,
      xMm: 2.54,
      yMm: 2.54,
    },
    {
      id: "U1:2",
      partIndex: 1,
      partRef: "U1",
      pinOrdinalWithinPart: 2,
      probe: -99,
      netName: "PP3V3_S0",
      side: "top",
      xMil: 140,
      yMil: 100,
      xMm: 3.556,
      yMm: 2.54,
    },
    {
      id: "R1:1",
      partIndex: 2,
      partRef: "R1",
      pinOrdinalWithinPart: 1,
      probe: 2,
      netName: "NET_A",
      side: "bottom",
      xMil: 800,
      yMil: 300,
      xMm: 20.32,
      yMm: 7.62,
    },
  ],
  nets: [
    { name: "GND", padPinCount: 1, testPointCount: 1, probeIds: [1] },
    { name: "NET_A", padPinCount: 1, testPointCount: 0, probeIds: [2] },
    { name: "PP3V3_S0", padPinCount: 1, testPointCount: 0, probeIds: [] },
  ],
  testPoints: [
    {
      id: "TP-1",
      probe: 1,
      side: "top",
      netName: "GND",
      xMil: 80,
      yMil: 90,
      xMm: 2.032,
      yMm: 2.286,
    },
  ],
};

test("buildBoardviewLabModel derives component geometry and search hits", () => {
  const model = buildBoardviewLabModel(parsedFixture);
  const firstComponent = model.components[0];

  assert.equal(firstComponent?.ref, "U1");
  assert.equal(firstComponent?.centerXMil, 120);
  assert.equal(firstComponent?.centerYMil, 100);

  const results = searchBoardviewLabModel(model, "gnd", "both");
  assert.equal(results[0]?.selection.kind, "net");
  assert.equal(results[0]?.title, "GND");
});

test("fitBoardviewViewport and coordinate transforms stay reversible", () => {
  const viewport = fitBoardviewViewport(parsedFixture.contour, 1000, 500);
  const canvasPoint = boardToCanvasPoint(
    { xMil: 100, yMil: 100 },
    viewport,
    parsedFixture.metadata.bounds,
    false,
  );
  const boardPoint = canvasToBoardPoint(
    canvasPoint,
    viewport,
    parsedFixture.metadata.bounds,
    false,
  );

  assert.ok(viewport.scale > 0);
  assert.ok(Math.abs(boardPoint.xMil - 100) < 0.001);
  assert.ok(Math.abs(boardPoint.yMil - 100) < 0.001);
});

test("findNearestBoardviewSelection prioritizes pad pins and exposes highlight net", () => {
  const model = buildBoardviewLabModel(parsedFixture);
  const selection = findNearestBoardviewSelection(
    model,
    { xMil: 102, yMil: 102 },
    "top",
    40,
  );

  assert.ok(selection);
  assert.equal(selection?.kind, "padPin");
  assert.equal(getSelectionHighlightNetName(selection ?? null), "GND");
});
