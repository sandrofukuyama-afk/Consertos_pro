"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  enqueueOfflineRecord,
  listOfflineRecords,
  removeOfflineRecord,
  type OfflineQueueRecord,
} from "@/lib/offline/queue";

type MeasurementPayload = {
  diagnosticId: string;
  measurementType: string;
  pointLabel: string;
  measuredValueNumeric: string;
  unit: string;
  measuredValueText: string;
  expectedValueText: string;
};

const INITIAL_FORM: MeasurementPayload = {
  diagnosticId: "",
  measurementType: "",
  pointLabel: "",
  measuredValueNumeric: "",
  unit: "",
  measuredValueText: "",
  expectedValueText: "",
};

export function MeasurementForm({ diagnosticId }: { diagnosticId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<MeasurementPayload>({
    ...INITIAL_FORM,
    diagnosticId,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<Array<OfflineQueueRecord<MeasurementPayload>>>([]);

  const loadPendingItems = useCallback(async () => {
    const records = await listOfflineRecords<MeasurementPayload>("measurements");
    setPendingItems(records.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }, []);

  const resetForm = useCallback(() => {
    setForm({
      ...INITIAL_FORM,
      diagnosticId,
    });
  }, [diagnosticId]);

  const syncPendingItems = useCallback(async () => {
    if (!navigator.onLine) {
      return;
    }

    const records = await listOfflineRecords<MeasurementPayload>("measurements");

    if (!records.length) {
      setPendingItems([]);
      return;
    }

    let syncedCount = 0;

    for (const record of records.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const response = await fetch("/api/measurements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(record.payload),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Falha ao sincronizar medição offline.");
      }

      await removeOfflineRecord(record.id);
      syncedCount += 1;
    }

    await loadPendingItems();
    if (syncedCount > 0) {
      setSyncMessage(`${syncedCount} medição(ões) offline sincronizada(s).`);
      setSyncError(null);
      router.refresh();
    }
  }, [loadPendingItems, router]);

  useEffect(() => {
    let cancelled = false;

    listOfflineRecords<MeasurementPayload>("measurements")
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
        setSyncError(error instanceof Error ? error.message : "Falha ao sincronizar fila offline.");
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

    return `${pendingItems.length} medição(ões) aguardando sincronização`;
  }, [pendingItems.length]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSyncMessage(null);
    setSyncError(null);

    try {
      if (!isOnline) {
        await enqueueOfflineRecord("measurements", form);
        await loadPendingItems();
        resetForm();
        setSyncMessage("Sem conexão: a medição foi guardada no aparelho e será enviada quando a internet voltar.");
        return;
      }

      const response = await fetch("/api/measurements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Falha ao registrar medição.");
      }

      resetForm();
      setSyncMessage("Medição registrada com sucesso.");
      router.refresh();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Falha ao registrar medição.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-3">
      {(syncMessage || syncError || pendingSummary) ? (
        <div className="rounded-[20px] border border-[var(--panel-border)] bg-[var(--background)] p-4 text-sm">
          {syncMessage ? <p className="text-[var(--accent-teal)]">{syncMessage}</p> : null}
          {syncError ? <p className="text-[var(--danger)]">{syncError}</p> : null}
          {pendingSummary ? <p className="mt-1 text-[var(--muted)]">{pendingSummary}</p> : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-3">
        <select
          required
          value={form.measurementType}
          onChange={(event) => setForm((current) => ({ ...current, measurementType: event.target.value }))}
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        >
          <option value="" disabled>
            Tipo de medição
          </option>
          <option value="voltage">Tensão</option>
          <option value="current">Corrente</option>
          <option value="resistance">Resistência</option>
          <option value="temperature">Temperatura</option>
          <option value="consumption">Consumo</option>
          <option value="frequency">Frequência</option>
          <option value="continuity">Continuidade</option>
          <option value="other">Outra</option>
        </select>
        <input
          type="text"
          value={form.pointLabel}
          onChange={(event) => setForm((current) => ({ ...current, pointLabel: event.target.value }))}
          placeholder="Ponto medido"
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        />
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="number"
            step="0.0001"
            value={form.measuredValueNumeric}
            onChange={(event) =>
              setForm((current) => ({ ...current, measuredValueNumeric: event.target.value }))
            }
            placeholder="Valor numérico"
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
          />
          <input
            type="text"
            value={form.unit}
            onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
            placeholder="Unidade"
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
          />
        </div>
        <input
          type="text"
          value={form.measuredValueText}
          onChange={(event) => setForm((current) => ({ ...current, measuredValueText: event.target.value }))}
          placeholder="Leitura textual complementar"
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        />
        <input
          type="text"
          value={form.expectedValueText}
          onChange={(event) => setForm((current) => ({ ...current, expectedValueText: event.target.value }))}
          placeholder="Valor esperado"
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? "Salvando..." : isOnline ? "Registrar medição" : "Salvar offline"}
        </button>
      </form>
    </div>
  );
}
