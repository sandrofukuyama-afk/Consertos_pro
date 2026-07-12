import { requestPasswordResetAction, signInAction, signUpAction } from "@/app/actions";

type AuthPanelProps = {
  error?: string;
  message?: string;
};

export function AuthPanel({ error, message }: AuthPanelProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6 shadow-[0_18px_44px_rgba(72,62,49,0.06)]">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          Entrar
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          Acesse a bancada tecnica
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Use seu email e senha do Supabase Auth para entrar no ambiente interno.
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
            <span className="font-medium">Email</span>
            <input
              required
              type="email"
              name="email"
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            <span className="font-medium">Senha</span>
            <input
              required
              type="password"
              name="password"
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
              <span className="font-medium">Email cadastrado</span>
              <input
                required
                type="email"
                name="email"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
              />
            </label>
            <button className="rounded-full border border-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-[var(--accent-copper)]">
              Enviar link de recuperacao
            </button>
          </form>
        </details>
      </section>

      <section className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-white">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
          Primeiro acesso
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight">
          Crie seu usuario tecnico
        </h2>
        <p className="mt-3 text-sm leading-6 text-[rgba(255,245,236,0.74)]">
          O cadastro cria a conta no Supabase Auth e a sincronizacao do perfil tecnico acontece automaticamente pela trigger do banco.
        </p>

        <form action={signUpAction} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm text-white">
            <span className="font-medium">Nome completo</span>
            <input
              required
              type="text"
              name="full_name"
              className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm text-white">
            <span className="font-medium">Email</span>
            <input
              required
              type="email"
              name="email"
              className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm text-white">
            <span className="font-medium">Senha</span>
            <input
              required
              type="password"
              name="password"
              minLength={6}
              className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 outline-none"
            />
          </label>
          <button className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[var(--foreground)]">
            Criar conta
          </button>
        </form>
      </section>
    </div>
  );
}
