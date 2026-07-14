export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-xl rounded-[32px] border border-[var(--panel-border)] bg-[rgba(16,13,11,0.92)] p-8 shadow-[0_24px_64px_rgba(0,0,0,0.35)]">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--accent-teal)]">
          Modo offline
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight text-[var(--foreground)]">
          A conexao caiu, mas o app continua com voce.
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
          Assim que a internet voltar, recarregue a pagina para sincronizar os dados mais recentes.
          Os registros locais do fluxo offline continuam disponiveis no aparelho.
        </p>
        <div className="mt-6 rounded-[24px] border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] p-4 text-sm leading-6 text-[var(--foreground)]">
          Dica: se voce instalou o ConsertosPro, abra pelo icone do app para uma experiencia mais estavel na bancada.
        </div>
      </section>
    </main>
  );
}
