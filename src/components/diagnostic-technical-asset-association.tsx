"use client";

import { useMemo, useState } from "react";

import { associateDiagnosticTechnicalAssetsAction } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { areTechnicalAssetNamesRelated } from "@/lib/technical-assets.mjs";
import type {
  CatalogOption,
  DiagnosticDetail,
  EquipmentModelCatalogOption,
} from "@/types/domain";

type SearchResultItem = {
  id: string;
  title: string;
  originalFileName: string;
  fileFormat: string;
  assetType: string;
  createdAt: string;
  boardId: string | null;
  boardName: string | null;
  equipmentModelId: string | null;
  equipmentModelName: string | null;
  manufacturerId: string | null;
  manufacturerName: string | null;
  description: string | null;
};

type SearchResponse = {
  error?: string;
  items?: SearchResultItem[];
};

type DiagnosticTechnicalAssetAssociationProps = {
  diagnosticId: string;
  manufacturerId: string | null;
  currentBoardId: string | null;
  currentModelId: string | null;
  currentAssets: DiagnosticDetail["technicalAssets"];
  boards: CatalogOption[];
  models: EquipmentModelCatalogOption[];
  manufacturers: CatalogOption[];
};

type AssetRole = "boardview" | "schematic";

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function formatAssetTypeLabel(format: string) {
  if (format === "pdf") {
    return "Esquema PDF";
  }

  if (format === "bdv") {
    return "Boardview BDV";
  }

  if (format === "brd") {
    return "Boardview BRD";
  }

  return format.toUpperCase();
}

function formatFileFormatFilter(value: string) {
  if (value === "all") {
    return "Todos";
  }

  if (value === "pdf") {
    return "PDF";
  }

  return value.toUpperCase();
}

