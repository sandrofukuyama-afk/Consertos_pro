import path from "node:path";

import { BOARD_PATTERNS, BRAND_HINTS, GPU_BRANDS, MODEL_RULES } from "./rules.mjs";

const BOARDVIEW_EXT = new Set([".brd", ".bdv", ".fz", ".cad", ".tvw", ".gr", ".f2b", ".asc"]);
const BIOS_EXT = new Set([".bin", ".rom", ".cap"]);
const IGNORED_NAME = /paypal|keygen|winhex|minipro|boardviewer|\.app[\\/]|__macosx|readme|pkginfo|thumbs\.db|desktop\.ini/i;

const compiledModelRules = MODEL_RULES.map(([pattern, ...rest]) => [new RegExp(pattern), ...rest]);
const compiledBrandHints = BRAND_HINTS.map(([pattern, brand]) => [new RegExp(pattern), brand]);
const compiledGpuBrands = GPU_BRANDS.map(([pattern, brand]) => [new RegExp(pattern), brand]);
const compiledBoardPatterns = BOARD_PATTERNS.map((pattern) => new RegExp(pattern));

function haystackOf(text) {
  return ` ${text.toLowerCase().replace(/_/g, " ").replace(/[\\/]/g, " / ")} `;
}

function isPowerOfTwoSize(size) {
  return size >= 65536 && (size & (size - 1)) === 0;
}

function detectKind(ext, size, hay) {
  if (ext === ".pdf") {
    if (/tc58|datasheet/.test(hay)) return "datasheet";
    if (/board.?vie?w|\bbv[ _]/.test(hay)) return "boardview (PDF)";
    return "esquema";
  }
  if (BOARDVIEW_EXT.has(ext)) return "boardview";
  // BIOS sem extensao ou com a versao no lugar dela (ex.: "H97P4_1.90"):
  // reconhece pelo tamanho exato de memoria flash.
  if (BIOS_EXT.has(ext) || (!BOARDVIEW_EXT.has(ext) && isPowerOfTwoSize(size))) {
    return /\bec\b|ec\.|kb9012|25x10|w25x10|w25x40|mx25x40|u33 ec|uc38|u38/.test(hay) ? "firmware EC" : "BIOS";
  }
  return null;
}

function biosNotes(hay) {
  const notes = [];
  if (/clear ?me|clean ?me|\bclear\b/.test(hay)) notes.push("ME limpo (clear ME)");
  if (/\bold|anterior|backup|\bori\b|original/.test(hay)) notes.push("dump original/backup");
  if (/unlock|unpas/.test(hay)) notes.push("desbloqueio de senha");
  if (/\bok\b/.test(hay)) notes.push("marcado como OK");
  return notes;
}

function detectGpu(hay) {
  const nvidia = /\b(rtx|gtx|gt)\s?-?(\d{3,4})(\s?ti)?\b/.exec(hay);
  if (nvidia) {
    return `GeForce ${nvidia[1].toUpperCase()} ${nvidia[2]}${nvidia[3] ? " Ti" : ""}`;
  }
  const amd = /\b(?:radeon\s)?rx\s?-?(\d{3,4})(\s?xt)?\b/.exec(hay);
  if (amd) {
    return `Radeon RX ${amd[1]}${amd[2] ? " XT" : ""}`;
  }
  return null;
}

function capitalize(text) {
  if (text === "BIOS" || text === "firmware EC") return text === "BIOS" ? "BIOS" : "Firmware EC";
  if (text === "boardview (PDF)") return "Boardview (PDF)";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Classifica um arquivo pela combinacao do caminho relativo (pastas) e do nome.
 * Retorna null para arquivos que nao sao tecnicos (programas, planilhas etc.).
 */
export function classifyFile(relativePath, size) {
  const name = path.basename(relativePath);
  const ext = path.extname(name).toLowerCase();

  if (IGNORED_NAME.test(relativePath) || name.startsWith("._")) {
    return null;
  }

  const hay = haystackOf(relativePath);
  const nameHay = haystackOf(name);
  const kind = detectKind(ext, size, hay);

  if (!kind) {
    return null;
  }

  let manufacturer = "";
  let category = "";
  let model = "";
  let board = "";

  // Ordem: regra pelo nome do arquivo, depois placa de video, depois regra pelo
  // caminho. Assim um esquema de notebook com "GTX 1650" no nome nao vira GPU.
  const ruleByName = compiledModelRules.find(([regex]) => regex.test(nameHay));
  const gpuModel = ruleByName ? null : detectGpu(hay);
  if (gpuModel) {
    category = "Placa de vídeo";
    model = gpuModel;
    manufacturer = compiledGpuBrands.find(([regex]) => regex.test(hay))?.[1] ?? "";
    const gpuBoard = /\bcg\d{3,4}[a-z0-9]*\b|\bpg\d{3}\b|\bms-?v\d{3}\b|\bv\d{3}\b/.exec(hay);
    board = gpuBoard ? gpuBoard[0].toUpperCase().replace(/^MSV/, "MS-V") : "";
  } else {
    const rule = ruleByName ?? compiledModelRules.find(([regex]) => regex.test(hay));
    if (rule) {
      [, manufacturer, category, model, board] = rule.map((value) => value ?? "");
    }
    if (!manufacturer) {
      manufacturer = compiledBrandHints.find(([regex]) => regex.test(hay))?.[1] ?? "";
    }
    if (!board) {
      const match =
        compiledBoardPatterns.map((regex) => regex.exec(nameHay) ?? regex.exec(hay)).find(Boolean) ?? null;
      board = match ? match[0].toUpperCase() : "";
    }
    if (!category) {
      category = /desktop|placa.?m[aã]e|motherboard/.test(hay)
        ? "Desktop"
        : /iphone|smartphone|celular/.test(hay)
          ? "Smartphone"
          : /ipad|tablet/.test(hay)
            ? "Tablet"
            : /\btv\b|televis/.test(hay)
              ? "Televisão"
              : "Notebook";
    }
  }

  const notes = kind === "BIOS" || kind === "firmware EC" ? biosNotes(hay) : [];
  const displayName = [capitalize(kind), manufacturer, model, board].filter(Boolean).join(" ");

  return {
    tipo: kind,
    fabricante: manufacturer,
    categoria: category,
    modelo: model,
    placa: board,
    observacao: notes.join("; "),
    nome_exibicao: displayName || capitalize(kind),
    // Sem fabricante nem modelo/placa: vale pedir ajuda a IA, se configurada.
    incompleto: !manufacturer || (!model && !board),
  };
}
