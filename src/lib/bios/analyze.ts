// Analise estatica de dumps de memoria SPI (BIOS/EC) lidos na bancada.
// Nao executa nada: so inspeciona bytes e textos para ajudar o tecnico a saber
// se a leitura e confiavel e o que tem dentro.

export type BiosRegion = {
  name: string;
  start: number;
  end: number;
  sizeLabel: string;
  blank: boolean;
};

export type BiosDumpAnalysis = {
  sizeBytes: number;
  sizeLabel: string;
  chipHint: string | null;
  fillState: "vazio" | "zerado" | "parcial" | "ok";
  fillDetail: string;
  platform: "intel" | "amd" | "desconhecida";
  regions: BiosRegion[];
  meState: "presente" | "ausente_ou_limpo" | "nao_aplica";
  boardVendor: string | null;
  biosVendor: string | null;
  versionStrings: string[];
  warnings: string[];
  summary: string;
};

const SPI_CHIPS: Record<number, string> = {
  [512 * 1024]: "4 Mbit (ex.: W25X40 / MX25L4006E)",
  [1024 * 1024]: "8 Mbit (ex.: W25X80 / MX25L8005)",
  [2 * 1024 * 1024]: "16 Mbit (ex.: W25Q16 / MX25L1606E)",
  [4 * 1024 * 1024]: "32 Mbit (ex.: W25Q32 / MX25L3206E)",
  [8 * 1024 * 1024]: "64 Mbit (ex.: W25Q64 / MX25L6406E)",
  [16 * 1024 * 1024]: "128 Mbit (ex.: W25Q128 / MX25L12835F)",
  [32 * 1024 * 1024]: "256 Mbit (ex.: W25Q256 / MX25L25645G)",
};

const BOARD_VENDORS: Array<[RegExp, string]> = [
  [/Dell Inc|DELL\b/g, "Dell"],
  [/LENOVO/g, "Lenovo"],
  [/Hewlett-Packard|HP Inc\./g, "HP"],
  [/ASUSTeK/g, "Asus"],
  [/\bAcer\b/g, "Acer"],
  [/TOSHIBA/g, "Toshiba"],
  [/FUJITSU/g, "Fujitsu"],
  [/Sony Corporation/g, "Sony"],
  [/Micro-Star|\bMSI\b/g, "MSI"],
  [/GIGABYTE/g, "Gigabyte"],
  [/ASRock/g, "ASRock"],
  [/Apple Inc/g, "Apple"],
];

const BIOS_VENDORS: Array<[RegExp, string]> = [
  [/American Megatrends|AMIBIOS|\$AMIBIOSEXT/g, "AMI"],
  [/Insyde/g, "Insyde"],
  [/Phoenix/g, "Phoenix"],
  [/Award Software/g, "Award"],
];

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1048576).toFixed(bytes % 1048576 ? 1 : 0)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function ratioOf(bytes: Uint8Array, value: number, start = 0, end = bytes.length) {
  if (end <= start) return 0;
  let count = 0;
  // Amostra a cada 16 bytes: rapido e suficiente para detectar areas vazias.
  let samples = 0;
  for (let i = start; i < end; i += 16) {
    samples += 1;
    if (bytes[i] === value) count += 1;
  }
  return count / samples;
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
  );
}

function includesAscii(bytes: Uint8Array, text: string, start = 0, end = bytes.length) {
  const first = text.charCodeAt(0);
  outer: for (let i = start; i <= Math.min(end, bytes.length) - text.length; i += 1) {
    if (bytes[i] !== first) continue;
    for (let j = 1; j < text.length; j += 1) {
      if (bytes[i + j] !== text.charCodeAt(j)) continue outer;
    }
    return true;
  }
  return false;
}

/** Textos ASCII legiveis (>= 6 caracteres), como o comando "strings". */
function extractStrings(bytes: Uint8Array, limit = 40000) {
  const found: string[] = [];
  let current = "";
  for (let i = 0; i < bytes.length && found.length < limit; i += 1) {
    const byte = bytes[i];
    if (byte >= 0x20 && byte < 0x7f) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= 6) found.push(current);
      current = "";
    }
  }
  return found;
}

