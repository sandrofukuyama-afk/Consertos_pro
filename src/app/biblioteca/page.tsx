import { AppShell } from "@/components/app-shell";
import { TechnicalLibraryList } from "@/components/technical-library-list";
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

            <TechnicalLibraryList
              items={libraryItems}
              boards={catalog.boards}
              models={catalog.models}
              manufacturers={catalog.manufacturers}
            />
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
