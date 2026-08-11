import assert from "node:assert/strict";
import test from "node:test";

import { buildBoardviewLabModel } from "./lab.ts";
import {
  resolveInitialBoardviewSelection,
  resolveInitialSideFilter,
  type InitialBoardviewFocus,
} from "./lab-focus.ts";
import { resolveRequestedSchematicPage } from "./schematic-pdf.ts";
import type { ParsedBoardview } from "../../types/boardview";

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
      ref: "U1900",
      partIndex: 1,
      rawType: 5,
      mountingSide: "top",
      kind: "smd",
      firstPinIndex: 1,
      lastPinIndex: 2,
      pinCount: 2,
    },
    {
      ref: "R7050",
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
      id: "U1900:1",
      partIndex: 1,
      partRef: "U1900",
      pinOrdinalWithinPart: 1,
      probe: 1,
      netName: "PPBUS_G3H",
      side: "top",
      xMil: 100,
      yMil: 100,
      xMm: 2.54,
      yMm: 2.54,
    },
    {
      id: "U1900:2",
      partIndex: 1,
      partRef: "U1900",
      pinOrdinalWithinPart: 2,
      probe: -99,
      netName: "PP3V3_G3H",
      side: "top",
      xMil: 140,
      yMil: 100,
      xMm: 3.556,
      yMm: 2.54,
    },
    {
      id: "R7050:1",
      partIndex: 2,
      partRef: "R7050",
      pinOrdinalWithinPart: 1,
      probe: 2,
      netName: "PPBUS_G3H",
      side: "bottom",
      xMil: 800,
      yMil: 300,
      xMm: 20.32,
      yMm: 7.62,
    },
  ],
  nets: [
    { name: "PPBUS_G3H", padPinCount: 2, testPointCount: 1, probeIds: [1, 2] },
    { name: "PP3V3_G3H", padPinCount: 1, testPointCount: 0, probeIds: [] },
    { name: "GND", padPinCount: 0, testPointCount: 0, probeIds: [] },
  ],
  testPoints: [
    {
      id: "TP4200",
      probe: 1,
      side: "top",
      netName: "PPBUS_G3H",
      xMil: 80,
      yMil: 90,
      xMm: 2.032,
      yMm: 2.286,
    },
  ],
};

function createFocus(overrides: Partial<InitialBoardviewFocus>): InitialBoardviewFocus {
  return {
    component: null,
    net: null,
    pad: null,
    side: "both",
    ...overrides,
  };
}

test("AI component link resolves component selection and preserves requested side", () => {
  const model = buildBoardviewLabModel(parsedFixture);
  const selection = resolveInitialBoardviewSelection(
    model,
    createFocus({ component: "U1900", side: "top" }),
    "",
  );

  assert.ok(selection);
  assert.equal(selection?.kind, "component");
  assert.equal(selection?.component.ref, "U1900");
  assert.equal(resolveInitialSideFilter(selection!, "top"), "top");
});

test("AI net link resolves net selection and keeps explicit side filter", () => {
  const model = buildBoardviewLabModel(parsedFixture);
  const selection = resolveInitialBoardviewSelection(
    model,
    createFocus({ net: "PPBUS_G3H", side: "bottom" }),
    "",
  );

  assert.ok(selection);
  assert.equal(selection?.kind, "net");
  assert.equal(selection?.net.name, "PPBUS_G3H");
  assert.equal(resolveInitialSideFilter(selection!, "bottom"), "bottom");
});

test("AI pad or test point link resolves an exact technical point", () => {
  const model = buildBoardviewLabModel(parsedFixture);
  const selection = resolveInitialBoardviewSelection(
    model,
    createFocus({ pad: "TP4200" }),
    "",
  );

  assert.ok(selection);
  assert.equal(selection?.kind, "testPoint");
  assert.equal(selection?.testPoint.id, "TP4200");
  assert.equal(resolveInitialSideFilter(selection!, "both"), "top");
});

test("AI schematic page link clamps the requested page safely", () => {
  assert.equal(resolveRequestedSchematicPage(4, 12), 4);
  assert.equal(resolveRequestedSchematicPage(0, 12), null);
  assert.equal(resolveRequestedSchematicPage(99, 12), 12);
});
