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
    <main className="min-h-screen px-4 py-5 md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1120px] items-center justify-center">
        <section className="w-full rounded-[34px] border border-white/10 bg-[var(--panel)] p-5 shadow-[0_28px_80px_rgba(25,30,31,0.28)] sm:p-7 lg:p-8">
          <div className="mb-6 flex flex-col gap-3 border-b border-white/8 pb-5 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[rgba(255,245,236,0.68)]">
                ConsertosPro
              </p>
              <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Acesso técnico
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[rgba(255,245,236,0.74)]">
                Entre com seu usuário da oficina ou crie um novo acesso técnico para começar a usar o sistema.
              </p>
            </div>

            <div className="rounded-full border border-[rgba(184,109,60,0.28)] bg-[rgba(184,109,60,0.08)] px-4 py-2 text-xs font-medium text-[rgba(255,245,236,0.82)]">
              Auth e banco integrados
            </div>
          </div>

          <AuthPanel error={params.error} message={params.message} />
        </section>
      </div>
    </main>
  );
}
