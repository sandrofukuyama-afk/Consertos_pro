export const TECHNICAL_ASSET_BUCKET = "technical-assets";

export const TECHNICAL_ASSET_SIZE_LIMITS = {
  brd: 100 * 1024 * 1024,
  bdv: 100 * 1024 * 1024,
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
  return extension === "brd" || extension === "bdv" || extension === "pdf"
    ? extension
    : null;
}

export function mapTechnicalAssetType(format) {
  return format === "pdf" ? "schematic_pdf" : "boardview";
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
      "Formato invalido. Use apenas arquivos .brd, .bdv ou .pdf.",
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
    default:
      return "Arquivo tecnico";
  }
}
