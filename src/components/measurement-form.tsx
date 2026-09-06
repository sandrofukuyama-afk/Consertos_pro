"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  enqueueOfflineRecord,
  listOfflineRecords,
  removeOfflineRecord,
  type OfflineQueueRecord,
} from "@/lib/offline/queue";

type MeasurementTestOption = {
  id: string;
  testName: string;
  stepOrder: number;
  expectedResult: string;
};

type MeasurementBoardOption = {
  id: string;
  roleLabel: string;
  boardCode: string | null;
  name: string | null;
};

type MeasurementPayload = {
  diagnosticId: string;
  diagnosticTestRunId: string;
  diagnosticBoardId: string;
  measurementType: string;
  pointLabel: string;
  measuredValueNumeric: string;
  unit: string;
  measuredValueText: string;
  expectedValueText: string;
  toleranceText: string;
  measurementContext: string;
  isOutOfRange: boolean;
};

const INITIAL_FORM: MeasurementPayload = {
  diagnosticId: "",
  diagnosticTestRunId: "",
  diagnosticBoardId: "",
  measurementType: "",
  pointLabel: "",
  measuredValueNumeric: "",
  unit: "",
  measuredValueText: "",
  expectedValueText: "",
  toleranceText: "",
  measurementContext: "",
  isOutOfRange: false,
};

function buildBoardLabel(board: MeasurementBoardOption) {
  return board.name ?? board.boardCode ?? board.roleLabel;
}

