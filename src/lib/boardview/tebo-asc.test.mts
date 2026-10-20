import assert from "node:assert/strict";
import test from "node:test";

import { ASC_BUNDLE_MARKER, isTeboAscBoardview, parseTeboAscBoardview } from "./tebo-asc.ts";

// Recortes do formato real (Surface Laptop 3, placa M1098028-008).
const format = [
  " 5k-enh_edan_mb.30-Eng-0524        Tebo-ICT,  license #BoJie",
  "",
  " Board Outline Contour             INCH units               05-June-2019 13:12",
  "",
  "      X           Y         Radius",
  "",
  "   -2.790      -0.195       0.000",
  "    6.942      -0.195       0.000",
  "    6.942       6.943       0.000",
  "   -2.790       6.943       0.000",
].join("\r\n");

const pins = [
  " 5k-enh_edan_mb.30-Eng-0524        Tebo-ICT,  license #BoJie",
  "",
  " Part Pins List          2772/2772  Selected Parts             05-June-2019 13:12",
  "                                                           INCH units",
  "",
  "Part        T/B",
  "Pin   Name      X         Y     Layer  Net               Nail(s)",
  "",
  "Part R1001  (B)",
  "",
  "   1    1    2.7942    1.9909     2    GND               2",
  "   2    2    2.7942    2.0094     2    PECI              ",
  "",
  "Part R1002  (T)",
  "",
  "   1    1    3.9358    2.2669     1    GND               ",
  "   2    2    3.9358    2.2853     1    PECI              ",
].join("\r\n");

const nails = [
  " Test Fixture Nails     153/153  Selected Drills           05-June-2019 13:12",
  "                        153 Nails,  2523 Nets               INCH units",
  "",
  "Nail         X         Y   Type Grid T/B  Net   Net Name   Virtual Pin/Via",
  "",
  "$1        5.8406    0.8036   4  AA   (B)  #671  ON_+5V_FAN_REG   T PIN MTP6402.1",
].join("\r\n");

const bundle = new TextEncoder().encode(
  [`${ASC_BUNDLE_MARKER} Format.asc`, format, `${ASC_BUNDLE_MARKER} Pins.asc`, pins, `${ASC_BUNDLE_MARKER} Nails.asc`, nails].join("\n"),
);

test("isTeboAscBoardview reconhece o conjunto e o Pins.asc sozinho", () => {
  assert.equal(isTeboAscBoardview(bundle), true);
  assert.equal(isTeboAscBoardview(new TextEncoder().encode(pins)), true);
  assert.equal(isTeboAscBoardview(new TextEncoder().encode("$HEADER\nGENCAD 1.4")), false);
});

test("parseTeboAscBoardview monta pecas, pinos, nets, test points e contorno", () => {
  const parsed = parseTeboAscBoardview(bundle);

  assert.equal(parsed.metadata.format, "tebo-asc");
  assert.deepEqual(
    parsed.components.map((component) => [component.ref, component.mountingSide, component.pinCount]),
    [
      ["R1001", "bottom", 2],
      ["R1002", "top", 2],
    ],
  );
  assert.equal(parsed.padPins[0].xMil, 2794.2);
  assert.equal(parsed.padPins[1].netName, "PECI");
  assert.deepEqual(
    parsed.nets.map((net) => [net.name, net.padPinCount, net.testPointCount]),
    [
      ["GND", 2, 0],
      ["ON_+5V_FAN_REG", 0, 1],
      ["PECI", 2, 0],
    ],
  );
  assert.equal(parsed.testPoints[0].id, "TP-1");
  assert.equal(parsed.testPoints[0].side, "bottom");
  // Contorno real do Format.asc (polegadas -> mil).
  assert.equal(parsed.contour.length, 4);
  assert.equal(parsed.contour[0].xMil, -2790);
});

test("parseTeboAscBoardview sem Pins.asc explica o que falta", () => {
  assert.throws(() => parseTeboAscBoardview(new TextEncoder().encode(format)), /Pins\.asc/);
});
