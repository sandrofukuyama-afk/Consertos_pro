import assert from "node:assert/strict";
import test from "node:test";

import { isGenCadBoardview, parseGenCadBoardview } from "./gencad.ts";

const syntheticFixture = [
  "$HEADER",
  "GENCAD 1.4",
  'USER "fixture"',
  "$ENDHEADER",
  "",
  "$BOARD",
  "THICKNESS 40.000",
  "$ENDBOARD",
  "",
  "$SHAPES",
  "SHAPE U1",
  "PIN 1  PADSTACK_A -10.000 0.000 TOP 0.00 0",
  "PIN 2  PADSTACK_A 10.000 0.000 TOP 0.00 0",
  'ATTRIBUTE SHAPE_1 "TECHNOLOGY" "SMD"',
  "SHAPE R1",
  "PIN 1  PADSTACK_B 0.000 5.000 TOP 0.00 0",
  "PIN 2  PADSTACK_B 0.000 -5.000 TOP 0.00 0",
  "INSERT SMD",
  "$ENDSHAPES",
  "",
  "$COMPONENTS",
  "COMPONENT U1",
  "PLACE 1000.000 2000.000",
  "LAYER TOP",
  "ROTATION 0.00",
  "SHAPE U1 0 0",
  "DEVICE Device1",
  'ATTRIBUTE COMPONENT_1 "TECHNOLOGY" "SMD"',
  "COMPONENT R1",
  "PLACE 500.000 500.000",
  "LAYER BOTTOM",
  "ROTATION 90.00",
  "SHAPE R1 MIRRORY FLIP",
  "DEVICE Device2",
  "$ENDCOMPONENTS",
  "",
  "$SIGNALS",
  "SIGNAL GND",
  "NODE U1 1",
  "NODE R1 2",
  "SIGNAL NET_A",
  "NODE U1 2",
  "NODE R1 1",
  "$ENDSIGNALS",
  "",
  "$TESTPINS",
  "TESTPIN Probe_ 1000.000 2050.000 GND -1 -1 Test_Probe TOP",
  "$ENDTESTPINS",
  "",
  "$TRACKS",
  "TRACK 0 5.000",
  "$ENDTRACKS",
  "",
  "$ROUTES",
  "ROUTE NET_A",
  "TRACK 0",
  "LAYER TOP",
  "LINE 1010.000 2000.000 900.000 2000.000",
  "LINE 900.000 2000.000 505.000 500.000",
  "ARC 505.000 500.000 495.000 500.000 500.000 500.000",
  "$ENDROUTES",
  "",
].join("\r\n");

const fixtureBytes = new TextEncoder().encode(syntheticFixture);

test("isGenCadBoardview detects the $HEADER/GENCAD signature", () => {
  assert.equal(isGenCadBoardview(fixtureBytes), true);
  assert.equal(isGenCadBoardview(new TextEncoder().encode("str_length:\r\n")), false);
});

test("parseGenCadBoardview resolves component placement, rotation and mirroring", () => {
  const parsed = parseGenCadBoardview(fixtureBytes);

  assert.equal(parsed.metadata.format, "gencad");
  assert.equal(parsed.components.length, 2);
  assert.equal(parsed.padPins.length, 4);

  const u1Pin1 = parsed.padPins.find((pad) => pad.id === "U1:1");
  const u1Pin2 = parsed.padPins.find((pad) => pad.id === "U1:2");
  assert.ok(u1Pin1 && u1Pin2);
  assert.equal(u1Pin1?.xMil, 990);
  assert.equal(u1Pin1?.yMil, 2000);
  assert.equal(u1Pin1?.netName, "GND");
  assert.equal(u1Pin2?.xMil, 1010);
  assert.equal(u1Pin2?.netName, "NET_A");

  // R1 is rotated 90deg and mirrored on Y (bottom-side component).
  const r1Pin1 = parsed.padPins.find((pad) => pad.id === "R1:1");
  const r1Pin2 = parsed.padPins.find((pad) => pad.id === "R1:2");
  assert.ok(r1Pin1 && r1Pin2);
  assert.ok(Math.abs((r1Pin1?.xMil ?? 0) - 505) < 0.01);
  assert.ok(Math.abs((r1Pin1?.yMil ?? 0) - 500) < 0.01);
  assert.equal(r1Pin1?.netName, "NET_A");
  assert.ok(Math.abs((r1Pin2?.xMil ?? 0) - 495) < 0.01);
  assert.equal(r1Pin2?.netName, "GND");
  assert.equal(r1Pin1?.side, "bottom");

  const gndNet = parsed.nets.find((net) => net.name === "GND");
  assert.equal(gndNet?.padPinCount, 2);
  assert.equal(gndNet?.testPointCount, 1);

  assert.equal(parsed.testPoints.length, 1);
  assert.equal(parsed.testPoints[0]?.netName, "GND");
  assert.equal(parsed.testPoints[0]?.side, "top");

  // Contour is a padded bounding box of every pad/test point.
  assert.ok(parsed.metadata.bounds.minXMil < 495);
  assert.ok(parsed.metadata.bounds.maxXMil > 1010);
});

test("parseGenCadBoardview resolves real trace segments from $ROUTES with widths from $TRACKS", () => {
  const parsed = parseGenCadBoardview(fixtureBytes);

  assert.equal(parsed.traces.length, 3);
  assert.ok(parsed.traces.every((segment) => segment.netName === "NET_A"));
  assert.ok(parsed.traces.every((segment) => segment.side === "top"));
  assert.ok(parsed.traces.every((segment) => segment.widthMil === 5));

  const [first, , arc] = parsed.traces;
  assert.equal(first?.x1Mil, 1010);
  assert.equal(first?.y1Mil, 2000);
  assert.equal(first?.x2Mil, 900);
  assert.equal(first?.y2Mil, 2000);

  // ARC vira corda reta entre inicio e fim, sem a curvatura.
  assert.equal(arc?.x1Mil, 505);
  assert.equal(arc?.x2Mil, 495);
});

test("parseGenCadBoardview throws a clear error when $COMPONENTS is empty", () => {
  const emptyFixture = ["$HEADER", "GENCAD 1.4", "$ENDHEADER", ""].join("\r\n");

  assert.throws(() => parseGenCadBoardview(new TextEncoder().encode(emptyFixture)));
});
