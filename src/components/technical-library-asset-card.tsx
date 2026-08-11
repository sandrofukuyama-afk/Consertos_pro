"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { CatalogOption, EquipmentModelCatalogOption, TechnicalLibraryItem } from "@/types/domain";

type TechnicalLibraryAssetCardProps = {
  item: TechnicalLibraryItem;
  boards: CatalogOption[];
  models: EquipmentModelCatalogOption[];
  manufacturers: CatalogOption[];
};

type ApiPayload = {
  error?: string;
  message?: string;
  warning?: string | null;
};

export function TechnicalLibraryAssetCard({
  item,
  boards,
  models,
  manufacturers,
}: TechnicalLibraryAssetCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(item.title);
  const [manufacturerId, setManufacturerId] = useState(item.manufacturerId ?? "");
  const [manufacturerName, setManufacturerName] = useState(
    item.manufacturerId ? "" : item.manufacturer === "Biblioteca tecnica" ? "" : item.manufacturer,
  );
  const [boardId, setBoardId] = useState(item.boardId ?? "");
  const [equipmentModelId, setEquipmentModelId] = useState(item.equipmentModelId ?? "");
  const [description, setDescription] = useState(item.description ?? "");

  const selectedBoardLabel = useMemo(
    () => boards.find((entry) => entry.id === boardId)?.name ?? null,
    [boardId, boards],
  );
  const selectedModelLabel = useMemo(
    () => models.find((entry) => entry.id === equipmentModelId)?.name ?? null,
    [equipmentModelId, models],
  );

  async function parseResponse(response: Response) {
    const raw = await response.text();
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as ApiPayload;
    } catch {
      return { error: raw.trim() };
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/technical-assets", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetIds: [item.id],
          displayName,
          description,
          manufacturerId: manufacturerId || null,
          manufacturerName: manufacturerName || null,
          boardId: boardId || null,
          equipmentModelId: equipmentModelId || null,
        }),
      });

      const payload = await parseResponse(response);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao atualizar o arquivo tecnico.");
      }

      setFeedback(payload?.message ?? "Arquivo tecnico atualizado.");
      setIsEditing(false);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Falha ao atualizar o arquivo tecnico.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Excluir este arquivo tecnico da biblioteca?\n\nIsso removera o registro da biblioteca e, se nao existir outro registro usando o mesmo hash/caminho, removera tambem o arquivo do Storage. Se houver vinculacao com placa ou modelo, ela sera removida junto com o registro.",
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/technical-assets/${item.id}`, {
        method: "DELETE",
      });

      const payload = await parseResponse(response);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao excluir o arquivo tecnico.");
      }

      setFeedback(payload?.warning ?? payload?.message ?? "Arquivo tecnico removido.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Falha ao excluir o arquivo tecnico.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <article className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--accent-teal)]">
            {item.documentType}
          </p>
          <h4 className="mt-2 text-lg font-semibold tracking-tight text-[var(--foreground)] break-words">
            {item.title}
          </h4>
          {item.originalFileName && item.originalFileName !== item.title ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Arquivo original: {item.originalFileName}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-[var(--muted)]">{item.uploadedAt}</span>
      </div>

      <p className="mt-3 text-sm text-[var(--foreground)]">Fabricante: {item.manufacturer}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">Relação: {item.relation}</p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {item.fileSizeLabel ? (
          <span className="rounded-full bg-[var(--card-surface)] px-3 py-1 text-[var(--foreground)]">
            {item.fileSizeLabel}
          </span>
        ) : null}
        <span
          className={`rounded-full px-3 py-1 ${
            item.associationStatus === "associated"
              ? "bg-[rgba(45,139,130,0.14)] text-[var(--accent-teal)]"
              : "bg-[rgba(202,106,85,0.12)] text-[var(--danger)]"
          }`}
        >
          {item.associationStatus === "associated" ? "Associado" : "Nao associado"}
        </span>
        {item.associationLabel ? (
          <span className="rounded-full bg-[var(--card-surface)] px-3 py-1 text-[var(--foreground)]">
            {item.associationLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        {item.boardviewLabHref ? (
          <a
            href={item.boardviewLabHref}
            className="inline-flex text-sm font-semibold text-[var(--accent-copper)]"
          >
            Abrir no laboratorio
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setIsEditing((current) => !current);
            setError(null);
            setFeedback(null);
          }}
          className="inline-flex text-sm font-semibold text-[var(--accent-copper)]"
        >
          Editar
        </button>
        <a
          href={`/api/technical-assets/${item.id}/content?download=1`}
          className="inline-flex text-sm font-semibold text-[var(--accent-copper)]"
        >
          Download
        </a>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="inline-flex text-sm font-semibold text-[var(--danger)] disabled:opacity-50"
        >
          {isDeleting ? "Deletando..." : "Deletar"}
        </button>
      </div>

      {isEditing ? (
        <div className="mt-4 grid gap-3 rounded-[18px] border border-[var(--panel-border)] bg-black/10 p-4">
          <label className="grid gap-1 text-xs text-[var(--muted)]">
            Nome exibido
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-copper)]"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Fabricante cadastrado
              <select
                value={manufacturerId}
                onChange={(event) => setManufacturerId(event.target.value)}
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-copper)]"
              >
                <option value="">Sem fabricante vinculado</option>
                {manufacturers.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Nome livre do fabricante
              <input
                value={manufacturerName}
                onChange={(event) => setManufacturerName(event.target.value)}
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-copper)]"
                placeholder="Opcional"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Placa
              <select
                value={boardId}
                onChange={(event) => setBoardId(event.target.value)}
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-copper)]"
              >
                <option value="">Nao associada</option>
                {boards.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
              {selectedBoardLabel ? <span>{selectedBoardLabel}</span> : null}
            </label>

            <label className="grid gap-1 text-xs text-[var(--muted)]">
              Modelo
              <select
                value={equipmentModelId}
                onChange={(event) => setEquipmentModelId(event.target.value)}
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-copper)]"
              >
                <option value="">Nao associado</option>
                {models.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
              {selectedModelLabel ? <span>{selectedModelLabel}</span> : null}
            </label>
          </div>

          <label className="grid gap-1 text-xs text-[var(--muted)]">
            Descricao
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-copper)]"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-full bg-[var(--accent-copper)] px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-full border border-[var(--panel-border)] px-3.5 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/5"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {feedback ? <p className="mt-3 text-sm text-[var(--accent-teal)]">{feedback}</p> : null}
      {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
    </article>
  );
}
