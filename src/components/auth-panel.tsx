import { requestPasswordResetAction, signInAction } from "@/app/actions";

type AuthPanelProps = {
  error?: string;
  message?: string;
};

export function AuthPanel({ error, message }: AuthPanelProps) {
  return (
    <div className="mx-auto w-full max-w-[560px]">
      <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-5 shadow-[0_18px_44px_rgba(72,62,49,0.06)] sm:p-6">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          Entrar
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          Acesse a bancada técnica
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Use seu e-mail e senha para entrar no ambiente interno da oficina.
        </p>

        {error ? (
          <div className="mt-5 rounded-2xl border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mt-5 rounded-2xl border border-[rgba(45,139,130,0.28)] bg-[rgba(45,139,130,0.08)] px-4 py-3 text-sm text-[var(--accent-teal)]">
            {message}
          </div>
        ) : null}

        <form action={signInAction} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            <span className="font-medium">E-mail</span>
            <input
              required
              type="email"
              name="email"
              autoComplete="email"
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
            />
          </label>

          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            <span className="font-medium">Senha</span>
            <input
              required
              type="password"
              name="password"
              autoComplete="current-password"
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
            />
          </label>

          <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
            Entrar
          </button>
        </form>

        <details className="mt-4 text-sm text-[var(--muted)]">
          <summary className="cursor-pointer font-medium text-[var(--accent-copper)]">
            Esqueceu a senha?
          </summary>
          <form action={requestPasswordResetAction} className="mt-3 grid gap-3">
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              <span className="font-medium">E-mail cadastrado</span>
              <input
                required
                type="email"
                name="email"
                autoComplete="email"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
              />
            </label>
            <button className="rounded-full border border-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-[var(--accent-copper)]">
              Enviar link de recuperação
            </button>
          </form>
        </details>

        <div className="mt-6 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          Primeiro acesso: o cadastro de novos técnicos agora deve ser feito dentro do sistema, na área de configurações, por um usuário já autorizado.
        </div>
      </section>
    </div>
  );
}
