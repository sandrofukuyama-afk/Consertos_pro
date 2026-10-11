import { mkdir } from "node:fs/promises";
import path from "node:path";

import AdmZip from "adm-zip";
import { createExtractorFromFile } from "node-unrar-js";

export const ARCHIVE_EXT = new Set([".zip", ".rar"]);

// Nomes com "../" poderiam escrever fora da pasta temporaria.
function safeName(name) {
  return name.replace(/\\/g, "/").split("/").filter((part) => part && part !== "..").join("/");
}

/** Extrai um .zip ou .rar para destDir. Lanca erro se estiver corrompido ou com senha. */
export async function extractArchive(filePath, destDir) {
  await mkdir(destDir, { recursive: true });
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".zip") {
    const zip = new AdmZip(filePath);
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const target = path.join(destDir, safeName(entry.entryName));
      await mkdir(path.dirname(target), { recursive: true });
      zip.extractEntryTo(entry, path.dirname(target), false, true, false, path.basename(target));
    }
    return;
  }

  const extractor = await createExtractorFromFile({
    filepath: filePath,
    targetPath: destDir,
    filenameTransform: safeName,
  });
  // A extracao so acontece ao percorrer o gerador.
  for (const file of extractor.extract().files) {
    void file;
  }
}
