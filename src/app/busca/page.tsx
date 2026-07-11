import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/auth";
import { getSearchPageData } from "@/lib/services/search";

type BuscaPageProps = {
  searchParams: Promise<{
    q?: string;
    scope?: "all" | "diagnostics" | "documents";
    status?: string;
    categoryId?: string;
  }>;
};

export default async function BuscaPage({ searchParams }: BuscaPageProps) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const data = await getSearchPageData(params);

  return (
    <AppShell
      title="Busca inteligente"
      description="Consulta operacional em diagnosticos e documentos tecnicos com filtros por texto, escopo, status e categoria."
      user={user}
    >
      <div className="grid gap-4">
        <section className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6 shadow-[0_18px_44px_rgba(72,62,49,0.06)]">
          <form className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_220px_220px_220px_auto]">
            <input
              type="text"
              name="q"
              defaultValue={data.filters.q}
              placeholder="Buscar por relato, etiqueta, defeito ou documento"
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
            />
            <select
              name="scope"
              defaultValue={data.filters.scope}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
            >
              <option value="all">Tudo</option>
              <option value="diagnostics">Diagnosticos</option>
              <option value="documents">Documentos</option>
            </select>
            <select
              name="status"
              defaultValue={data.filters.status}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
            >
              <option value="">Todos os status</option>
              <option value="draft">Draft</option>
              <option value="active">Ativo</option>
              <option value="waiting_input">Aguardando teste</option>
              <option value="resolved">Resolvido</option>
              <option value="unresolved">Nao resolvido</option>
              <option value="archived">Arquivado</option>
            </select>
            <select
              name="categoryId"
              defaultValue={data.filters.categoryId}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
            >
              <option value="">Todas as categorias</option>
              {data.categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
              Buscar
            </button>
          </form>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Diagnosticos
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                  Casos encontrados
                </h3>
              </div>
              <p className="text-sm text-[var(--muted)]">
                {data.diagnostics.length} resultados
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {data.diagnostics.length ? (
                data.diagnostics.map((item) => (
                  <Link
                    key={item.id}
                    href={`/diagnosticos/${item.id}`}
                    className="block rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4 hover:border-[rgba(184,109,60,0.3)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {item.label}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {item.category} / {item.manufacturer}
                        </p>
                      </div>
                      <span className="text-xs text-[var(--muted)]">
                        {item.updatedAt}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[var(--foreground)]">{item.summary}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                      {item.status}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                  Nenhum diagnostico encontrado com os filtros atuais.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Documentos
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                  Referencias tecnicas
                </h3>
              </div>
              <p className="text-sm text-[var(--muted)]">
                {data.documents.length} resultados
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {data.documents.length ? (
                data.documents.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {item.documentType} / {item.manufacturer}
                        </p>
                      </div>
                      <span className="text-xs text-[var(--muted)]">
                        {item.uploadedAt}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[var(--foreground)]">{item.relation}</p>
                    {item.signedUrl ? (
                      <a
                        href={item.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex text-sm font-semibold text-[var(--accent-copper)]"
                      >
                        Abrir documento
                      </a>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                  Nenhum documento encontrado com os filtros atuais.
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
