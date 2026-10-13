import { ChatMarkdown } from "@/components/chat-markdown";
import type { DiagnosticDetail } from "@/types/domain";

type ChatMessage = DiagnosticDetail["chatMessages"][number];

/** Uma mensagem do chat do caso (tecnico a direita, IA a esquerda). */
export function ChatMessageBubble({ entry, agentName }: { entry: ChatMessage; agentName: string }) {
  if (entry.role === "user") {
    return (
      <div className="flex max-w-[88%] scroll-mb-56 flex-col items-end self-end lg:scroll-mb-0">
        <div className="rounded-2xl rounded-br-md bg-[var(--accent-copper)] px-4 py-3 text-sm leading-6 text-white">
          {entry.text ? <p className="whitespace-pre-wrap">{entry.text}</p> : null}
          {entry.photos.length ? (
            <div className={`flex flex-wrap gap-2 ${entry.text ? "mt-2" : ""}`}>
              {entry.photos.map((photo) =>
                photo.signedUrl ? (
                  <a
                    key={photo.id}
                    href={photo.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block h-24 w-24 overflow-hidden rounded-xl border border-white/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.signedUrl} alt={photo.title} className="h-full w-full object-cover" />
                  </a>
                ) : null,
              )}
            </div>
          ) : null}
        </div>
        <p className="mt-1 px-1 text-[11px] text-[var(--muted)]">{entry.createdAt}</p>
      </div>
    );
  }

  return (
    <div className="flex max-w-[96%] scroll-mb-56 flex-col self-start lg:scroll-mb-0">
      <div className="rounded-2xl rounded-bl-md border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm leading-6 text-[var(--foreground)] [overflow-wrap:anywhere]">
        <ChatMarkdown text={entry.text} />
        {entry.agentActions.length || entry.sources.length ? (
          <details className="mt-3 text-xs text-[var(--muted)]">
            <summary className="cursor-pointer select-none hover:text-[var(--foreground)]">
              O que a IA consultou
              {entry.agentActions.length ? ` (${entry.agentActions.length})` : ""}
            </summary>
            {entry.agentActions.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {entry.agentActions.map((action, index) => (
                  <li key={`${entry.id}-action-${index}`}>{action}</li>
                ))}
              </ul>
            ) : null}
            {entry.sources.length ? (
              <ul className="mt-2 space-y-1 break-words">
                {entry.sources.map((source, index) => (
                  <li key={`${entry.id}-source-${index}`}>• {source}</li>
                ))}
              </ul>
            ) : null}
          </details>
        ) : null}
      </div>
      <p className="mt-1 px-1 text-[11px] text-[var(--muted)]">
        {agentName} • {entry.createdAt}
      </p>
    </div>
  );
}
