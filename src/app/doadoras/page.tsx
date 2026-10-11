import Link from "next/link";

import { deleteDonorBoardAction, updateDonorBoardCodeAction } from "@/app/doadoras/actions";
import { AppShell } from "@/components/app-shell";
import { DonorCreateForm } from "@/components/donor-create-form";
import { FormSubmitButton } from "@/components/form-submit-button";
import { requireCurrentUser } from "@/lib/auth";
import { searchDonorComponents } from "@/lib/services/donor-boards";
import { createClient } from "@/lib/supabase/server";

// Cadastrar = ler a foto com a IA + indexar o esquema (PDFs grandes levam tempo).
export const maxDuration = 300;

const STATUS: Record<string, string> = {
  indexada: "Componentes indexados",
  sem_esquema: "Sem esquema (só foto)",
  pendente: "Indexando…",
  erro: "Erro ao indexar",
};

type DoadorasPageProps = { searchParams: Promise<{ q?: string }> };

export default async function DoadorasPage({ searchParams }: DoadorasPageProps) {
  const [user, params] = await Promise.all([requireCurrentUser(), searchParams]);
  const query = params.q?.trim() ?? "";
  const supabase = await createClient();

  const [results, { data: donors }] = await Promise.all([
    query ? searchDonorComponents(supabase, query) : Promise.resolve([]),
    supabase
      .from("donor_boards")
      .select("id, code, title, board_code_text, index_status, index_detail, notes, created_at")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AppShell
      title="Placas doadoras"
      description="Ache o componente que você precisa nas placas de sucata."
      user={user}
      actionLabel=""
    >
      <div className="grid gap-4">
        <section className="rounded-[28px] border border-[rgba(109,94,242,0.35)] bg-[var(--card-surface)] p-4 sm:p-6">
          <form className="flex flex-col gap-2 sm:flex-row" action="/doadoras">
            <input
              name="q"
              defaultValue={query}
              placeholder="Qual componente? Ex.: AON7506, BAV99, SY8286, 10U 0603"
              className="flex-1 rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[rgba(109,94,242,0.55)]"
            />
            <button className="rounded-full bg-[var(--accent-copper)] px-6 py-3 text-sm font-semibold text-white">
              Procurar
            </button>
          </form>

          {query ? (
            <div className="mt-4 grid gap-3">
              <p className="text-sm text-[var(--muted)]">
                {results.length
                  ? `${results.length} placa(s) doadora(s) com "${query}"`
                  : `Nenhuma doadora com "${query}". Tente só o código principal (ex.: AON7506 em vez de AON7506_DFN33).`}
              </p>
              {results.map((result) => (
                <article key={result.donorId} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] p-4">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="rounded-lg bg-[var(--accent-copper)] px-2.5 py-1 font-mono text-lg font-bold text-white">
                      {result.code}
                    </span>
                    <span className="text-sm font-semibold text-[var(--foreground)]">{result.title}</span>
                  </div>
                  <ul className="mt-3 grid gap-2">
                    {result.hits.slice(0, 12).map((hit, index) => (
                      <li
                        key={`${hit.refdes}-${hit.page}-${index}`}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                          {hit.refdes ? (
                            <strong className="font-mono text-[var(--accent-teal)]">{hit.refdes}</strong>
                          ) : (
                            <span className="text-[var(--muted)]">
                              {hit.source === "foto" ? "Lido na foto" : `Citado na pág. ${hit.page}`}
                            </span>
                          )}{" "}
                          <span className="text-[var(--muted)]">{hit.part}</span>
                          {hit.refdes && hit.page ? <span className="text-xs text-[var(--muted)]"> • pág. {hit.page}</span> : null}
                        </span>
                        <span className="flex gap-3 text-xs font-semibold">
                          {hit.boardviewHref ? (
                            <Link href={hit.boardviewHref} className="text-[var(--accent-copper)] hover:underline">
                              Ver na placa
                            </Link>
                          ) : null}
                          {hit.schematicHref ? (
                            <Link href={hit.schematicHref} className="text-[var(--accent-copper)] hover:underline">
                              Esquema
                            </Link>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {result.hits.length > 12 ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">… e mais {result.hits.length - 12} posição(ões).</p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
          <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6">
            <h3 className="mb-3 text-lg font-semibold text-[var(--foreground)]">Cadastrar doadora</h3>
            <DonorCreateForm />
          </section>

          <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6">
            <h3 className="mb-3 text-lg font-semibold text-[var(--foreground)]">
              Doadoras cadastradas ({donors?.length ?? 0})
            </h3>
            {donors?.length ? (
              <ul className="grid gap-2">
                {donors.map((donor) => (
                  <li key={donor.id} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-[var(--foreground)]">{donor.code}</span>{" "}
                        <span className="text-sm text-[var(--foreground)]">{donor.title ?? "Sem identificação"}</span>
                        <p className="text-xs text-[var(--muted)]">
                          {STATUS[donor.index_status] ?? donor.index_status}
                          {donor.index_detail ? ` • ${donor.index_detail}` : ""}
                          {donor.notes ? ` • ${donor.notes}` : ""}
                        </p>
                      </div>
                      <form action={deleteDonorBoardAction}>
                        <input type="hidden" name="donor_id" value={donor.id} />
                        <button className="text-xs text-[var(--danger)] hover:underline">Remover</button>
                      </form>
                    </div>
                    <form action={updateDonorBoardCodeAction} className="mt-2 flex gap-2">
                      <input type="hidden" name="donor_id" value={donor.id} />
                      <input
                        name="board_code"
                        defaultValue={donor.board_code_text ?? ""}
                        placeholder="Código da placa"
                        className="min-w-0 flex-1 rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-3 py-1.5 text-xs outline-none"
                      />
                      <FormSubmitButton
                        idleLabel="Salvar e indexar"
                        pendingLabel="Indexando…"
                        className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] disabled:opacity-60"
                      />
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">Nenhuma doadora ainda. Cadastre a primeira ao lado.</p>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
