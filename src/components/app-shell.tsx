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

  const renderSidebarContent = () => (
    <div className="relative flex h-full flex-col p-6">
      <div className="border-b border-white/10 pb-5">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-[rgba(255,245,236,0.68)]">
          ConsertosPro
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-white">
          Bancada com memória técnica
        </h1>
        <p className="mt-3 max-w-xs text-sm leading-6 text-[rgba(255,245,236,0.72)]">
          Fundação do MVP orientada pelo plano do projeto, pronta para ganhar dados reais e integração com Supabase.
        </p>
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const displayLabel =
            item.href === "/catalogo-tecnico" ? "Cadastros" : item.label;
          const displayDescription =
            item.href === "/catalogo-tecnico"
              ? "Central para categorias, fabricantes, tipos de placa, modelos, placas, componentes, sintomas e testes"
              : item.description;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-2xl border px-4 py-3 transition ${
                isActive
                  ? "border-[rgba(109, 94, 242,0.55)] bg-[rgba(109, 94, 242,0.16)] text-white"
                  : "border-transparent text-white/80 hover:border-white/10 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold tracking-tight">
                  {displayLabel}
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isActive ? "bg-[var(--accent-copper)]" : "bg-white/20"
                  }`}
                />
              </div>
              <p className="mt-1.5 text-xs leading-5 text-[rgba(255,245,236,0.68)]">
                {displayDescription}
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

  const renderBottomSheetContent = (onClose: () => void) => {
    const secondaryItems = navItems.filter((item) =>
      !["/", "/biblioteca", "/conhecimento", "/busca"].includes(item.href),
    );

    return (
      <div className="relative p-6 pb-12 text-white">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[rgba(255,245,236,0.58)]">
              ConsertosPro
            </p>
            <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-semibold">
              Menu adicional
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/5 p-2 text-white transition hover:bg-white/10 focus:outline-none"
            aria-label="Fechar menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <p className="mb-3 text-xs font-mono uppercase tracking-[0.2em] text-[var(--muted)]">
              Páginas de suporte
            </p>
            <div className="grid gap-2">
              {secondaryItems.map((item) => {
                const displayLabel =
                  item.href === "/catalogo-tecnico" ? "Cadastros" : item.label;
                const displayDescription =
                  item.href === "/catalogo-tecnico"
                    ? "Central para categorias, fabricantes, tipos de placa, modelos, placas, componentes, sintomas e testes"
                    : item.description;
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3.5 transition ${
                      isActive
                        ? "border-[rgba(109, 94, 242,0.55)] bg-[rgba(109, 94, 242,0.16)] text-white"
                        : "border-white/5 bg-white/3 text-white/80 hover:bg-white/5"
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold tracking-tight">{displayLabel}</span>
                      <span className="mt-1 block truncate text-xs text-[var(--muted)]">{displayDescription}</span>
                    </div>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${isActive ? "bg-[var(--accent-copper)]" : "bg-white/10"}`}
                    />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="mb-3 text-xs font-mono uppercase tracking-[0.2em] text-[var(--muted)]">
              Perfil do técnico
            </p>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{user.fullName}</p>
                <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
              </div>
              <LogoutButton />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-[rgba(255,245,236,0.68)]">
            <p className="mb-1 font-mono uppercase tracking-[0.22em] text-[rgba(255,245,236,0.58)]">
              Próxima fase
            </p>
            Formulários operacionais, timeline real, anexos e busca integrada.
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden px-3 py-3 md:px-5 md:py-4">
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-300 lg:hidden ${
          isMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMenuOpen(false)}
      />

      <div
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[30px] border-t border-white/10 bg-[var(--panel)] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-in-out lg:hidden ${
          isMenuOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {renderBottomSheetContent(() => setIsMenuOpen(false))}
      </div>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 lg:grid lg:min-h-[calc(100vh-2rem)] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="relative hidden overflow-hidden rounded-[30px] border border-white/10 bg-[var(--panel)] text-white shadow-[0_28px_80px_rgba(25,30,31,0.28)] lg:block">
          <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-br from-[rgba(109, 94, 242,0.24)] to-transparent" />
          {renderSidebarContent()}
        </aside>

        <header className="flex items-center justify-between rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-3.5 shadow-md lg:hidden">
          <Link href="/" className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-white">
            ConsertosPro
          </Link>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-copper)] text-xs font-semibold text-white shadow-sm"
            title={user.fullName}
          >
            {userInitials}
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-hidden rounded-[30px] border border-[var(--panel-border)] bg-[rgba(26,22,19,0.88)] shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur">
          <header className="flex flex-col gap-4 border-b border-[var(--panel-border)] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8 md:py-5">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Central de diagnósticos
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
                className="flex w-full min-w-0 items-center rounded-full border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-2.5 text-sm text-[var(--muted)] transition hover:border-[rgba(109, 94, 242,0.3)] sm:w-auto sm:min-w-[240px]"
              >
                Buscar por modelo, placa, componente ou sintoma
              </Link>
              <Link
                href={actionHref}
                className="rounded-full bg-[var(--accent-copper)] px-5 py-2.5 text-center text-sm font-semibold text-white shadow-[0_14px_30px_rgba(109, 94, 242,0.28)] transition hover:-translate-y-0.5 hover:bg-[#5b4ed9]"
              >
                {actionLabel}
              </Link>
              <div className="hidden max-w-full break-words rounded-full border border-[var(--panel-border)] bg-[var(--card-surface-soft)] px-4 py-2.5 text-center text-sm font-medium text-[var(--foreground)] sm:block">
                {user.fullName}
              </div>
              <div className="hidden sm:block">
                <LogoutButton />
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-2 sm:hidden">
                <span className="text-xs text-[var(--muted)]">{user.fullName}</span>
                <LogoutButton />
              </div>
            </div>
          </header>

          <div className="px-4 py-4 pb-24 md:px-8 md:py-7 lg:pb-7">{children}</div>
        </main>

        <nav className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-around border-t border-white/10 bg-[var(--panel)]/90 px-2 py-2 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md lg:hidden">
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 px-2.5 py-1.5 transition ${
              pathname === "/"
                ? "font-semibold text-[var(--accent-copper)]"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-[10px] tracking-tight">Casos</span>
          </Link>

          <Link
            href="/biblioteca"
            className={`flex flex-col items-center gap-1 px-2.5 py-1.5 transition ${
              pathname.startsWith("/biblioteca")
                ? "font-semibold text-[var(--accent-copper)]"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-[10px] tracking-tight">Biblioteca</span>
          </Link>

          <Link
            href="/conhecimento"
            className={`flex flex-col items-center gap-1 px-2.5 py-1.5 transition ${
              pathname.startsWith("/conhecimento")
                ? "font-semibold text-[var(--accent-copper)]"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-[10px] tracking-tight">Memória</span>
          </Link>

          <Link
            href="/busca"
            className={`flex flex-col items-center gap-1 px-2.5 py-1.5 transition ${
              pathname.startsWith("/busca")
                ? "font-semibold text-[var(--accent-copper)]"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-[10px] tracking-tight">Busca</span>
          </Link>

          <button
            onClick={() => setIsMenuOpen(true)}
            className={`flex flex-col items-center gap-1 px-2.5 py-1.5 transition focus:outline-none ${
              isMenuOpen ? "text-[var(--accent-copper)]" : "text-[var(--muted)] hover:text-white"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[10px] tracking-tight">Mais</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
