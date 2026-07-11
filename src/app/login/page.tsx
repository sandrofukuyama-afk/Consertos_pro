import { redirect } from "next/navigation";

import { AuthPanel } from "@/components/auth-panel";
import { getCurrentUser } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  const params = await searchParams;

  return (
    <main className="min-h-screen px-4 py-4 md:px-5">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1400px] gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-[30px] border border-white/10 bg-[var(--panel)] p-8 text-white shadow-[0_28px_80px_rgba(25,30,31,0.28)]">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[rgba(255,245,236,0.68)]">
            ConsertosPro
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-tight">
            Fase 2 em andamento
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[rgba(255,245,236,0.76)]">
            O aplicativo ja conversa com o Supabase Auth e com o schema remoto da oficina. A partir daqui a dashboard deixa de ser apenas conceito e passa a operar com dados reais.
          </p>
        </section>

        <AuthPanel error={params.error} message={params.message} />
      </div>
    </main>
  );
}
