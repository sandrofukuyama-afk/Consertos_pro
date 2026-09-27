import { startDiagnosticChatAction } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";

type QuickChatStartProps = {
  categories: Array<{ id: string; name: string }>;
  returnTo: "/" | "/diagnosticos/novo";
};

export function QuickChatStart({ categories, returnTo }: QuickChatStartProps) {
  return (
    <section className="rounded-[28px] border border-[rgba(45,139,130,0.22)] bg-[rgba(45,139,130,0.08)] p-4 shadow-[0_18px_44px_rgba(20,18,28,0.06)] sm:p-6">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--accent-teal)]">
        Começar pelo chat
      </p>
      <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
        Converse com a IA sem preencher o cadastro
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        Descreva o defeito ou anexe uma foto da placa. Um caso é aberto automaticamente com essa
        conversa, e os dados do equipamento podem ser completados depois.
      </p>

      <form
        action={startDiagnosticChatAction}
        encType="multipart/form-data"
        className="mt-4 grid gap-3"
      >
        <input type="hidden" name="return_to" value={returnTo} />
        <textarea
          name="message"
          rows={3}
          placeholder="Ex.: MacBook A2338 não liga; entrada com 20V; PP3V3_G3H em 0V; sem consumo ao pressionar power."
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            name="equipment_category_id"
            defaultValue=""
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
          >
            <option value="">Categoria (opcional)</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            type="file"
            name="photos"
            multiple
            accept="image/*"
            className="text-sm text-[var(--muted)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--panel-border)] file:px-4 file:py-2 file:text-sm file:font-semibold"
          />
        </div>
        <div>
          <FormSubmitButton
            idleLabel="Iniciar chat"
            pendingLabel="Abrindo caso e consultando a IA..."
            className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </form>
    </section>
  );
}
