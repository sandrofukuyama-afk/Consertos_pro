"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

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
  actionLabel = "Novo diagnóstico",
  actionHref = "/diagnosticos/novo",
  user,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const userInitials = user.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const renderSidebarContent = (onClose?: () => void) => (
    <div className="relative flex h-full flex-col p-6">
      <div className="border-b border-white/10 pb-5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[rgba(255,245,236,0.68)]">
            ConsertosPro
          </p>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-white/10 lg:hidden text-white/80 hover:text-white transition"
              aria-label="Fechar menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-white">
          Bancada com memória técnica
        </h1>
        <p className="mt-3 max-w-xs text-sm leading-6 text-[rgba(255,245,236,0.72)]">
          Fundação do MVP orientada pelo plano do projeto, pronta para ganhar dados reais e integração com Supabase.
        </p>
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onClose && onClose()}
              className={`rounded-2xl border px-4 py-3 transition ${
                isActive
                  ? "border-[rgba(184,109,60,0.55)] bg-[rgba(184,109,60,0.16)] text-white"
                  : "border-transparent text-white/80 hover:border-white/10 hover:bg-white/5 hover:text-white"
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

      <div className="mt-auto pt-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[rgba(255,245,236,0.58)]">
            Próxima fase
          </p>
          <p className="mt-2 text-sm leading-6 text-[rgba(255,245,236,0.82)]">
            Formulários operacionais, timeline real, anexos e busca integrada.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen px-3 py-3 md:px-5 md:py-4">
      {/* Mobile Drawer Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-300 lg:hidden ${
          isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMenuOpen(false)}
      />

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[300px] max-w-[85vw] transform bg-[var(--panel)] border-r border-white/10 shadow-[0_28px_80px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-in-out lg:hidden ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-br from-[rgba(184,109,60,0.24)] to-transparent" />
        {renderSidebarContent(() => setIsMenuOpen(false))}
      </div>

      <div className="mx-auto flex flex-col gap-4 lg:grid lg:min-h-[calc(100vh-2rem)] lg:max-w-[1600px] lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Desktop Sidebar */}
        <aside className="relative hidden overflow-hidden rounded-[30px] border border-white/10 bg-[var(--panel)] text-white shadow-[0_28px_80px_rgba(25,30,31,0.28)] lg:block">
          <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-br from-[rgba(184,109,60,0.24)] to-transparent" />
          {renderSidebarContent()}
        </aside>

        {/* Mobile Header Bar */}
        <header className="flex items-center justify-between rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 shadow-md lg:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="rounded-full p-2 text-white hover:bg-white/5 transition focus:outline-none"
              aria-label="Abrir menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/" className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-white">
              ConsertosPro
            </Link>
          </div>
          
          <div className="flex items-center gap-2">
            <Link
              href="/busca"
              className="rounded-full p-2 text-[var(--muted)] hover:bg-white/5 hover:text-white transition"
              aria-label="Buscar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-copper)] text-xs font-semibold text-white shadow-sm" title={user.fullName}>
              {userInitials}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="min-w-0 overflow-hidden rounded-[30px] border border-[var(--panel-border)] bg-[rgba(26,22,19,0.88)] shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur">
          <header className="flex flex-col gap-4 border-b border-[var(--panel-border)] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8 md:py-5">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Oficina interna
              </p>
              <h2 className="mt-2 break-words font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">
                {title}
              </h2>
              <p className="mt-1 max-w-3xl break-words text-sm leading-6 text-[var(--muted)]">
                {description}
              </p>
            </div>

            <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <Link
                href="/busca"
                className="flex w-full min-w-0 items-center rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-2.5 text-sm text-[var(--muted)] sm:w-auto sm:min-w-[240px] hover:border-[rgba(184,109,60,0.3)] transition"
              >
                Buscar por modelo, placa, componente ou sintoma
              </Link>
              <Link
                href={actionHref}
                className="rounded-full bg-[var(--accent-copper)] px-5 py-2.5 text-center text-sm font-semibold text-white shadow-[0_14px_30px_rgba(184,109,60,0.28)] hover:-translate-y-0.5 hover:bg-[#a95f31] transition"
              >
                {actionLabel}
              </Link>
              <div className="hidden max-w-full break-words rounded-full border border-[var(--panel-border)] bg-[var(--card-surface-soft)] px-4 py-2.5 text-center text-sm font-medium text-[var(--foreground)] sm:block">
                {user.fullName}
              </div>
              <div className="hidden sm:block">
                <LogoutButton />
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1 sm:hidden">
                <span className="text-xs text-[var(--muted)]">{user.fullName}</span>
                <LogoutButton />
              </div>
            </div>
          </header>

          <div className="px-4 py-4 md:px-8 md:py-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
