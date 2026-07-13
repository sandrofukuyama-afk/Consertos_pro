"use client";

import { useTransition } from "react";

import { deleteTechnicianProfileAction } from "@/app/configuracoes/actions";

export function DeleteTechnicianButton({ profileId }: { profileId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const confirmed = window.confirm(
          "Excluir este perfil de tecnico? Esta acao remove o perfil operacional da lista.",
        );

        if (!confirmed) {
          return;
        }

        startTransition(async () => {
          const formData = new FormData();
          formData.set("profile_id", profileId);
          await deleteTechnicianProfileAction(formData);
        });
      }}
      className="text-xs font-semibold text-[var(--danger)] transition hover:text-white disabled:opacity-50"
    >
      {isPending ? "Excluindo..." : "Excluir"}
    </button>
  );
}
