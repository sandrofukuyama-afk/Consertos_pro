import test from "node:test";
import assert from "node:assert/strict";

import {
  areTechnicalAssetNamesRelated,
  buildTechnicalAssetAssociationLabel,
  buildTechnicalAssetStoragePath,
  formatTechnicalAssetSize,
  getTechnicalAssetDisplayType,
  getTechnicalAssetFormat,
  isBoardviewFileFormat,
  mapTechnicalAssetType,
  normalizeTechnicalAssetHash,
  planTechnicalAssetPersistence,
  toDbFileFormat,
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

test("identifica nomes relacionados entre boardview e esquema", () => {
  assert.equal(
    areTechnicalAssetNamesRelated(
      "X362 MLB SCHEMATIC 820-00239.brd",
      "X362 MLB SCHEMATIC 820-00239.pdf",
    ),
    true,
  );
  assert.equal(
    areTechnicalAssetNamesRelated("placa-a.brd", "placa-b.pdf"),
    false,
  );
});

test("monta o rotulo visivel da associacao tecnica", () => {
  assert.equal(
    buildTechnicalAssetAssociationLabel({
      boardName: "820-00239",
      equipmentModelName: "MacBook Air A1932",
    }),
    "Placa 820-00239 • Modelo MacBook Air A1932",
  );
  assert.equal(
    buildTechnicalAssetAssociationLabel({
      boardName: null,
      equipmentModelName: null,
    }),
    "Nao associado",
  );
});

test("mapeia .cad (GenCAD) para boardview e detecta o formato pela extensao", () => {
  assert.equal(getTechnicalAssetFormat("placa.cad"), "cad");
  assert.equal(mapTechnicalAssetType("cad"), "boardview");
});

test("converte o formato interno 'cad' para o valor aceito pelo enum do banco", () => {
  assert.equal(toDbFileFormat("cad"), "other");
  assert.equal(toDbFileFormat("brd"), "brd");
  assert.equal(toDbFileFormat("pdf"), "pdf");
});

test("isBoardviewFileFormat reconhece brd/bdv/cad direto e .cad gravado como 'other'", () => {
  assert.equal(isBoardviewFileFormat("brd", "placa.brd"), true);
  assert.equal(isBoardviewFileFormat("bdv", "placa.bdv"), true);
  assert.equal(isBoardviewFileFormat("cad", "placa.cad"), true);
  assert.equal(
    isBoardviewFileFormat("other", "Quanta 0P5 DA0P5DMB8C0 Rev C(BDV)(CAD) .cad"),
    true,
  );
  assert.equal(isBoardviewFileFormat("other", "placa.fz"), false);
  assert.equal(isBoardviewFileFormat("other", undefined), false);
  assert.equal(isBoardviewFileFormat("pdf", "esquema.pdf"), false);
});
