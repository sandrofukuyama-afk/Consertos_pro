"use client";

import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  idleLabel: string;
  pendingLabel?: string;
  className?: string;
};

export function FormSubmitButton({
  idleLabel,
  pendingLabel = "Enviando...",
  className = "rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60",
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      <span className="inline-flex items-center gap-2">
        {pending ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 rounded-full border-2 border-white/35 border-t-white animate-spin"
          />
        ) : null}
        <span>{pending ? pendingLabel : idleLabel}</span>
      </span>
    </button>
  );
}
