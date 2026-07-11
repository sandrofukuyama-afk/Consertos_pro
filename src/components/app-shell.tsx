"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/logout-button";
import { navItems } from "@/lib/mock-data";
import type { AppUser } from "@/types/domain";

type AppShellProps = {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  user: AppUser;
  children: ReactNode;
};

export function AppShell({
  title,
  description,
  actionLabel = "Novo diagnostico",
  actionHref = "/diagnosticos/novo",
  user,
  children,
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen px-4 py-4 md:px-5">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1600px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[var(--panel)] text-white shadow-[0_28px_80px_rgba(25,30,31,0.28)]">
          <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-br from-[rgba(184,109,60,0.24)] to-transparent" />
          <div className="relative flex h-full flex-col p-6">
            <div className="border-b border-white/10 pb-5">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[rgba(255,245,236,0.68)]">
                ConsertosPro
              </p>
              <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-white">
                Bancada com memoria tecnica
              </h1>
              <p className="mt-3 max-w-xs text-sm leading-6 text-[rgba(255,245,236,0.72)]">
                Fundacao do MVP orientada pelo plano do projeto, pronta para ganhar dados reais e integracao com Supabase.
              </p>
            </div>

            <nav className="mt-6 flex flex-1 flex-col gap-2">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-2xl border px-4 py-3 ${
                      isActive
                        ? "border-[rgba(184,109,60,0.55)] bg-[rgba(184,109,60,0.16)]"
                        : "border-transparent bg-white/0 hover:border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold tracking-tight">
                        {item.label}
                      </span>
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          isActive ? "bg-[var(--accent-copper)]" : "bg-white/20"
                        }`}
                      />
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-[rgba(255,245,236,0.68)]">
                      {item.description}
                    </p>
                  </Link>
                );
              })}
            </nav>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[rgba(255,245,236,0.58)]">
                Proxima fase
              </p>
              <p className="mt-2 text-sm leading-6 text-[rgba(255,245,236,0.82)]">
                Formularios operacionais, timeline real, anexos e busca integrada.
              </p>
            </div>
          </div>
        </aside>

        <main className="overflow-hidden rounded-[30px] border border-[var(--panel-border)] bg-[rgba(255,251,247,0.76)] shadow-[0_24px_64px_rgba(43,40,35,0.14)] backdrop-blur">
          <header className="flex flex-col gap-4 border-b border-[var(--panel-border)] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Oficina interna
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                {title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                {description}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-[240px] items-center rounded-full border border-[var(--panel-border)] bg-white/80 px-4 py-3 text-sm text-[var(--muted)]">
                Buscar por modelo, placa, componente ou sintoma
              </div>
              <Link
                href={actionHref}
                className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-center text-sm font-semibold text-white shadow-[0_14px_30px_rgba(184,109,60,0.28)] hover:-translate-y-0.5 hover:bg-[#a95f31]"
              >
                {actionLabel}
              </Link>
              <div className="rounded-full border border-[var(--panel-border)] bg-white/70 px-4 py-3 text-sm font-medium text-[var(--foreground)]">
                {user.fullName}
              </div>
              <LogoutButton />
            </div>
          </header>

          <div className="px-5 py-5 md:px-8 md:py-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
