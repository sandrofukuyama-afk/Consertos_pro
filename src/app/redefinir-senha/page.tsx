"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "submitting" | "done">(
    "checking",
  );
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "ready" : "invalid");
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas nao coincidem.");
      return;
    }

    setStatus("submitting");

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setStatus("ready");
      return;
    }

    setStatus("done");
    await supabase.auth.signOut();

    setTimeout(() => {
      router.push("/login?message=Senha atualizada. Faca login com a nova senha.");
    }, 1500);
  }

  return (
    <main className="min-h-screen px-4 py-4 md:px-5">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[560px] items-center">
        <section className="w-full rounded-[28px] border border-[var(--panel-border)] bg-white/85 p-6 shadow-[0_18px_44px_rgba(72,62,49,0.06)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Redefinir senha
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            Escolha uma nova senha
          </h1>

          {status === "checking" ? (
            <p className="mt-5 text-sm text-[var(--muted)]">Verificando o link de recuperacao...</p>
          ) : null}

          {status === "invalid" ? (
            <div className="mt-5 rounded-2xl border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
              Este link e invalido ou ja expirou. Solicite um novo link em &quot;Esqueceu a senha?&quot; na tela de login.
            </div>
          ) : null}

          {status === "done" ? (
            <div className="mt-5 rounded-2xl border border-[rgba(45,139,130,0.28)] bg-[rgba(45,139,130,0.08)] px-4 py-3 text-sm text-[var(--accent-teal)]">
              Senha atualizada. Redirecionando para o login...
            </div>
          ) : null}

          {status === "ready" || status === "submitting" ? (
            <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
              {error ? (
                <div className="rounded-2xl border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
                  {error}
                </div>
              ) : null}

              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                <span className="font-medium">Nova senha</span>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground)]">
                <span className="font-medium">Confirmar nova senha</span>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                />
              </label>
              <button
                disabled={status === "submitting"}
                className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {status === "submitting" ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
