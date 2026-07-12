"use client";

import { useTransition } from "react";

import { signOutAction } from "@/app/actions";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(async () => signOutAction())}
      className="rounded-full border border-[var(--panel-border)] bg-[var(--card-surface-soft)] px-4 py-3 text-sm font-medium text-[var(--foreground)]"
      disabled={isPending}
    >
      {isPending ? "Saindo..." : "Sair"}
    </button>
  );
}
