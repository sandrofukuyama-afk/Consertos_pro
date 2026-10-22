import assert from "node:assert/strict";
import test from "node:test";

import { isBrd2Boardview, parseBrd2Boardview } from "./brd2.ts";

// Recorte do formato real (Dell 7559, placa DA0AM9MB8D0).
const sample = [
  "3337776",
  "BRDOUT: 4 6254 11620",
  "0 11620",
  "0 0",
  "6254 0",
  "6254 11620",
  "",
  "NETS: 3",
  "1 GND",
  "2 SPI_CS#",
  "3 +3.3V_SUS",
  "PARTS: 2",
  "R1 100 100 120 140 2 2",
  "U16 500 500 600 600 0 1",
  "PINS: 4",
  "510 510 2 1",
  "590 590 3 1",
  "110 110 1 2",
  "110 130 2 2",
  "NAILS: 1",
  "7 300 300 3 1",
].join("\r\n");

const bytes = new TextEncoder().encode(sample);

test("detecta BRD2 pelo bloco BRDOUT", () => {
  assert.equal(isBrd2Boardview(bytes), true);
  assert.equal(isBrd2Boardview(new TextEncoder().encode("GENCAD\r\n$HEADER")), false);
});

test("le pecas, pinos pela faixa do primeiro pino, nets e test points", () => {
  const model = parseBrd2Boardview(bytes);
  assert.equal(model.metadata.format, "brd2");
  assert.equal(model.components.length, 2);

  const u16 = model.components.find((component) => component.ref === "U16");
  assert.equal(u16?.mountingSide, "top");
  assert.equal(u16?.pinCount, 2);
  const u16Pins = model.padPins.filter((pin) => pin.partRef === "U16");
  assert.deepEqual(
    u16Pins.map((pin) => [pin.pinOrdinalWithinPart, pin.netName]),
    [
      [1, "SPI_CS#"],
      [2, "+3.3V_SUS"],
    ],
  );

  const r1Pins = model.padPins.filter((pin) => pin.partRef === "R1");
  assert.deepEqual(r1Pins.map((pin) => pin.netName), ["GND", "SPI_CS#"]);
  assert.equal(r1Pins[0].side, "bottom");

  assert.equal(model.testPoints[0].netName, "+3.3V_SUS");
  assert.equal(model.nets.find((net) => net.name === "SPI_CS#")?.padPinCount, 2);
  assert.equal(model.contour.length, 4);
});
