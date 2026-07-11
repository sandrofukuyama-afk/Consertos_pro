import { AppShell } from "@/components/app-shell";
import type { AppUser } from "@/types/domain";
import type { ModuleTask } from "@/types/domain";

type ModulePageProps = {
  title: string;
  description: string;
  highlights: ModuleTask[];
  user: AppUser;
};

export function ModulePage({
  title,
  description,
  highlights,
  user,
}: ModulePageProps) {
  return (
    <AppShell title={title} description={description} user={user}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="rounded-[28px] border border-[var(--panel-border)] bg-white/80 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Direcao inicial
          </p>
          <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Modulo pronto para detalhamento incremental
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            Esta tela foi preparada como base estrutural do aplicativo. O proximo passo aqui e ligar os formulários, services e persistencia ao modelo de dados descrito na documentacao.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {highlights.map((item) => (
              <article
                key={item.title}
                className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5"
              >
                <h4 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
                  {item.title}
                </h4>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <aside className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-white">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
            Checklist do MVP
          </p>
          <div className="mt-5 space-y-4">
            {[
              "Fluxo rapido para a bancada",
              "Rastreabilidade por tecnico",
              "Separacao entre historico e conhecimento consolidado",
              "Base preparada para Supabase Auth, Storage e schema SQL",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-[rgba(255,245,236,0.8)]"
              >
                {item}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
