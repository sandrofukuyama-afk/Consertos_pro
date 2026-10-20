"use client";

/** Abre a impressão do navegador; no iPhone, "Compartilhar" na tela de impressão gera o PDF. */
export function PrintReportButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-orange-700"
    >
      {label}
    </button>
  );
}
