"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { sendDiagnosticChatMessageAction } from "@/app/actions";

type DiagnosticChatComposerProps = {
  diagnosticId: string;
  defaultMessage?: string;
};

function PendingNotice() {
  const { pending, data } = useFormStatus();

  if (!pending) {
    return null;
  }

  const sentText = String(data?.get("message") ?? "").trim();

  return (
    <div className="mb-3 grid gap-2">
      {sentText ? (
        <div className="max-w-[92%] self-end justify-self-end whitespace-pre-wrap rounded-2xl bg-[var(--accent-copper)] px-4 py-3 text-sm leading-6 text-white opacity-80">
          {sentText}
        </div>
      ) : null}
      <div className="flex items-center gap-3 justify-self-start rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-[var(--muted)]">
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-copper)] [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-copper)] [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-copper)]" />
        </span>
        A IA está analisando o caso. Pode levar alguns minutos quando ela consulta boardview e esquema.
      </div>
    </div>
  );
}

function SendButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-label="Enviar mensagem"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent-copper)] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      )}
    </button>
  );
}

function ComposerFields({
  defaultMessage,
}: {
  defaultMessage?: string;
}) {
  const { pending } = useFormStatus();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(defaultMessage ?? "");
  const [fileNames, setFileNames] = useState<string[]>([]);
  // "Pensar mais" vale so para a proxima mensagem (Opus, ~2x o custo).
  const [deep, setDeep] = useState(false);

  // Depois do envio o React limpa o formulario; sincroniza o estado local.
  useEffect(() => {
    if (!pending) {
      return;
    }

    return () => {
      setText("");
      setFileNames([]);
      setDeep(false);
    };
  }, [pending]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }
    element.style.height = "auto";
    // No celular o teclado ja ocupa metade da tela: limita a altura do campo.
    const maxHeight = window.innerWidth < 1024 ? 140 : 220;
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  }, [text]);

  const canSend = text.trim().length > 0 || fileNames.length > 0;

  return (
    <>
      <PendingNotice />

      {fileNames.length ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          {fileNames.map((name) => (
            <span
              key={name}
              className="rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-3 py-1"
            >
              📷 {name}
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
              setFileNames([]);
            }}
            className="underline hover:text-[var(--foreground)]"
          >
            remover
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-2 rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-2 focus-within:border-[rgba(109,94,242,0.55)]">
        <label
          title="Anexar foto da placa"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--foreground)]"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <input
            ref={fileInputRef}
            type="file"
            name="photos"
            multiple
            accept="image/*"
            className="sr-only"
            onChange={(event) =>
              setFileNames(Array.from(event.target.files ?? []).map((file) => file.name))
            }
          />
        </label>

        <textarea
          ref={textareaRef}
          name="message"
          rows={1}
          enterKeyHint="enter"
          data-voice-assist="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // No computador, Enter envia e Shift+Enter quebra linha.
            // No celular (tela de toque), Enter continua quebrando linha.
            const isTouch = window.matchMedia("(pointer: coarse)").matches;
            if (event.key === "Enter" && !event.shiftKey && !isTouch) {
              event.preventDefault();
              if (canSend && !pending) {
                event.currentTarget.form?.requestSubmit();
              }
            }
          }}
          placeholder="Escreva o que mediu ou observou..."
          className="max-h-[220px] min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
        />

        <SendButton disabled={!canSend} />
      </div>
      {deep ? <input type="hidden" name="deep" value="1" /> : null}
      <div className="mt-1.5 flex items-center gap-3 px-1">
        <button
          type="button"
          aria-pressed={deep}
          onClick={() => setDeep((value) => !value)}
          title="Usa a IA mais forte nesta mensagem (custa cerca do dobro). Use quando o caso travar."
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            deep
              ? "border-[var(--accent-copper)] bg-[var(--accent-copper)] text-white"
              : "border-[var(--panel-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          🧠 Pensar mais{deep ? " ✓" : ""}
        </button>
        <p className="hidden text-[11px] text-[var(--muted)] sm:block">
          Enter envia • Shift+Enter quebra linha • medições e hipóteses citadas na conversa são registradas pela IA
        </p>
      </div>
    </>
  );
}

export function DiagnosticChatComposer({
  diagnosticId,
  defaultMessage,
}: DiagnosticChatComposerProps) {
  return (
    <form action={sendDiagnosticChatMessageAction}>
      <input type="hidden" name="diagnostic_id" value={diagnosticId} />
      <ComposerFields defaultMessage={defaultMessage} />
    </form>
  );
}
