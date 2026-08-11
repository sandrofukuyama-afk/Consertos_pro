import { AppShell } from "@/components/app-shell";
import { DiagnosticBenchWorkspace } from "@/components/diagnostic-bench-workspace";
import { requireCurrentUser } from "@/lib/auth";
import {
  getDiagnosticDetail,
  getDiagnosticFormOptions,
} from "@/lib/services/diagnostics";

type DiagnosticDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function DiagnosticDetailPage({
  params,
  searchParams,
}: DiagnosticDetailPageProps) {
  const userPromise = requireCurrentUser();
  const { id } = await params;
  const [user, detail, options, query] = await Promise.all([
    userPromise,
    getDiagnosticDetail(id),
    getDiagnosticFormOptions(id),
    searchParams,
  ]);

  return (
    <AppShell
      title={`Diagnóstico ${detail.label}`}
      description="Workspace de bancada com IA, histórico técnico e acesso rápido a boardview e esquema."
      user={user}
      actionLabel="Voltar para dashboard"
      actionHref="/"
    >
      <div className="grid gap-4">
        {query.message ? (
          <section className="rounded-[26px] border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] p-5 text-sm text-[var(--accent-teal)]">
            {query.message}
          </section>
        ) : null}

        {query.error ? (
          <section className="rounded-[26px] border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] p-5 text-sm text-[var(--danger)]">
            {query.error}
          </section>
        ) : null}

        <DiagnosticBenchWorkspace detail={detail} options={options} />
      </div>
    </AppShell>
  );
}