export function DiagnosticTechnicalAssetAssociation({
  diagnosticId,
  manufacturerId,
  currentBoardId,
  currentModelId,
  currentAssets,
  boards,
  models,
  manufacturers,
}: DiagnosticTechnicalAssetAssociationProps) {
  const currentBoardviewAsset =
    currentAssets.find((asset) => asset.fileFormat === "brd" || asset.fileFormat === "bdv") ??
    null;
  const currentSchematicAsset =
    currentAssets.find((asset) => asset.fileFormat === "pdf") ?? null;
  const [query, setQuery] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState(currentBoardId ?? "");
  const [selectedModelId, setSelectedModelId] = useState(currentModelId ?? "");
  const [selectedManufacturerId, setSelectedManufacturerId] = useState(manufacturerId ?? "");
  const [selectedFormat, setSelectedFormat] = useState("all");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoardviewAssetId, setSelectedBoardviewAssetId] = useState(
    currentBoardviewAsset?.id ?? "",
  );
  const [selectedSchematicAssetId, setSelectedSchematicAssetId] = useState(
    currentSchematicAsset?.id ?? "",
  );

  const selectedBoardviewAsset = useMemo(
    () =>
      results.find((item) => item.id === selectedBoardviewAssetId) ??
      (currentBoardviewAsset
        ? {
            id: currentBoardviewAsset.id,
            title: currentBoardviewAsset.title,
            originalFileName: currentBoardviewAsset.title,
            fileFormat: currentBoardviewAsset.fileFormat,
            assetType: currentBoardviewAsset.documentType,
            createdAt: currentBoardviewAsset.uploadedAt,
            boardId: currentBoardviewAsset.boardId,
            boardName: currentBoardviewAsset.boardName,
            equipmentModelId: currentBoardviewAsset.equipmentModelId,
            equipmentModelName: currentBoardviewAsset.modelName,
            manufacturerId: selectedManufacturerId || null,
            manufacturerName:
              manufacturers.find((entry) => entry.id === selectedManufacturerId)?.name ?? null,
            description: null,
          }
        : null),
    [
      currentBoardviewAsset,
      manufacturers,
      results,
      selectedBoardviewAssetId,
      selectedManufacturerId,
    ],
  );
  const selectedSchematicAsset = useMemo(
    () =>
      results.find((item) => item.id === selectedSchematicAssetId) ??
      (currentSchematicAsset
        ? {
            id: currentSchematicAsset.id,
            title: currentSchematicAsset.title,
            originalFileName: currentSchematicAsset.title,
            fileFormat: currentSchematicAsset.fileFormat,
            assetType: currentSchematicAsset.documentType,
            createdAt: currentSchematicAsset.uploadedAt,
            boardId: currentSchematicAsset.boardId,
            boardName: currentSchematicAsset.boardName,
            equipmentModelId: currentSchematicAsset.equipmentModelId,
            equipmentModelName: currentSchematicAsset.modelName,
            manufacturerId: selectedManufacturerId || null,
            manufacturerName:
              manufacturers.find((entry) => entry.id === selectedManufacturerId)?.name ?? null,
            description: null,
          }
        : null),
    [
      currentSchematicAsset,
      manufacturers,
      results,
      selectedManufacturerId,
      selectedSchematicAssetId,
    ],
  );

  async function loadResults() {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set("q", query.trim());
      }
      if (selectedBoardId) {
        params.set("board_id", selectedBoardId);
      }
      if (selectedModelId) {
        params.set("equipment_model_id", selectedModelId);
      }
      if (selectedManufacturerId) {
        params.set("manufacturer_id", selectedManufacturerId);
      }
      if (selectedFormat !== "all") {
        params.set("file_format", selectedFormat);
      }
      params.set("limit", "60");

      const response = await fetch(`/api/technical-assets?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as SearchResponse | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Nao foi possivel buscar os arquivos tecnicos.");
      }

      setResults(payload?.items ?? []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel buscar os arquivos tecnicos.",
      );
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }

  const relatedBoardviewCandidate = useMemo(() => {
    if (!selectedSchematicAsset || selectedBoardviewAssetId) {
      return null;
    }

    return (
      results.find(
        (item) =>
          (item.fileFormat === "brd" || item.fileFormat === "bdv") &&
          areTechnicalAssetNamesRelated(item.title, selectedSchematicAsset.title),
      ) ?? null
    );
  }, [results, selectedBoardviewAssetId, selectedSchematicAsset]);

  const relatedSchematicCandidate = useMemo(() => {
    if (!selectedBoardviewAsset || selectedSchematicAssetId) {
      return null;
    }

    return (
      results.find(
        (item) =>
          item.fileFormat === "pdf" &&
          areTechnicalAssetNamesRelated(item.title, selectedBoardviewAsset.title),
      ) ?? null
    );
  }, [results, selectedBoardviewAsset, selectedSchematicAssetId]);

  function applyAssetSelection(item: SearchResultItem, role: AssetRole) {
    if (role === "boardview") {
      setSelectedBoardviewAssetId(item.id);
    } else {
      setSelectedSchematicAssetId(item.id);
    }

    if (!selectedBoardId && item.boardId) {
      setSelectedBoardId(item.boardId);
    }

    if (!selectedModelId && item.equipmentModelId) {
      setSelectedModelId(item.equipmentModelId);
    }

    if (!selectedManufacturerId && item.manufacturerId) {
      setSelectedManufacturerId(item.manufacturerId);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1 text-xs text-[var(--muted)] xl:col-span-2">
          Buscar por nome, placa, modelo ou fabricante
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: 820-00239, A1706, Apple"
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-copper)]"
          />
        </label>

        <label className="grid gap-1 text-xs text-[var(--muted)]">
          Placa
          <select
            value={selectedBoardId}
            onChange={(event) => setSelectedBoardId(event.target.value)}
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-copper)]"
          >
            <option value="">Todas</option>
            {boards.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs text-[var(--muted)]">
          Modelo
          <select
            value={selectedModelId}
            onChange={(event) => setSelectedModelId(event.target.value)}
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-copper)]"
          >
            <option value="">Todos</option>
            {models.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs text-[var(--muted)]">
          Fabricante
          <select
            value={selectedManufacturerId}
            onChange={(event) => setSelectedManufacturerId(event.target.value)}
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-copper)]"
          >
            <option value="">Todos</option>
            {manufacturers.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-[var(--muted)]">
          Tipo
          <select
            value={selectedFormat}
            onChange={(event) => setSelectedFormat(event.target.value)}
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-copper)]"
          >
            {["all", "brd", "bdv", "pdf"].map((entry) => (
              <option key={entry} value={entry}>
                {formatFileFormatFilter(entry)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            void loadResults();
          }}
          className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
        >
          {isLoading ? "Buscando..." : "Buscar arquivos tecnicos"}
        </button>
      </div>

      {error ? (
        <div className="rounded-[18px] border border-[rgba(202,106,85,0.22)] bg-[rgba(202,106,85,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">Boardview escolhido</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {selectedBoardviewAsset
              ? `${selectedBoardviewAsset.title}${selectedBoardviewAsset.boardName ? ` • ${selectedBoardviewAsset.boardName}` : ""}`
              : "Nenhum boardview selecionado ainda."}
          </p>
          {relatedSchematicCandidate ? (
            <button
              type="button"
              onClick={() => applyAssetSelection(relatedSchematicCandidate, "schematic")}
              className="mt-3 inline-flex text-sm font-semibold text-[var(--accent-copper)]"
            >
              Usar tambem o esquema parecido: {relatedSchematicCandidate.title}
            </button>
          ) : null}
        </div>

        <div className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">Esquema escolhido</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {selectedSchematicAsset
              ? `${selectedSchematicAsset.title}${selectedSchematicAsset.equipmentModelName ? ` • ${selectedSchematicAsset.equipmentModelName}` : ""}`
              : "Nenhum esquema selecionado ainda."}
          </p>
          {relatedBoardviewCandidate ? (
            <button
              type="button"
              onClick={() => applyAssetSelection(relatedBoardviewCandidate, "boardview")}
              className="mt-3 inline-flex text-sm font-semibold text-[var(--accent-copper)]"
            >
              Usar tambem o boardview parecido: {relatedBoardviewCandidate.title}
            </button>
          ) : null}
        </div>
      </div>

      <form action={associateDiagnosticTechnicalAssetsAction} className="grid gap-4">
        <input type="hidden" name="diagnostic_id" value={diagnosticId} />
        <input type="hidden" name="board_id" value={selectedBoardId} />
        <input type="hidden" name="equipment_model_id" value={selectedModelId} />
        <input type="hidden" name="manufacturer_id" value={selectedManufacturerId} />
        {selectedBoardviewAssetId ? (
          <input type="hidden" name="asset_ids" value={selectedBoardviewAssetId} />
        ) : null}
        {selectedSchematicAssetId ? (
          <input type="hidden" name="asset_ids" value={selectedSchematicAssetId} />
        ) : null}

        <div className="grid gap-3">
          {results.length ? (
            results.map((item) => {
              const isBoardview = item.fileFormat === "brd" || item.fileFormat === "bdv";
              const isSchematic = item.fileFormat === "pdf";
              const isSelectedBoardview = selectedBoardviewAssetId === item.id;
              const isSelectedSchematic = selectedSchematicAssetId === item.id;
              const searchableMeta = normalizeText(
                [item.title, item.boardName, item.equipmentModelName, item.manufacturerName]
                  .filter(Boolean)
                  .join(" "),
              );
              const isSuggestedByName =
                (selectedBoardviewAsset &&
                  isSchematic &&
                  areTechnicalAssetNamesRelated(item.title, selectedBoardviewAsset.title)) ||
                (selectedSchematicAsset &&
                  isBoardview &&
                  areTechnicalAssetNamesRelated(item.title, selectedSchematicAsset.title));

              return (
                <article
                  key={item.id}
                  className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  data-search={searchableMeta}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--accent-teal)]">
                        {formatAssetTypeLabel(item.fileFormat)}
                      </p>
                      <h4 className="mt-2 break-words text-base font-semibold text-[var(--foreground)]">
                        {item.title}
                      </h4>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {(item.boardName || item.equipmentModelName || item.manufacturerName)
                          ? [item.boardName, item.equipmentModelName, item.manufacturerName]
                              .filter(Boolean)
                              .join(" • ")
                          : "Sem associacao forte ainda"}
                      </p>
                      {item.description ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">{item.description}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isBoardview ? (
                        <button
                          type="button"
                          onClick={() => applyAssetSelection(item, "boardview")}
                          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                            isSelectedBoardview
                              ? "bg-[var(--accent-copper)] text-white"
                              : "border border-[var(--panel-border)] bg-[var(--card-surface)] text-[var(--foreground)]"
                          }`}
                        >
                          {isSelectedBoardview ? "Boardview escolhido" : "Usar como boardview"}
                        </button>
                      ) : null}
                      {isSchematic ? (
                        <button
                          type="button"
                          onClick={() => applyAssetSelection(item, "schematic")}
                          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                            isSelectedSchematic
                              ? "bg-[var(--accent-copper)] text-white"
                              : "border border-[var(--panel-border)] bg-[var(--card-surface)] text-[var(--foreground)]"
                          }`}
                        >
                          {isSelectedSchematic ? "Esquema escolhido" : "Usar como esquema"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {isSuggestedByName ? (
                    <p className="mt-3 text-xs text-[var(--accent-teal)]">
                      Nome parecido com o outro arquivo escolhido.
                    </p>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-8 text-center text-sm text-[var(--muted)]">
              {isLoading
                ? "Buscando arquivos tecnicos..."
                : "Nenhum arquivo tecnico encontrado para os filtros atuais."}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <FormSubmitButton
            idleLabel="Associar ao diagnostico"
            pendingLabel="Salvando associacao..."
            className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          />
        </div>
      </form>
    </div>
  );
}
