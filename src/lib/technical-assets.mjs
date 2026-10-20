export const TECHNICAL_ASSET_BUCKET = "technical-assets";

export const TECHNICAL_ASSET_SIZE_LIMITS = {
  brd: 100 * 1024 * 1024,
  bdv: 100 * 1024 * 1024,
  cad: 100 * 1024 * 1024,
  pdf: 200 * 1024 * 1024,
};

export class TechnicalAssetValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TechnicalAssetValidationError";
  }
}

export function getTechnicalAssetFormat(fileName) {
  const normalized = String(fileName ?? "").trim().toLowerCase();
  if (!normalized.includes(".")) {
    return null;
  }

  const extension = normalized.split(".").pop();
  return extension === "brd" || extension === "bdv" || extension === "cad" || extension === "pdf"
    ? extension
    : null;
}

export function mapTechnicalAssetType(format) {
  return format === "pdf" ? "schematic_pdf" : "boardview";
}

/**
 * Maps the internal format token to a value the `technical_asset_file_format`
 * Postgres enum actually accepts. "cad" (GenCAD) is parsed natively by the
 * boardview lab, but the enum only knows about brd/bdv/pdf/bin/zip/jpg/png/other
 * -- add a 'cad' migration before changing this.
 */
export function toDbFileFormat(format) {
  return format === "cad" ? "other" : format;
}

/**
 * True when a technical asset is a boardview the lab/IA can actually open.
 * GenCAD (.cad) is saved with file_format "other" because the DB enum has no
 * 'cad' value yet (see pendencia 8 no CLAUDE.md), so it's recognized by the
 * original filename instead. Used by every place that decides "is this
 * asset a boardview": the diagnostic case screen, the association screen,
 * and the AI agent's tool layer -- keep them all pointed at this function
 * instead of re-deriving the brd/bdv/cad check locally (it has drifted out
 * of sync between those three places before).
 */
export function isBoardviewFileFormat(fileFormat, fileName) {
  if (fileFormat === "brd" || fileFormat === "bdv" || fileFormat === "cad") {
    return true;
  }

  // .cad (GenCAD) e .asc (Tebo-ICT, conjunto de 5 arquivos) ficam gravados como 'other'.
  const name = String(fileName ?? "").trim().toLowerCase();
  return fileFormat === "other" && (name.endsWith(".cad") || name.endsWith(".asc"));
}

export function getTechnicalAssetMimeType(format, providedMimeType = "") {
  const normalizedMimeType = String(providedMimeType ?? "").trim();
  if (normalizedMimeType) {
    return normalizedMimeType;
  }

  return format === "pdf" ? "application/pdf" : "application/octet-stream";
}

export function getTechnicalAssetParserStatus(format) {
  return format === "pdf" ? "not_applicable" : "pending";
}

export function getTechnicalAssetExtractedTextStatus(format) {
  return format === "pdf" ? "pending" : "not_applicable";
}

export function validateTechnicalAssetFile(fileLike) {
  const format = getTechnicalAssetFormat(fileLike?.name);

  if (!format) {
    throw new TechnicalAssetValidationError(
      "Formato invalido. Use apenas arquivos .brd, .bdv, .cad ou .pdf.",
    );
  }

  const maxSizeBytes = TECHNICAL_ASSET_SIZE_LIMITS[format];
  const fileSizeBytes = Number(fileLike?.size ?? 0);

  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new TechnicalAssetValidationError(
      "Arquivo invalido. Envie um arquivo tecnico com tamanho maior que zero.",
    );
  }

  if (fileSizeBytes > maxSizeBytes) {
    const limitLabel = format === "pdf" ? "200 MB" : "100 MB";
    throw new TechnicalAssetValidationError(
      `Arquivo grande demais para ${format.toUpperCase()}. O limite e ${limitLabel}.`,
    );
  }

  return {
    format,
    assetType: mapTechnicalAssetType(format),
    fileSizeBytes,
    maxSizeBytes,
    mimeType: getTechnicalAssetMimeType(format, fileLike?.type),
    parserStatus: getTechnicalAssetParserStatus(format),
    extractedTextStatus: getTechnicalAssetExtractedTextStatus(format),
  };
}

export function normalizeTechnicalAssetHash(hash) {
  const normalized = String(hash ?? "").trim().toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new TechnicalAssetValidationError(
      "Hash SHA-256 invalido. Use uma string hexadecimal com 64 caracteres.",
    );
  }

  return normalized;
}

export function buildTechnicalAssetStoragePath({
  hash,
  format,
}) {
  const normalizedHash = normalizeTechnicalAssetHash(hash);
  const normalizedFormat = getTechnicalAssetFormat(`file.${format}`);

  if (!normalizedFormat) {
    throw new TechnicalAssetValidationError(
      "Formato invalido para gerar o caminho do storage.",
    );
  }

  return `${normalizedFormat}/${normalizedHash.slice(0, 2)}/${normalizedHash}.${normalizedFormat}`;
}

export function planTechnicalAssetPersistence({
  existingAssetId,
  boardId,
  equipmentModelId,
  existingLinkId,
}) {
  const hasAssociationRequest = Boolean(boardId || equipmentModelId);
  const hasExistingAsset = Boolean(existingAssetId);
  const hasExistingLink = Boolean(existingLinkId);

  return {
    shouldUploadBinary: !hasExistingAsset,
    shouldInsertAsset: !hasExistingAsset,
    shouldInsertLink: hasAssociationRequest && !hasExistingLink,
  };
}

export function formatTechnicalAssetSize(fileSizeBytes) {
  const bytes = Number(fileSizeBytes ?? 0);

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function getTechnicalAssetDisplayType(format) {
  switch (format) {
    case "pdf":
      return "Esquema PDF";
    case "bdv":
      return "Boardview BDV";
    case "brd":
      return "Boardview BRD";
    case "cad":
      return "Boardview CAD (GenCAD)";
    default:
      return "Arquivo tecnico";
  }
}

export function normalizeTechnicalAssetSearch(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildTechnicalAssetAssociationLabel(association) {
  const parts = [
    association?.boardName ? `Placa ${association.boardName}` : null,
    association?.equipmentModelName ? `Modelo ${association.equipmentModelName}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" • ") : "Nao associado";
}

export function areTechnicalAssetNamesRelated(leftName, rightName) {
  const left = normalizeTechnicalAssetSearch(leftName)
    .replace(/\b(brd|bdv|pdf|boardview|schematic|esquema)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const right = normalizeTechnicalAssetSearch(rightName)
    .replace(/\b(brd|bdv|pdf|boardview|schematic|esquema)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!left || !right) {
    return false;
  }

  return left === right || left.includes(right) || right.includes(left);
}
