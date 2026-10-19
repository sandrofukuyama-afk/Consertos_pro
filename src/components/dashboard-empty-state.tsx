import Link from "next/link";

export function DashboardEmptyState() {
  return (
    <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
        Nenhum caso aberto
      </p>
      <h4 className="mt-3 break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">
        Todos os casos estão encerrados
      </h4>
      <p className="mx-auto mt-3 max-w-2xl break-words text-sm leading-6 text-[var(--muted)]">
        Comece um diagnóstico novo acima. Para voltar a um caso encerrado, ache-o na busca, abra e toque em
        &quot;Reabrir caso&quot; no painel lateral.
      </p>
      <Link
        href="/busca"
        className="mt-5 inline-flex rounded-full border border-[var(--panel-border)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
      >
        Buscar casos encerrados
      </Link>
    </div>
  );
}
