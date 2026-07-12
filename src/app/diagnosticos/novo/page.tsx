import Link from "next/link";

import { createDiagnosticAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/auth";
import { getDiagnosticCatalog } from "@/lib/services/catalog";

type NewDiagnosticPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewDiagnosticPage({
  searchParams,
}: NewDiagnosticPageProps) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const { categories, manufacturers } = await getDiagnosticCatalog();

  return (
    <AppShell
      title="Novo diagnóstico"
      description="Abra um novo caso informando categoria, aparelho e o problema inicial."
      user={user}
      actionLabel="Voltar para dashboard"
      actionHref="/"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_360px]">
        <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6 shadow-[0_18px_44px_rgba(72,62,49,0.06)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Abertura de caso
          </p>
          <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Registrar o contexto inicial da bancada
          </h3>

          {params.error ? (
            <div className="mt-5 rounded-2xl border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
              {params.error}
            </div>
          ) : null}

          <form action={createDiagnosticAction} className="mt-6 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                <span className="font-medium">Categoria</span>
                <select
                  required
                  name="equipment_category_id"
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                <span className="font-medium">Fabricante</span>
                <select
                  name="manufacturer_id"
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  defaultValue=""
                >
                  <option value="">Não identificado ainda</option>
                  {manufacturers.map((manufacturer) => (
                    <option key={manufacturer.id} value={manufacturer.id}>
                      {manufacturer.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              <span className="font-medium">Etiqueta ou apelido do equipamento</span>
              <input
                type="text"
                name="equipment_label"
                placeholder="Ex.: Notebook bancada 3"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
              />
            </label>

            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              <span className="font-medium">Relato inicial</span>
              <textarea
                required
                name="initial_problem_report"
                rows={5}
                placeholder="Descreva sintomas, comportamento observado e contexto de entrada."
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
              />
            </label>

            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              <span className="font-medium">Condição física observada</span>
              <textarea
                name="physical_condition_notes"
                rows={4}
                placeholder="Oxidação, marcas de aquecimento, sinais de reparo anterior, etc."
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
                Criar diagnóstico
              </button>
              <Link
                href="/"
                className="rounded-full border border-[var(--panel-border)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </section>

        <aside className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-white">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
            Responsável atual
          </p>
          <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
            {user.fullName}
          </h3>
          <p className="mt-3 text-sm leading-6 text-[rgba(255,245,236,0.78)]">
            O caso sera criado com seu usuario e depois voce podera adicionar sintomas, testes, medicoes e anexos.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