function topMatch(text: string, table: Array<[RegExp, string]>) {
  let best: string | null = null;
  let bestCount = 0;
  for (const [regex, name] of table) {
    const count = text.match(regex)?.length ?? 0;
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

const REGION_NAMES = ["Descriptor", "BIOS", "ME", "GbE", "PDR"];

/** Le o Intel Flash Descriptor (assinatura 0x0FF0A55A) e lista as regioes. */
function parseIntelDescriptor(bytes: Uint8Array): BiosRegion[] | null {
  const offset = readUint32(bytes, 0x10) === 0x0ff0a55a ? 0x10 : readUint32(bytes, 0) === 0x0ff0a55a ? 0 : -1;
  if (offset < 0) return null;

  const flmap0 = readUint32(bytes, offset + 4);
  const frba = ((flmap0 >>> 16) & 0xff) << 4;
  const regions: BiosRegion[] = [];

  REGION_NAMES.forEach((name, index) => {
    const position = frba + index * 4;
    if (position + 4 > bytes.length) return;
    const reg = readUint32(bytes, position);
    const base = (reg & 0x7fff) << 12;
    const limit = (((reg >>> 16) & 0x7fff) << 12) | 0xfff;
    // O Descriptor ocupa 0x0-0xFFF e seu registro vale 0; nas outras regioes 0 = nao usada.
    if ((reg === 0 && index !== 0) || base > limit || limit >= bytes.length + 0xfff) return;
    const end = Math.min(limit, bytes.length - 1);
    regions.push({
      name,
      start: base,
      end,
      sizeLabel: sizeLabel(end - base + 1),
      blank: ratioOf(bytes, 0xff, base, end + 1) > 0.98,
    });
  });

  return regions;
}

export function analyzeBiosDump(bytes: Uint8Array): BiosDumpAnalysis {
  const size = bytes.length;
  const warnings: string[] = [];
  const chipHint = SPI_CHIPS[size] ?? null;

  if (!chipHint) {
    warnings.push("Tamanho fora do padrão de memórias SPI: pode ser leitura incompleta ou arquivo de atualização (não dump).");
  }

  const ff = ratioOf(bytes, 0xff);
  const zero = ratioOf(bytes, 0x00);
  let fillState: BiosDumpAnalysis["fillState"] = "ok";
  let fillDetail = `${Math.round(ff * 100)}% FF, ${Math.round(zero * 100)}% 00`;
  if (ff > 0.99) {
    fillState = "vazio";
    fillDetail = "Tudo FF: chip apagado ou sem contato na leitura (confira garra/pino 1 e alimentação).";
    warnings.push(fillDetail);
  } else if (zero > 0.99) {
    fillState = "zerado";
    fillDetail = "Tudo 00: leitura falhou (chip não respondeu) ou memória danificada.";
    warnings.push(fillDetail);
  } else if (ff > 0.85) {
    fillState = "parcial";
    warnings.push("Mais de 85% vazio (FF): pode ser BIOS incompleta ou região apagada.");
  }

  const regions = parseIntelDescriptor(bytes) ?? [];
  const isAmd = includesAscii(bytes, "$PSP") || includesAscii(bytes, "AMD PSP");
  const platform: BiosDumpAnalysis["platform"] = regions.length ? "intel" : isAmd ? "amd" : "desconhecida";

  let meState: BiosDumpAnalysis["meState"] = "nao_aplica";
  const me = regions.find((region) => region.name === "ME");
  if (me) {
    const hasFpt = includesAscii(bytes, "$FPT", me.start, me.end + 1);
    meState = hasFpt && !me.blank ? "presente" : "ausente_ou_limpo";
    if (meState === "ausente_ou_limpo") {
      warnings.push("Região ME vazia ou sem cabeçalho $FPT: a placa pode não ligar sem um ME válido.");
    }
  }

  const strings = extractStrings(bytes);
  const allText = strings.join("\n");
  const boardVendor = topMatch(allText, BOARD_VENDORS);
  const biosVendor = topMatch(allText, BIOS_VENDORS);
  const versionStrings = Array.from(
    new Set(
      strings
        .map((text) => /(?:BIOS\s+)?(?:Version|Ver\.?)\s*[:=]?\s*[0-9A-Z][\w.\-]{1,15}|\b\d{2}\/\d{2}\/\d{4}\b/.exec(text)?.[0])
        .filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, 6);

  const parts = [
    `${sizeLabel(size)}${chipHint ? ` (${chipHint})` : ""}`,
    fillState === "ok" ? "conteúdo presente" : fillDetail,
    platform === "intel" ? `Intel com ${regions.map((region) => region.name).join("/")}` : platform === "amd" ? "AMD (PSP)" : null,
    meState === "presente" ? "ME presente" : meState === "ausente_ou_limpo" ? "ME vazio/limpo" : null,
    boardVendor ? `marca: ${boardVendor}` : null,
    biosVendor ? `BIOS ${biosVendor}` : null,
  ].filter(Boolean);

  return {
    sizeBytes: size,
    sizeLabel: sizeLabel(size),
    chipHint,
    fillState,
    fillDetail,
    platform,
    regions,
    meState,
    boardVendor,
    biosVendor,
    versionStrings,
    warnings,
    summary: parts.join(" • "),
  };
}
