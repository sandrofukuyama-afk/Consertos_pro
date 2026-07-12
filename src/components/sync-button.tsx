"use client";

import { useFormStatus } from "react-dom";

export function SyncButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 ${
        pending ? "opacity-60 cursor-not-allowed scale-95" : "hover:brightness-110 hover:shadow-md active:scale-98"
      }`}
    >
      {pending ? (
        <>
          <svg
            className="animate-spin h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            role="status"
            aria-label="Carregando"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Sincronizando...
        </>
      ) : (
        "Sincronizar agora"
      )}
    </button>
  );
}
