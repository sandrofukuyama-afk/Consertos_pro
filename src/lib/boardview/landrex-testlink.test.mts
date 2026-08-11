import assert from "node:assert/strict";
import test from "node:test";

import { parseLandrexTestlinkBoardview } from "./landrex-testlink.ts";

function encodeLandrexFixture(plainText: string) {
  const source = new TextEncoder().encode(plainText);
  const encoded = new Uint8Array(source.length);

  for (let index = 0; index < source.length; index += 1) {
    const value = source[index] ?? 0;

    if (value === 0 || value === 10 || value === 13) {
      encoded[index] = value;
      continue;
    }

    const inverse = (~value) & 0xff;
    encoded[index] = ((inverse >> 2) | ((inverse & 0x03) << 6)) & 0xff;
  }

  return encoded;
}

const syntheticFixture = [
  "str_length:",
  "7 31",
  "",
  "var_data:",
  "4 2 3 2 -1 0",
  "",
  "Format:",
  "0 0",
  "1000 0",
  "1000 500",
  "0 500",
  "",
  "Parts:",
  "U1 5 2",
  "R1 10 3",
  "",
  "Pins:",
  "100 200 1 1 GND",
  "120 200 -99 1 PP3V3_S0",
  "450 300 2 2 NET_A",
  "",
  "Nails:",
  "1 90 180 1 GND",
  "2 470 320 2 NET_A",
  "",
].join("\r\n");

test("parseLandrexTestlinkBoardview parses an encoded synthetic fixture", () => {
  const parsed = parseLandrexTestlinkBoardview(
    encodeLandrexFixture(syntheticFixture),
  );

  assert.equal(parsed.metadata.variant, "encoded-landrex-testlink");
  assert.equal(parsed.metadata.declaredCounts.components, 2);
  assert.equal(parsed.metadata.declaredCounts.padPins, 3);
  assert.equal(parsed.metadata.declaredCounts.testPoints, 2);
  assert.equal(parsed.metadata.parsedCounts.nets, 3);
  assert.equal(parsed.metadata.boardWidthMil, 1000);
  assert.equal(parsed.metadata.boardHeightMil, 500);
  assert.equal(parsed.components[0]?.ref, "U1");
  assert.equal(parsed.components[0]?.pinCount, 2);
  assert.equal(parsed.components[1]?.pinCount, 1);
  assert.equal(parsed.padPins[0]?.partRef, "U1");
  assert.equal(parsed.padPins[2]?.partRef, "R1");
  assert.equal(parsed.testPoints[0]?.side, "top");
  assert.equal(parsed.testPoints[1]?.side, "bottom");
  assert.deepEqual(
    parsed.nets.map((net) => net.name),
    ["GND", "NET_A", "PP3V3_S0"],
  );
});

test("parseLandrexTestlinkBoardview also accepts plain decoded text bytes", () => {
  const plainBytes = new TextEncoder().encode(syntheticFixture);
  const parsed = parseLandrexTestlinkBoardview(plainBytes);

  assert.equal(parsed.metadata.variant, "plain-text-or-unknown-variant");
  assert.equal(parsed.metadata.parsedCounts.components, 2);
  assert.equal(parsed.metadata.parsedCounts.padPins, 3);
  assert.equal(parsed.metadata.parsedCounts.testPoints, 2);
});
