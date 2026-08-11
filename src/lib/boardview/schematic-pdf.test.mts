import assert from "node:assert/strict";
import test from "node:test";

import { findSchematicPdfMatches, getBoardviewSelectionSchematicQuery } from "./schematic-pdf.ts";

test("findSchematicPdfMatches returns page hits in order", () => {
  const matches = findSchematicPdfMatches(
    [
      { pageNumber: 18, text: "Clock generator U1900 with PP3V3_G3H and PP1V0_SUS." },
      { pageNumber: 19, text: "Bypass network for U1900 and nearby rails." },
      { pageNumber: 81, text: "Place near U1900.16 for routing notes." },
      { pageNumber: 95, text: "PP3V3_G3H appears in another power tree." },
    ],
    "U1900",
  );

  assert.deepEqual(
    matches.map((match) => match.pageNumber),
    [18, 19, 81],
  );
  assert.equal(matches[0]?.occurrences, 1);
});

test("getBoardviewSelectionSchematicQuery prioritizes component or net terms", async () => {
  const component = {
    ref: "U1900",
  };
  const padPin = {
    partRef: "U1900",
    netName: "PP3V3_G3H",
  };
  const net = {
    name: "PP3V3_G3H",
  };

  assert.equal(
    getBoardviewSelectionSchematicQuery({ kind: "component", component } as never),
    "U1900",
  );
  assert.equal(
    getBoardviewSelectionSchematicQuery({
      kind: "padPin",
      padPin,
      component,
      net,
    } as never),
    "U1900",
  );
  assert.equal(
    getBoardviewSelectionSchematicQuery({ kind: "net", net } as never),
    "PP3V3_G3H",
  );
});
