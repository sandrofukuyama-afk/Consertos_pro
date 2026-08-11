import { AppShell } from "@/components/app-shell";
import { TechnicalDocumentUploadForm } from "@/components/technical-document-upload-form";
import { requireCurrentUser } from "@/lib/auth";
import { getLibraryCatalog } from "@/lib/services/catalog";
import { getTechnicalLibraryItems } from "@/lib/services/diagnostics";

type BibliotecaPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    manufacturer_id?: string;
    model_id?: string;
    board_id?: string;
  }>;
};

export default async function BibliotecaPage({
  searchParams,
}: BibliotecaPageProps) {
  const userPromise = requireCurrentUser();
  const catalogPromise = getLibraryCatalog();
  const libraryItemsPromise = getTechnicalLibraryItems();
  const [user, catalog, libraryItems] = await Promise.all([
    userPromise,
    catalogPromise,
    libraryItemsPromise,
  ]);

  const params = await searchParams;

  return (
    <AppShell
      title="Biblioteca técnica"
      description="Aqui você guarda documentos técnicos, PDFs, esquemas e arquivos de apoio."
      user={user}
    >
      <div className="grid gap-4">
        {params.message ? (
          <section className="rounded-[26px] border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] p-5 text-sm text-[var(--accent-teal)] shadow-[0_14px_32px_rgba(20,18,28,0.06)]">
            {params.message}
          </section>
        ) : null}

        {params.error ? (
          <section className="rounded-[26px] border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] p-5 text-sm text-[var(--danger)] shadow-[0_14px_32px_rgba(20,18,28,0.06)]">
            {params.error}
          </section>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_420px]">
          <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-6 shadow-[0_18px_44px_rgba(20,18,28,0.06)]">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Documentos técnicos
            </p>
            <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Arquivos salvos
            </h3>

            <div className="mt-5 grid gap-3">
              {libraryItems.length ? (
                libraryItems.map((item) => (
                  <article
                    key={`${item.source}:${item.id}`}
                    className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--accent-teal)]">
                          {item.documentType}
                        </p>
                        <h4 className="mt-2 text-lg font-semibold tracking-tight text-[var(--foreground)] break-words">
                          {item.title}
                        </h4>
                      </div>
                      <span className="shrink-0 text-xs text-[var(--muted)]">{item.uploadedAt}</span>
                    </div>
                    <p className="mt-3 text-sm text-[var(--foreground)]">
                      Fabricante: {item.manufacturer}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Relação: {item.relation}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {item.fileSizeLabel ? (
                        <span className="rounded-full bg-[var(--card-surface)] px-3 py-1 text-[var(--foreground)]">
                          {item.fileSizeLabel}
                        </span>
                      ) : null}
                      {item.chunksCount !== null ? (
                        <span className="rounded-full bg-[var(--card-surface)] px-3 py-1 text-[var(--foreground)]">
                          {item.chunksCount} chunks
                        </span>
                      ) : null}
                      {item.isIndexed !== null ? (
                        <span
                          className={`rounded-full px-3 py-1 ${
                            item.isIndexed
                              ? "bg-[rgba(45,139,130,0.14)] text-[var(--accent-teal)]"
                              : "bg-[rgba(202,106,85,0.12)] text-[var(--danger)]"
                          }`}
                        >
                          {item.isIndexed ? "Indexado" : "Indexação pendente"}
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-3 py-1 ${
                          item.associationStatus === "associated"
                            ? "bg-[rgba(45,139,130,0.14)] text-[var(--accent-teal)]"
                            : item.associationStatus === "unassociated"
                              ? "bg-[rgba(202,106,85,0.12)] text-[var(--danger)]"
                              : "bg-[var(--card-surface)] text-[var(--foreground)]"
                        }`}
                      >
                        {item.associationStatus === "associated"
                          ? "Associado"
                          : item.associationStatus === "unassociated"
                            ? "Não associado"
                            : "Legado"}
                      </span>
                      {item.associationLabel ? (
                        <span className="rounded-full bg-[var(--card-surface)] px-3 py-1 text-[var(--foreground)]">
                          {item.associationLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4">
                      {item.boardviewLabHref ? (
                        <a
                          href={item.boardviewLabHref}
                          className="inline-flex text-sm font-semibold text-[var(--accent-copper)]"
                        >
                          Abrir no laboratório
                        </a>
                      ) : null}
                      {item.signedUrl ? (
                        <a
                          href={item.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-sm font-semibold text-[var(--accent-copper)]"
                        >
                          Abrir documento
                        </a>
                      ) : null}
                    </div>
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
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(230,228,245,0.56)]">
              Novo upload
            </p>
            <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
              Adicionar arquivo
            </h3>
            <p className="mt-3 text-sm leading-6 text-[rgba(230,228,245,0.76)]">
              Use esta area para subir esquemas, boardviews, BIOS e outros arquivos que ajudam no reparo.
            </p>
            <div className="mt-5">
              <TechnicalDocumentUploadForm
                categories={catalog.categories}
                manufacturers={catalog.manufacturers}
                models={catalog.models}
                boards={catalog.boards}
                components={catalog.components}
                selectedManufacturerId={params.manufacturer_id}
                selectedModelId={params.model_id}
                selectedBoardId={params.board_id}
              />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
