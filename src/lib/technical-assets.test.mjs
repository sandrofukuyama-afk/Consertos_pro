import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTechnicalAssetStoragePath,
  formatTechnicalAssetSize,
  getTechnicalAssetDisplayType,
  getTechnicalAssetFormat,
  mapTechnicalAssetType,
  normalizeTechnicalAssetHash,
  planTechnicalAssetPersistence,
  validateTechnicalAssetFile,
} from "./technical-assets.mjs";

test("detecta extensoes tecnicas suportadas", () => {
  assert.equal(getTechnicalAssetFormat("placa.BRD"), "brd");
  assert.equal(getTechnicalAssetFormat("placa.bdv"), "bdv");
  assert.equal(getTechnicalAssetFormat("esquema.pdf"), "pdf");
  assert.equal(getTechnicalAssetFormat("foto.png"), null);
});

test("mapeia o tipo do asset a partir do formato", () => {
  assert.equal(mapTechnicalAssetType("brd"), "boardview");
  assert.equal(mapTechnicalAssetType("bdv"), "boardview");
  assert.equal(mapTechnicalAssetType("pdf"), "schematic_pdf");
});

test("valida tamanho maximo por extensao", () => {
  assert.throws(
    () => validateTechnicalAssetFile({ name: "placa.brd", size: 101 * 1024 * 1024 }),
    /100 MB/,
  );
  assert.throws(
    () => validateTechnicalAssetFile({ name: "esquema.pdf", size: 201 * 1024 * 1024 }),
    /200 MB/,
  );

  const pdf = validateTechnicalAssetFile({
    name: "esquema.pdf",
    size: 25 * 1024 * 1024,
    type: "",
  });

  assert.equal(pdf.format, "pdf");
  assert.equal(pdf.assetType, "schematic_pdf");
  assert.equal(pdf.mimeType, "application/pdf");
});

test("normaliza hash SHA-256 em lowercase", () => {
  const hash = normalizeTechnicalAssetHash("A".repeat(64));
  assert.equal(hash, "a".repeat(64));
  assert.throws(() => normalizeTechnicalAssetHash("1234"), /64 caracteres/);
});

test("planeja deduplicacao sem novo upload quando o hash ja existe", () => {
  const reuse = planTechnicalAssetPersistence({
    existingAssetId: "asset-1",
    boardId: null,
    equipmentModelId: null,
    existingLinkId: null,
  });

  assert.deepEqual(reuse, {
    shouldUploadBinary: false,
    shouldInsertAsset: false,
    shouldInsertLink: false,
  });

  const reuseWithNewLink = planTechnicalAssetPersistence({
    existingAssetId: "asset-1",
    boardId: "board-1",
    equipmentModelId: null,
    existingLinkId: null,
  });

  assert.deepEqual(reuseWithNewLink, {
    shouldUploadBinary: false,
    shouldInsertAsset: false,
    shouldInsertLink: true,
  });
});

test("gera caminho deterministico no storage", () => {
  const hash = "b".repeat(64);
  assert.equal(
    buildTechnicalAssetStoragePath({ hash, format: "pdf" }),
    `pdf/bb/${hash}.pdf`,
  );
});

test("formata metadados visuais do arquivo tecnico", () => {
  assert.equal(getTechnicalAssetDisplayType("brd"), "Boardview BRD");
  assert.equal(formatTechnicalAssetSize(1536), "2 KB");
  assert.equal(formatTechnicalAssetSize(5 * 1024 * 1024), "5.0 MB");
});
