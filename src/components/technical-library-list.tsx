"use client";

import { useMemo, useState } from "react";

import { TechnicalLibraryAssetCard } from "@/components/technical-library-asset-card";
import type {
  CatalogOption,
  EquipmentModelCatalogOption,
  TechnicalLibraryItem,
} from "@/types/domain";

type TechnicalLibraryListProps = {
  items: TechnicalLibraryItem[];
  boards: CatalogOption[];
  models: EquipmentModelCatalogOption[];
  manufacturers: CatalogOption[];
};

type LibraryFilter = "all" | "boardview" | "pdf" | "other";

function normalizeSearch(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function matchesQuickFilter(item: TechnicalLibraryItem, filter: LibraryFilter): boolean {
  const normalizedType = normalizeSearch(item.documentType);
  const normalizedFormat = normalizeSearch(item.fileFormat);

  if (filter === "boardview") {
    return (
      normalizedType.includes("boardview") ||
      normalizedFormat === "brd" ||
      normalizedFormat === "bdv"
    );
  }

  if (filter === "pdf") {
    return (
      normalizedType.includes("pdf") ||
      normalizedType.includes("esquema") ||
      normalizedFormat === "pdf"
    );
  }

  if (filter === "other") {
    return !matchesQuickFilter(item, "boardview") && !matchesQuickFilter(item, "pdf");
  }

  return true;
}

function matchesSearch(item: TechnicalLibraryItem, query: string) {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) {
    return true;
  }

  const haystack = normalizeSearch(
    [
      item.title,
      item.originalFileName,
      item.manufacturer,
      item.relation,
      item.associationLabel,
      item.documentType,
      item.fileFormat,
      item.description,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return haystack.includes(normalizedQuery);
}

export function TechnicalLibraryList({
  items,
  boards,
  models,
  manufacturers,
}: TechnicalLibraryListProps) {
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<LibraryFilter>("all");

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) => matchesQuickFilter(item, quickFilter) && matchesSearch(item, query),
      ),
    [items, query, quickFilter],
  );

  return (
    <div className="mt-5 grid gap-3">
      <div className="grid gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por arquivo, placa, modelo, fabricante ou tipo"
          className="w-full rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-copper)]"
        />
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all", label: "Todos" },
            { value: "boardview", label: "Boardview" },
            { value: "pdf", label: "Esquema PDF" },
            { value: "other", label: "Outros" },
          ].map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setQuickFilter(entry.value as LibraryFilter)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                quickFilter === entry.value
                  ? "bg-[var(--accent-copper)] text-white"
                  : "border border-[var(--panel-border)] bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length ? (
        filteredItems.map((item) =>
          item.source === "technical_asset" ? (
            <TechnicalLibraryAssetCard
              key={`${item.source}:${item.id}`}
              item={item}
              boards={boards}
              models={models}
              manufacturers={manufacturers}
            />
          ) : (
            <article
              key={`${item.source}:${item.id}`}
              className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--accent-teal)]">
                    {item.documentType}
                  </p>
                  <h4 className="mt-2 text-lg font-semibold tracking-tight text-[var(--foreground)] break-words">
                    {item.title}
                  </h4>
                </div>
                <span className="shrink-0 text-xs text-[var(--muted)]">{item.uploadedAt}</span>
              </div>
              <p className="mt-3 text-sm text-[var(--foreground)]">
                Fabricante: {item.manufacturer}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">Relacao: {item.relation}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {item.chunksCount !== null ? (
                  <span className="rounded-full bg-[var(--card-surface)] px-3 py-1 text-[var(--foreground)]">
                    {item.chunksCount} chunks
                  </span>
                ) : null}
                {item.isIndexed !== null ? (
                  <span
                    className={`rounded-full px-3 py-1 ${
                      item.isIndexed
                        ? "bg-[rgba(45,139,130,0.14)] text-[var(--accent-teal)]"
                        : "bg-[rgba(202,106,85,0.12)] text-[var(--danger)]"
                    }`}
                  >
                    {item.isIndexed ? "Indexado" : "Indexacao pendente"}
                  </span>
                ) : null}
              </div>
              {item.signedUrl ? (
                <a
                  href={item.signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex text-sm font-semibold text-[var(--accent-copper)]"
                >
                  Abrir documento
                </a>
              ) : null}
            </article>
          ),
        )
      ) : (
        <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          {items.length
            ? "Nenhum arquivo encontrado para esta busca."
            : "Nenhum documento tecnico foi enviado ainda."}
        </div>
      )}
    </div>
  );
}
