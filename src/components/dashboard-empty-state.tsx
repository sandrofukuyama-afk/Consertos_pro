import Link from "next/link";

export function DashboardEmptyState() {
  return (
    <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
        Sem diagnosticos ainda
      </p>
      <h4 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
        O banco ja esta pronto para receber o primeiro caso
      </h4>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        Agora que a Fase 1 foi aplicada no Supabase, esta tela passa a refletir os dados reais assim que um diagnostico for criado.
      </p>
      <Link
        href="/diagnosticos/novo"
        className="mt-5 inline-flex rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white"
      >
        Criar primeiro diagnostico
      </Link>
    </div>
  );
}
