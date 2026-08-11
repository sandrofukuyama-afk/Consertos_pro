import type { BoardviewLabSelection } from "@/lib/boardview/lab";

export type SchematicPdfPageText = {
  pageNumber: number;
  text: string;
};

export type SchematicPdfSearchMatch = {
  pageNumber: number;
  occurrences: number;
  excerpt: string;
};

export function normalizeSchematicSearchQuery(query: string) {
  return query.trim().toUpperCase();
}

export function getBoardviewSelectionSchematicQuery(
  selection: BoardviewLabSelection | null,
) {
  if (!selection) {
    return null;
  }

  switch (selection.kind) {
    case "component":
      return selection.component.ref;
    case "padPin":
      return selection.component?.ref ?? selection.padPin.partRef;
    case "net":
      return selection.net.name;
    case "testPoint":
      return selection.net?.name ?? selection.testPoint.netName;
  }
}

function buildExcerpt(text: string, index: number, query: string) {
  const start = Math.max(0, index - 72);
  const end = Math.min(text.length, index + query.length + 108);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function findSchematicPdfMatches(
  pages: SchematicPdfPageText[],
  query: string,
) {
  const normalizedQuery = normalizeSchematicSearchQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  const matches: SchematicPdfSearchMatch[] = [];

  for (const page of pages) {
    const upperText = page.text.toUpperCase();
    let index = upperText.indexOf(normalizedQuery);
    let occurrences = 0;
    let excerpt = "";

    while (index !== -1) {
      occurrences += 1;

      if (!excerpt) {
        excerpt = buildExcerpt(page.text, index, normalizedQuery);
      }

      index = upperText.indexOf(normalizedQuery, index + normalizedQuery.length);
    }

    if (occurrences > 0) {
      matches.push({
        pageNumber: page.pageNumber,
        occurrences,
        excerpt,
      });
    }
  }

  return matches;
}
