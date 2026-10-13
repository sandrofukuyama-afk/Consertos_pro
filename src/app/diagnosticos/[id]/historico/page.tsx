import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ChatMessageBubble } from "@/components/chat-message-bubble";
import { requireCurrentUser } from "@/lib/auth";
import { getDiagnosticDetail } from "@/lib/services/diagnostics";

type HistoryPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Conversa inteira do caso, so para consulta (a tela do caso mostra so a ultima troca). */
export default async function DiagnosticHistoryPage({ params, searchParams }: HistoryPageProps) {
  const userPromise = requireCurrentUser();
  const { id } = await params;
  const [user, detail, query] = await Promise.all([userPromise, getDiagnosticDetail(id), searchParams]);
  const agentName = detail.assistantSnapshot.activeAgent.name;
  const search = (query.q ?? "").trim();
  const words = normalize(search).split(/\s+/).filter(Boolean);
  const messages = words.length
    ? detail.chatMessages.filter((entry) => {
        const text = normalize(entry.text);
        return words.every((word) => text.includes(word));
      })
    : detail.chatMessages;

  return (
    <AppShell
      title={`Histórico — ${detail.label}`}
      description={`${detail.chatMessages.length} mensagens nesta conversa`}
      user={user}
      actionLabel="← Voltar ao caso"
      actionHref={`/diagnosticos/${detail.id}`}
    >
      <div className="grid gap-4">
        <form method="get" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Procurar na conversa (ex.: PQ708, 19V, curto)"
            className="min-w-0 flex-1 rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-2.5 text-base text-[var(--foreground)]"
          />
          <button
            type="submit"
            className="rounded-2xl bg-[var(--accent-copper)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Buscar
          </button>
        </form>

        {search ? (
          <p className="text-sm text-[var(--muted)]">
            {messages.length} de {detail.chatMessages.length} mensagens com &ldquo;{search}&rdquo; ·{" "}
            <Link href={`/diagnosticos/${detail.id}/historico`} className="underline">
              mostrar tudo
            </Link>
          </p>
        ) : null}

        <section className="flex flex-col gap-4 rounded-[26px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-4 sm:px-5">
          {messages.length ? (
            messages.map((entry) => <ChatMessageBubble key={entry.id} entry={entry} agentName={agentName} />)
          ) : (
            <p className="py-10 text-center text-sm text-[var(--muted)]">
              {search ? "Nenhuma mensagem encontrada." : "Este caso ainda não tem conversa."}
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
