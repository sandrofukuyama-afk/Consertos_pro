import {
  cancelBenchJobAction,
  requestBiosReadAction,
  requestBiosWriteAction,
} from "@/app/diagnosticos/[id]/bios-actions";
import { BenchJobsAutoRefresh } from "@/components/bench-jobs-auto-refresh";
import { BiosDumpUpload } from "@/components/bios-dump-upload";
import { FormSubmitButton } from "@/components/form-submit-button";
import type { DiagnosticBiosData } from "@/lib/services/bios-dumps";
import { formatRelativeTime } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  original: "Original (antes do reparo)",
  lido: "Lido do chip",
  backup: "Backup antes de gravar",
  gravado: "Gravado",
  verificado: "Lido após gravar",
  enviado: "Enviado",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Na fila",
  claimed: "Agente pegou",
  running: "Em andamento",
  done: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
};

function sizeLabel(bytes: number) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(bytes % 1048576 ? 1 : 0)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function DiagnosticBiosPanel({ diagnosticId, data }: { diagnosticId: string; data: DiagnosticBiosData }) {
  const activeJob = data.jobs.some((job) => ["pending", "claimed", "running"].includes(job.status));
  const writeOptions = [
    ...data.dumps.map((dump) => ({
      value: `dump:${dump.id}`,
      label: `Dump do caso • ${KIND_LABEL[dump.kind] ?? dump.kind} • ${sizeLabel(dump.sizeBytes)} • ${formatRelativeTime(dump.createdAt)}`,
    })),
    ...data.libraryBios.map((bios) => ({
      value: `asset:${bios.id}`,
      label: `Biblioteca • ${bios.name} • ${bios.fileName} • ${sizeLabel(bios.sizeBytes)}`,
    })),
  ];

  return (
    <div className="grid gap-4 text-sm">
      <BenchJobsAutoRefresh active={activeJob} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
          <span
            className={`h-2.5 w-2.5 rounded-full ${data.agentOnline ? "bg-[var(--accent-teal)]" : "bg-[var(--muted)]"}`}
          />
          {data.agentOnline ? `Agente da bancada online (${data.agentOnline.name})` : "Agente da bancada offline"}
        </span>
        <form action={requestBiosReadAction}>
          <input type="hidden" name="diagnostic_id" value={diagnosticId} />
          <FormSubmitButton
            idleLabel="Ler BIOS"
            pendingLabel="Pedindo…"
            className="rounded-full bg-[var(--accent-copper)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          />
        </form>
      </div>
      {!data.agentOnline ? (
        <p className="text-xs text-[var(--muted)]">
          Os pedidos ficam na fila até o agente ligar no PC da bancada. Sem agente, envie o dump lido em outro
          programa pelo botão abaixo.
        </p>
      ) : null}

      {data.jobs.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Pedidos</p>
          <ul className="grid gap-2">
            {data.jobs.map((job) => (
              <li key={job.id} className="rounded-xl border border-[var(--panel-border)] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[var(--foreground)]">
                    {job.kind === "read" ? "Leitura" : "Gravação"} • {STATUS_LABEL[job.status] ?? job.status}
                  </span>
                  {job.status === "pending" ? (
                    <form action={cancelBenchJobAction}>
                      <input type="hidden" name="diagnostic_id" value={diagnosticId} />
                      <input type="hidden" name="job_id" value={job.id} />
                      <button type="submit" className="text-xs text-[var(--danger)] hover:underline">
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">{formatRelativeTime(job.createdAt)}</span>
                  )}
                </div>
                {job.progress && ["claimed", "running"].includes(job.status) ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">{job.progress}</p>
                ) : null}
                {job.error ? <p className="mt-1 text-xs text-[var(--danger)]">{job.error}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Dumps do caso</p>
        {data.dumps.length ? (
          <ul className="grid gap-2">
            {data.dumps.map((dump) => (
              <li key={dump.id} className="rounded-xl border border-[var(--panel-border)] px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--foreground)]">{KIND_LABEL[dump.kind] ?? dump.kind}</p>
                    <p className="text-xs text-[var(--muted)] [overflow-wrap:anywhere]">
                      {dump.fileName} • {sizeLabel(dump.sizeBytes)}
                      {dump.chipName ? ` • ${dump.chipName}` : ""} • {formatRelativeTime(dump.createdAt)}
                    </p>
                  </div>
                  <a
                    href={`/api/bios-dumps/${dump.id}/download`}
                    className="shrink-0 text-xs font-semibold text-[var(--accent-copper)] hover:underline"
                  >
                    Baixar
                  </a>
                </div>
                {dump.summary ? <p className="mt-1 text-xs text-[var(--foreground)]">{dump.summary}</p> : null}
                {dump.libraryMatch ? (
                  <p className="mt-1 text-xs text-[var(--accent-teal)]">Idêntico a: {dump.libraryMatch}</p>
                ) : null}
                {dump.warnings.map((warning) => (
                  <p key={warning} className="mt-1 text-xs text-[var(--danger)]">
                    ⚠ {warning}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--muted)]">Nenhum dump ainda. Leia pelo agente ou envie um arquivo.</p>
        )}
        <div className="mt-3">
          <BiosDumpUpload diagnosticId={diagnosticId} />
        </div>
      </div>

      <form action={requestBiosWriteAction} className="grid gap-2 rounded-xl border border-[rgba(202,106,85,0.3)] p-3">
        <input type="hidden" name="diagnostic_id" value={diagnosticId} />
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--danger)]">Gravar BIOS</p>
        {writeOptions.length ? (
          <>
            <select
              name="source"
              required
              defaultValue=""
              className="rounded-xl border border-[var(--panel-border)] bg-[var(--background)] px-3 py-2 text-xs"
            >
              <option value="" disabled>
                Escolha o arquivo a gravar
              </option>
              {writeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="flex items-start gap-2 text-xs text-[var(--muted)]">
              <input type="checkbox" name="confirm" className="mt-0.5" />
              Confirmo a gravação. O agente lê e guarda um backup do chip antes, grava e depois verifica.
            </label>
            <FormSubmitButton
              idleLabel="Enviar gravação ao agente"
              pendingLabel="Enviando…"
              className="justify-self-start rounded-full border border-[rgba(202,106,85,0.5)] px-4 py-2 text-xs font-semibold text-[var(--danger)] disabled:opacity-60"
            />
          </>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Sem arquivos para gravar: leia/envie um dump ou associe o modelo/placa do caso para listar as BIOS da
            biblioteca.
          </p>
        )}
      </form>
    </div>
  );
}
