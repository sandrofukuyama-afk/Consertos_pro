import { AppShell } from "@/components/app-shell";
import { TechnicalDocumentUploadForm } from "@/components/technical-document-upload-form";
import { requireCurrentUser } from "@/lib/auth";
import { getLibraryCatalog } from "@/lib/services/catalog";
import { getTechnicalDocuments } from "@/lib/services/diagnostics";

type BibliotecaPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function BibliotecaPage({
  searchParams,
}: BibliotecaPageProps) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const [catalog, documents] = await Promise.all([
    getLibraryCatalog(),
    getTechnicalDocuments(),
  ]);

  return (
    <AppShell
      title="Biblioteca técnica"
      description="Upload real de documentos técnicos no Supabase Storage, com metadados e listagem consultável para a oficina."
      user={user}
    >
      <div className="grid gap-4">
        {params.message ? (
          <section className="rounded-[26px] border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] p-5 text-sm text-[var(--accent-teal)] shadow-[0_14px_32px_rgba(72,62,49,0.06)]">
            {params.message}
          </section>
        ) : null}

        {params.error ? (
          <section className="rounded-[26px] border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] p-5 text-sm text-[var(--danger)] shadow-[0_14px_32px_rgba(72,62,49,0.06)]">
            {params.error}
          </section>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_420px]">
          <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6 shadow-[0_18px_44px_rgba(72,62,49,0.06)]">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Documentos técnicos
            </p>
            <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Biblioteca operacional
            </h3>

            <div className="mt-5 grid gap-3">
              {documents.length ? (
                documents.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--accent-teal)]">
                          {item.documentType}
                        </p>
                        <h4 className="mt-2 text-lg font-semibold tracking-tight text-[var(--foreground)]">
                          {item.title}
                        </h4>
                      </div>
                      <span className="text-xs text-[var(--muted)]">{item.uploadedAt}</span>
                    </div>
                    <p className="mt-3 text-sm text-[var(--foreground)]">
                      Fabricante: {item.manufacturer}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Relação: {item.relation}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-[var(--card-surface)] px-3 py-1 text-[var(--foreground)]">
                        {item.chunksCount} chunks
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 ${
                          item.isIndexed
                            ? "bg-[rgba(45,139,130,0.14)] text-[var(--accent-teal)]"
                            : "bg-[rgba(202,106,85,0.12)] text-[var(--danger)]"
                        }`}
                      >
                        {item.isIndexed ? "Indexado" : "Indexação pendente"}
                      </span>
                    </div>
                    {item.signedUrl ? (
                      <a
                        href={item.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex text-sm font-semibold text-[var(--accent-copper)]"
                      >
                        Abrir documento
                      </a>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                  Nenhum documento técnico foi enviado ainda.
                </div>
              )}
            </div>
          </section>

          <aside className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-white">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
              Novo upload
            </p>
            <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
              Adicionar referência técnica
            </h3>
            <p className="mt-3 text-sm leading-6 text-[rgba(255,245,236,0.76)]">
              Use esta área para subir esquemas, boardviews, BIOS e materiais de apoio que vão alimentar a memória consultável da oficina.
            </p>
            <div className="mt-5">
              <TechnicalDocumentUploadForm manufacturers={catalog.manufacturers} />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
