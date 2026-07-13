"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  enqueueOfflineRecord,
  listOfflineRecords,
  removeOfflineRecord,
  type OfflineQueueRecord,
} from "@/lib/offline/queue";

type BoardOption = {
  id: string;
  boardId: string | null;
  boardCode: string | null;
  name: string | null;
};

type BoardMeasurementPayload = {
  diagnosticId: string;
  boardId: string;
  componentRef: string;
  measurementPoint: string;
  expectedValue: string;
  condition: string;
  notes: string;
};

const INITIAL_FORM: BoardMeasurementPayload = {
  diagnosticId: "",
  boardId: "",
  componentRef: "",
  measurementPoint: "",
  expectedValue: "",
  condition: "power_off",
  notes: "",
};

export function BoardMeasurementForm({
  diagnosticId,
  boards,
}: {
  diagnosticId: string;
  boards: BoardOption[];
}) {
  const router = useRouter();
  const defaultBoardId = boards[0]?.boardId ?? "";
  const [form, setForm] = useState<BoardMeasurementPayload>({
    ...INITIAL_FORM,
    diagnosticId,
    boardId: defaultBoardId,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<
    Array<OfflineQueueRecord<BoardMeasurementPayload>>
  >([]);

  const loadPendingItems = useCallback(async () => {
    const records = await listOfflineRecords<BoardMeasurementPayload>("board-measurements");
    setPendingItems(records.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }, []);

  const resetForm = useCallback(() => {
    setForm({
      ...INITIAL_FORM,
      diagnosticId,
      boardId: boards[0]?.boardId ?? "",
    });
  }, [boards, diagnosticId]);

  const syncPendingItems = useCallback(async () => {
    if (!navigator.onLine) {
      return;
    }

    const records = await listOfflineRecords<BoardMeasurementPayload>("board-measurements");

    if (!records.length) {
      setPendingItems([]);
      return;
    }

    let syncedCount = 0;

    for (const record of records.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const response = await fetch("/api/board-measurements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(record.payload),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Falha ao sincronizar medição de referência offline.");
      }

      await removeOfflineRecord(record.id);
      syncedCount += 1;
    }

    await loadPendingItems();
    if (syncedCount > 0) {
      setSyncMessage(`${syncedCount} medição(ões) de referência sincronizada(s).`);
      setSyncError(null);
      router.refresh();
    }
  }, [loadPendingItems, router]);

  useEffect(() => {
    let cancelled = false;

    listOfflineRecords<BoardMeasurementPayload>("board-measurements")
      .then((records) => {
        if (!cancelled) {
          setPendingItems(records.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [loadPendingItems]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      syncPendingItems().catch((error) => {
        setSyncError(
          error instanceof Error ? error.message : "Falha ao sincronizar fila de referência.",
        );
      });
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if (navigator.onLine) {
      onOnline();
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [syncPendingItems]);

  const pendingSummary = useMemo(() => {
    if (!pendingItems.length) {
      return null;
    }

    return `${pendingItems.length} medição(ões) de referência aguardando sincronização`;
  }, [pendingItems.length]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSyncMessage(null);
    setSyncError(null);

    try {
      if (!isOnline) {
        await enqueueOfflineRecord("board-measurements", form);
        await loadPendingItems();
        resetForm();
        setSyncMessage("Sem conexão: a medição de referência foi salva no aparelho e será enviada depois.");
        return;
      }

      const response = await fetch("/api/board-measurements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Falha ao registrar medição de referência.");
      }

      resetForm();
      setSyncMessage("Medição de referência registrada com sucesso.");
      router.refresh();
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "Falha ao registrar medição de referência.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-3">
      {(syncMessage || syncError || pendingSummary) ? (
        <div className="rounded-[20px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 text-sm">
          {syncMessage ? <p className="text-[var(--accent-teal)]">{syncMessage}</p> : null}
          {syncError ? <p className="text-[var(--danger)]">{syncError}</p> : null}
          {pendingSummary ? <p className="mt-1 text-[var(--muted)]">{pendingSummary}</p> : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-3">
        <select
          required
          value={form.boardId}
          onChange={(event) => setForm((current) => ({ ...current, boardId: event.target.value }))}
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-white outline-none"
        >
          {boards.map((board) => (
            <option key={board.id} value={board.boardId ?? ""}>
              Placa: {board.boardCode || board.name || "Principal"}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input
            required
            type="text"
            value={form.componentRef}
            onChange={(event) => setForm((current) => ({ ...current, componentRef: event.target.value }))}
            placeholder="Ex.: PL401, C2800"
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-white outline-none"
          />
          <input
            required
            type="text"
            value={form.measurementPoint}
            onChange={(event) =>
              setForm((current) => ({ ...current, measurementPoint: event.target.value }))
            }
            placeholder="Ex.: pino 1, saída"
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-white outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            required
            type="text"
            value={form.expectedValue}
            onChange={(event) =>
              setForm((current) => ({ ...current, expectedValue: event.target.value }))
            }
            placeholder="Ex.: 3,3 V, 450 R"
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-white outline-none"
          />
          <select
            value={form.condition}
            onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value }))}
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-white outline-none"
          >
            <option value="power_off">Sem alimentação</option>
            <option value="power_on">Placa ligada</option>
            <option value="diode_mode">Escala de diodo</option>
          </select>
        </div>
        <textarea
          rows={2}
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Observações adicionais da medição (opcional)"
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-white outline-none"
        />
        <button
          type="submit"
          disabled={isSubmitting || !boards.length || !form.boardId}
          className="w-full rounded-full bg-[var(--accent-teal)] px-5 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
        >
          {isSubmitting ? "Salvando..." : isOnline ? "Registrar na base" : "Salvar offline"}
        </button>
      </form>
    </div>
  );
}
