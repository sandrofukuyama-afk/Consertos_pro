import { syncSemanticMemoryAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/auth";
import { getKnowledgeOverviewData } from "@/lib/services/semantic";

type ConhecimentoPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function ConhecimentoPage({
  searchParams,
}: ConhecimentoPageProps) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const overview = await getKnowledgeOverviewData();

  return (
    <AppShell
      title="Conhecimento consolidado"
      description="Centro da memoria tecnica reutilizavel da oficina, agora com base vetorial para casos semelhantes e documentos mais proximos do contexto buscado."
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

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_420px]">
          <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6 shadow-[0_18px_44px_rgba(72,62,49,0.06)]">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Infraestrutura semantica
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Vetores e fontes da memoria
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              O app agora ja consegue indexar resumos de diagnosticos, casos resolvidos e documentos tecnicos para recuperar contexto semelhante na busca.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                {
                  label: "Fontes semanticas",
                  value: String(overview.sourceCount),
                },
                {
                  label: "Embeddings salvos",
                  value: String(overview.embeddingCount),
                },
                {
                  label: "Docs pendentes",
                  value: String(overview.pendingDocumentCount),
                },
              ].map((item) => (
                <article
                  key={item.label}
                  className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {item.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                    {item.value}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-teal)]">
                Provedor atual
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {overview.provider}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {overview.externalProviderConfigured
                  ? "Embeddings externos ativos para melhorar similaridade semantica."
                  : "Modo local ativo para manter a fase funcionando agora, com caminho aberto para trocar por embeddings externos depois."}
              </p>
            </div>
          </article>

          <aside className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-white">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
              Sincronizacao
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight">
              Atualizar memoria vetorial
            </h3>
            <p className="mt-3 text-sm leading-6 text-[rgba(255,245,236,0.76)]">
              Reprocessa documentos, diagnosticos e casos resolvidos para manter a busca semantica alinhada com o estado atual da base.
            </p>
            <form action={syncSemanticMemoryAction} className="mt-5">
              <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
                Sincronizar agora
              </button>
            </form>
          </aside>
        </section>

        <section className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Casos resolvidos recentes
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.recentResolvedCases.length ? (
              overview.recentResolvedCases.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-copper)]">
                    {item.status}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                    {item.label}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    {item.summary}
                  </p>
                  <p className="mt-3 text-xs text-[var(--muted)]">{item.createdAt}</p>
                </article>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)] md:col-span-2 xl:col-span-3">
                Ainda nao ha casos resolvidos suficientes para alimentar a memoria consolidada.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
