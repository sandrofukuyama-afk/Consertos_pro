"use client";

import { useFormStatus } from "react-dom";

import { archiveDiagnosticFromQueueAction } from "@/app/actions";

function DeleteDiagnosticSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-[rgba(202,106,85,0.24)] bg-[rgba(202,106,85,0.08)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)] transition hover:bg-[rgba(202,106,85,0.14)] disabled:opacity-50"
    >
      {pending ? "Excluindo..." : "Excluir"}
    </button>
  );
}

export function DeleteDiagnosticButton({
  diagnosticId,
  equipmentLabel,
}: {
  diagnosticId: string;
  equipmentLabel: string;
}) {
  return (
    <form
      action={archiveDiagnosticFromQueueAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Excluir o equipamento "${equipmentLabel}" da Fila ativa?\n\nO diagnostico sera arquivado e pode perder o vinculo com placa, modelo e historico operacional da fila. Os arquivos tecnicos da biblioteca nao serao excluidos.`,
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="diagnostic_id" value={diagnosticId} />
      <input type="hidden" name="equipment_label" value={equipmentLabel} />
      <DeleteDiagnosticSubmitButton />
    </form>
  );
}
