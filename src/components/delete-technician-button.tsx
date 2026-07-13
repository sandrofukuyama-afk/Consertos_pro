"use client";

import { useFormStatus } from "react-dom";

import { deleteTechnicianProfileAction } from "@/app/configuracoes/actions";

function DeleteTechnicianSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs font-semibold text-[var(--danger)] transition hover:text-white disabled:opacity-50"
    >
      {pending ? "Excluindo..." : "Excluir"}
    </button>
  );
}

export function DeleteTechnicianButton({ profileId }: { profileId: string }) {
  return (
    <form
      action={deleteTechnicianProfileAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Excluir este perfil de tecnico? Esta acao remove o perfil operacional da lista.",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="profile_id" value={profileId} />
      <DeleteTechnicianSubmitButton />
    </form>
  );
}
