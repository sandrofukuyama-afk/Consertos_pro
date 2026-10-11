"use client";

import { useState } from "react";

import { startDiagnosticChatAction } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";

type QuickChatStartProps = {
  categories: Array<{ id: string; name: string }>;
  returnTo: "/" | "/diagnosticos/novo";
};

export function QuickChatStart({ categories, returnTo }: QuickChatStartProps) {
  const [fileNames, setFileNames] = useState<string[]>([]);

  return (
    <section
      id="novo-caso"
      className="scroll-mt-4 rounded-[28px] border border-[rgba(109,94,242,0.35)] bg-[linear-gradient(135deg,rgba(109,94,242,0.14),rgba(45,139,130,0.08))] p-4 shadow-[0_18px_44px_rgba(20,18,28,0.06)] sm:p-6"
    >
      <h3 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
        Novo diagnóstico
      </h3>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        Descreva o aparelho e o defeito como se falasse com um colega, e mande foto da placa se
        tiver. A IA abre o caso e conduz o diagnóstico pelo chat.
      </p>

      <form action={startDiagnosticChatAction} className="mt-4 grid gap-3">
        <input type="hidden" name="return_to" value={returnTo} />
        <textarea
          name="message"
          rows={3}
          placeholder="Ex.: Notebook Fujitsu AH50/G não liga, curto na entrada, MOSFET esquentando e derrubando a fonte."
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm leading-6 outline-none focus:border-[rgba(109,94,242,0.55)]"
        />

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[rgba(109,94,242,0.45)]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {fileNames.length ? `${fileNames.length} foto(s)` : "Foto da placa"}
            <input
              type="file"
              name="photos"
              multiple
              accept="image/*"
              className="sr-only"
              onChange={(event) =>
                setFileNames(Array.from(event.target.files ?? []).map((file) => file.name))
              }
            />
          </label>

          <select
            name="equipment_category_id"
            defaultValue=""
            aria-label="Tipo de aparelho"
            className="rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none"
          >
            <option value="">Tipo de aparelho (opcional)</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <div className="w-full sm:ml-auto sm:w-auto">
            <FormSubmitButton
              idleLabel="Começar diagnóstico"
              pendingLabel="Abrindo o caso e consultando a IA..."
              className="w-full rounded-full bg-[var(--accent-copper)] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>
      </form>
    </section>
  );
}
