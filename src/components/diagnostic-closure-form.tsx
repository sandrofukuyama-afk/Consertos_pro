import { closeDiagnosticAction } from "@/app/actions";

type DiagnosticClosureFormProps = {
  diagnosticId: string;
};

export function DiagnosticClosureForm({
  diagnosticId,
}: DiagnosticClosureFormProps) {
  return (
    <form action={closeDiagnosticAction} className="mt-5 grid gap-3">
      <input type="hidden" name="diagnostic_id" value={diagnosticId} />
      <select
        required
        name="case_status"
        defaultValue=""
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      >
        <option value="" disabled>
          Estado final do caso
        </option>
        <option value="confirmed">Confirmado</option>
        <option value="probable">Provável</option>
        <option value="unresolved">Não resolvido</option>
      </select>
      <textarea
        required
        name="resolution_summary"
        rows={3}
        placeholder="Resumo técnico do encerramento"
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      />
      <textarea
        required
        name="repair_outcome"
        rows={3}
        placeholder="Resultado final do reparo"
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      />
      <input
        type="text"
        name="final_failure_mode"
        placeholder="Modo de falha final"
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      />
      <select
        name="cause_type"
        defaultValue=""
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      >
        <option value="">Tipo de causa</option>
        <option value="component_failure">Falha de componente</option>
        <option value="short_circuit">Curto circuito</option>
        <option value="bad_solder">Solda ruim</option>
        <option value="firmware_corruption">Firmware corrompido</option>
        <option value="line_missing">Linha ausente</option>
        <option value="liquid_damage">Dano por líquido</option>
        <option value="thermal_failure">Falha térmica</option>
        <option value="other">Outra</option>
      </select>
      <input
        type="text"
        name="cause_title"
        placeholder="Título da causa"
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      />
      <textarea
        name="technical_explanation"
        rows={3}
        placeholder="Explicação técnica da causa"
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      />
      <select
        name="solution_type"
        defaultValue=""
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      >
        <option value="">Tipo de solução</option>
        <option value="component_replacement">Troca de componente</option>
        <option value="rework">Retrabalho</option>
        <option value="firmware_flash">Regravação</option>
        <option value="jumper">Jumper</option>
        <option value="cleaning">Limpeza</option>
        <option value="reballing">Reballing</option>
        <option value="configuration_change">Ajuste de configuração</option>
        <option value="other">Outra</option>
      </select>
      <input
        type="text"
        name="solution_title"
        placeholder="Título da solução"
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      />
      <textarea
        name="procedure_description"
        rows={3}
        placeholder="Procedimento aplicado"
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      />
      <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
        Encerrar diagnóstico
      </button>
    </form>
  );
}
