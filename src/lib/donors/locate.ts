// Localiza um componente no texto de uma pagina de esquema.
//
// Nos esquemas Compal/Quanta/Wistron o texto extraido traz a referencia numa
// linha e a peca/valor logo depois (ex.: "PQ708" / "AON7506_DFN33-8-5",
// "CD20" / "10U_0603_6.3V6M"). Para outros (MSI, Apple) a peca pode ficar longe
// da referencia: ai so informamos a pagina.

// Referencias tipicas: R, C, L, Q, D, U, F, J, T, Y, X, K com prefixo opcional
// (P = power, Z) e grupo de pagina (RD7, CD20, PQ708, U0500, Q1A).
const REFDES = /^(?:P|Z)?[RCLQDUFJTYXK][A-Z]?\d{1,5}[A-Z]?$/;
const SEARCH_BACK = 3;
const SEARCH_FORWARD = 2;

export type ComponentHit = {
  refdes: string | null;
  part: string;
};

export function normalizePartQuery(query: string) {
  return query
    .toUpperCase()
    .replace(/[^A-Z0-9.%/\- ]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2)
    .slice(0, 5);
}

/** Linhas da pagina que contem todos os termos, com a referencia mais proxima. */
export function locateInPage(content: string, tokens: string[]): ComponentHit[] {
  const lines = content.split("\n").map((line) => line.trim());
  const upper = lines.map((line) => line.toUpperCase());
  const hits = new Map<string, ComponentHit>();

  upper.forEach((line, index) => {
    if (!tokens.length || !line.includes(tokens[0])) return;

    // Valores como "10U 0603 25V" podem vir juntos ("10U_0603_25V6M"): exige
    // todos os termos na mesma linha.
    if (!tokens.every((token) => line.replace(/_/g, " ").includes(token) || line.includes(token))) return;

    let refdes: string | null = null;
    for (let back = 1; back <= SEARCH_BACK && !refdes; back += 1) {
      const candidate = upper[index - back];
      if (candidate && REFDES.test(candidate)) refdes = candidate;
    }
    for (let forward = 1; forward <= SEARCH_FORWARD && !refdes; forward += 1) {
      const candidate = upper[index + forward];
      if (candidate && REFDES.test(candidate)) refdes = candidate;
    }

    const part = lines[index].slice(0, 80);
    const key = `${refdes ?? "?"}|${part}`;
    if (!hits.has(key)) hits.set(key, { refdes, part });
  });

  return [...hits.values()];
}