export function MeasurementForm({
  diagnosticId,
  tests = [],
  boards = [],
  suggestedTestId,
  activeScenarioTitle,
  initialPointLabel,
  initialExpectedValueText,
  initialMeasurementType,
}: {
  diagnosticId: string;
  tests?: MeasurementTestOption[];
  boards?: MeasurementBoardOption[];
  suggestedTestId?: string;
  activeScenarioTitle?: string;
  initialPointLabel?: string;
  initialExpectedValueText?: string;
  initialMeasurementType?: string;
}) {
  const router = useRouter();
  const defaultTestId = suggestedTestId || tests[0]?.id || "";
  const defaultBoardId = boards[0]?.id || "";

  const [form, setForm] = useState<MeasurementPayload>({
    ...INITIAL_FORM,
    diagnosticId,
    diagnosticTestRunId: defaultTestId,
    diagnosticBoardId: defaultBoardId,
    pointLabel: initialPointLabel ?? "",
    expectedValueText: initialExpectedValueText ?? "",
    measurementType: initialMeasurementType ?? "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<Array<OfflineQueueRecord<MeasurementPayload>>>([]);

  const selectedTest = useMemo(
    () => tests.find((item) => item.id === form.diagnosticTestRunId) ?? null,
    [form.diagnosticTestRunId, tests],
  );

  const loadPendingItems = useCallback(async () => {
    const records = await listOfflineRecords<MeasurementPayload>("measurements");
    setPendingItems(records.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }, []);

  const resetForm = useCallback(() => {
    setForm({
      ...INITIAL_FORM,
      diagnosticId,
      diagnosticTestRunId: suggestedTestId || tests[0]?.id || "",
      diagnosticBoardId: boards[0]?.id || "",
      pointLabel: initialPointLabel ?? "",
      measurementType: initialMeasurementType ?? "",
      expectedValueText:
        suggestedTestId || tests[0]?.id
          ? (tests.find((item) => item.id === (suggestedTestId || tests[0]?.id))?.expectedResult ??
            initialExpectedValueText ??
            "")
          : (initialExpectedValueText ?? ""),
    });
  }, [
    boards,
    diagnosticId,
    initialExpectedValueText,
    initialMeasurementType,
    initialPointLabel,
    suggestedTestId,
    tests,
  ]);

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
        throw new Error(payload?.error ?? "Falha ao sincronizar medicao offline.");
      }

      await removeOfflineRecord(record.id);
      syncedCount += 1;
    }

    await loadPendingItems();
    if (syncedCount > 0) {
      setSyncMessage(`${syncedCount} medicao(oes) offline sincronizada(s).`);
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

    return `${pendingItems.length} medicao(oes) aguardando sincronizacao`;
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
        setSyncMessage("Sem conexao: a medicao foi guardada no aparelho e sera enviada quando a internet voltar.");
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
        throw new Error(payload?.error ?? "Falha ao registrar medicao.");
      }

      resetForm();
      setSyncMessage("Medicao registrada com sucesso.");
      router.refresh();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Falha ao registrar medicao.");
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

      <div className="rounded-[20px] border border-[rgba(45,139,130,0.18)] bg-[rgba(45,139,130,0.08)] p-4 text-sm">
        <p className="font-semibold text-[var(--foreground)]">Registro rapido da bancada</p>
        <p className="mt-1 text-[var(--muted)]">
          Vincule a medicao ao teste executado e ao ponto da placa para a IA interpretar melhor o defeito.
        </p>
        {activeScenarioTitle ? (
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--accent-teal)]">
            Cenario ativo: {activeScenarioTitle}
          </p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3">
        <div className="grid gap-3 lg:grid-cols-2">
          <select
            value={form.diagnosticTestRunId}
            onChange={(event) => {
              const nextTestId = event.target.value;
              const nextTest = tests.find((item) => item.id === nextTestId);
              setForm((current) => ({
                ...current,
                diagnosticTestRunId: nextTestId,
                expectedValueText:
                  current.expectedValueText || !nextTest?.expectedResult
                    ? current.expectedValueText
                    : nextTest.expectedResult === "Sem resultado esperado definido."
                      ? current.expectedValueText
                      : nextTest.expectedResult,
              }));
            }}
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
          >
            <option value="">Sem vincular a um teste especifico</option>
            {tests.map((item) => (
              <option key={item.id} value={item.id}>
                Etapa {item.stepOrder} - {item.testName}
              </option>
            ))}
          </select>

          <select
            value={form.diagnosticBoardId}
            onChange={(event) =>
              setForm((current) => ({ ...current, diagnosticBoardId: event.target.value }))
            }
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
          >
            <option value="">Placa nao informada</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {buildBoardLabel(board)}
              </option>
            ))}
          </select>
        </div>

        {selectedTest ? (
          <div className="rounded-[20px] border border-[var(--panel-border)] bg-[var(--card-surface-soft)] p-4 text-sm">
            <p className="font-semibold text-[var(--foreground)]">
              Teste vinculado: Etapa {selectedTest.stepOrder} - {selectedTest.testName}
            </p>
            <p className="mt-1 text-[var(--muted)]">
              Esperado neste teste: {selectedTest.expectedResult}
            </p>
          </div>
        ) : null}

        <select
          required
          value={form.measurementType}
          onChange={(event) => setForm((current) => ({ ...current, measurementType: event.target.value }))}
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        >
          <option value="" disabled>
            Tipo de medicao
          </option>
          <option value="voltage">Tensao</option>
          <option value="current">Corrente</option>
          <option value="resistance">Resistencia</option>
          <option value="temperature">Temperatura</option>
          <option value="consumption">Consumo</option>
          <option value="frequency">Frequencia</option>
          <option value="continuity">Continuidade</option>
          <option value="other">Outra</option>
        </select>

        <input
          type="text"
          value={form.pointLabel}
          onChange={(event) => setForm((current) => ({ ...current, pointLabel: event.target.value }))}
          placeholder="Ponto medido. Ex.: PL401, 3V_ALW, gate do MOSFET"
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
            placeholder="Valor numerico"
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
          />
          <input
            type="text"
            value={form.unit}
            onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
            placeholder="Unidade. Ex.: V, A, Ohm"
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
          />
        </div>

        <input
          type="text"
          value={form.measuredValueText}
          onChange={(event) =>
            setForm((current) => ({ ...current, measuredValueText: event.target.value }))
          }
          placeholder="Leitura textual. Ex.: sem 3.3V, pulando consumo, linha zerada"
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        />

        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            value={form.expectedValueText}
            onChange={(event) =>
              setForm((current) => ({ ...current, expectedValueText: event.target.value }))
            }
            placeholder="Valor esperado"
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
          />
          <input
            type="text"
            value={form.toleranceText}
            onChange={(event) =>
              setForm((current) => ({ ...current, toleranceText: event.target.value }))
            }
            placeholder="Tolerancia. Ex.: +/-5%, 0.1V"
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
          />
        </div>

        <textarea
          rows={3}
          value={form.measurementContext}
          onChange={(event) =>
            setForm((current) => ({ ...current, measurementContext: event.target.value }))
          }
          placeholder="Contexto da medicao. Ex.: fonte assimetrica 19V, bateria desconectada, apos pressionar power"
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        />

        <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={form.isOutOfRange}
            onChange={(event) =>
              setForm((current) => ({ ...current, isOutOfRange: event.target.checked }))
            }
          />
          Marcar como fora da faixa esperada
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? "Salvando..." : isOnline ? "Registrar medicao" : "Salvar offline"}
        </button>
      </form>
    </div>
  );
}
