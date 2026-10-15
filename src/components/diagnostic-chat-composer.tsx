"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { shrinkPhoto } from "@/lib/client/shrink-photo";

type DiagnosticChatComposerProps = {
  diagnosticId: string;
  defaultMessage?: string;
};

type ChatStreamEvent =
  | { type: "text"; delta: string }
  | { type: "tools"; names: string[] }
  | { type: "ping" }
  | { type: "done" }
  | { type: "error"; message: string };

type SendState =
  | { phase: "idle" }
  | { phase: "sending"; sentText: string; photoCount: number; reply: string; activity: string }
  | { phase: "error"; message: string };

// Sem nenhum sinal do servidor por esse tempo, a conexao caiu (o servidor manda
// um "ping" a cada 10 s). O primeiro sinal pode demorar mais por causa das fotos.
const FIRST_SIGNAL_TIMEOUT_MS = 90_000;
const SILENCE_TIMEOUT_MS = 45_000;

const TOOL_LABELS: Record<string, string> = {
  listar_arquivos_tecnicos: "biblioteca",
  usar_arquivo_tecnico: "arquivos do caso",
  buscar_no_boardview: "boardview",
  detalhar_componente: "componente no boardview",
  detalhar_net: "net no boardview",
  buscar_no_esquema: "esquema",
  ler_pagina_do_esquema: "página do esquema",
  valores_de_referencia: "valores de referência",
  consultar_registros_do_caso: "registros do caso",
  registrar_medicao: "registrando medição",
  registrar_hipotese: "registrando hipótese",
  atualizar_hipotese: "atualizando hipótese",
  atualizar_resumo_do_caso: "atualizando resumo",
};

function newClientMessageId() {
  // randomUUID so existe em https/localhost; no celular pela rede local (http)
  // usa um id aleatorio simples.
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function describeTools(names: string[]) {
  const labels = Array.from(new Set(names.map((name) => TOOL_LABELS[name] ?? name)));
  return `Consultando: ${labels.join(", ")}…`;
}

export function DiagnosticChatComposer({ diagnosticId, defaultMessage }: DiagnosticChatComposerProps) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(defaultMessage ?? "");
  const [photos, setPhotos] = useState<File[]>([]);
  // "Pensar mais" vale so para a proxima mensagem (Opus, ~2x o custo).
  const [deep, setDeep] = useState(false);
  const [state, setState] = useState<SendState>({ phase: "idle" });
  // Mesmo id em todas as tentativas da mesma mensagem: se a primeira chegou ao
  // servidor, "Tentar de novo" nao grava a pergunta duas vezes. Muda quando o
  // tecnico edita o texto ou as fotos.
  const clientMessageIdRef = useRef<string | null>(null);

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

  const busy = state.phase === "sending" || isRefreshing;
  const canSend = (text.trim().length > 0 || photos.length > 0) && !busy;

  async function send() {
    const sentText = text.trim();
    setState({ phase: "sending", sentText, photoCount: photos.length, reply: "", activity: "" });

    const controller = new AbortController();
    let watchdog = setTimeout(() => controller.abort(), FIRST_SIGNAL_TIMEOUT_MS);
    const stillAlive = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => controller.abort(), SILENCE_TIMEOUT_MS);
    };

    try {
      clientMessageIdRef.current ??= newClientMessageId();
      const formData = new FormData();
      formData.set("message", sentText);
      formData.set("client_message_id", clientMessageIdRef.current);
      if (deep) {
        formData.set("deep", "1");
      }
      for (const photo of await Promise.all(photos.map(shrinkPhoto))) {
        formData.append("photos", photo);
      }

      const response = await fetch(`/api/diagnosticos/${diagnosticId}/chat`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          payload?.error ??
            (response.status === 413
              ? "As fotos ficaram grandes demais para enviar. Mande uma de cada vez."
              : `O app não respondeu (erro ${response.status}).`),
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        stillAlive();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }
          const event = JSON.parse(line) as ChatStreamEvent;
          if (event.type === "text") {
            setState((current) =>
              current.phase === "sending"
                ? { ...current, reply: current.reply + event.delta, activity: "" }
                : current,
            );
          } else if (event.type === "tools") {
            // O texto antes de uma consulta e so um aviso; a resposta vem depois.
            setState((current) =>
              current.phase === "sending"
                ? { ...current, reply: "", activity: describeTools(event.names) }
                : current,
            );
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "done") {
            finished = true;
          }
        }
      }

      if (!finished) {
        throw new Error("A conexão caiu antes do fim da resposta.");
      }

      clientMessageIdRef.current = null;
      setText("");
      setPhotos([]);
      setDeep(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      // Mostra a resposta salva (com formatacao) e so entao some a previa.
      startRefresh(() => {
        router.refresh();
        setState({ phase: "idle" });
      });
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "A conexão parou de responder (internet fraca ou tela bloqueada)."
          : error instanceof TypeError
            ? "Sem conexão com o app. Confira a internet."
            : error instanceof Error
              ? error.message
              : "Falha ao enviar a mensagem.";
      setState({ phase: "error", message });
      // A pergunta pode ter chegado e sido salva antes da falha.
      router.refresh();
    } finally {
      clearTimeout(watchdog);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSend) {
      void send();
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {state.phase === "sending" || (isRefreshing && state.phase !== "error") ? (
        <PendingPreview state={state} />
      ) : null}

      {state.phase === "error" ? (
        <div className="mb-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
          <p>{state.message}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Seu texto continua no campo abaixo.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={!canSend}
              className="rounded-full bg-[var(--accent-copper)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Tentar de novo
            </button>
            <button
              type="button"
              onClick={() => setState({ phase: "idle" })}
              className="rounded-full border border-[var(--panel-border)] px-4 py-1.5 text-xs text-[var(--muted)]"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}

      {photos.length ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          {photos.map((photo, index) => (
            <span
              key={`${photo.name}-${index}`}
              className="rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-3 py-1"
            >
              📷 {photo.name}
            </span>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
              clientMessageIdRef.current = null;
              setPhotos([]);
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
            multiple
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              clientMessageIdRef.current = null;
              setPhotos(Array.from(event.target.files ?? []));
            }}
          />
        </label>

        <textarea
          ref={textareaRef}
          name="message"
          rows={1}
          enterKeyHint="enter"
          data-voice-assist="off"
          value={text}
          onChange={(event) => {
            clientMessageIdRef.current = null;
            setText(event.target.value);
          }}
          onKeyDown={(event) => {
            // No computador, Enter envia e Shift+Enter quebra linha.
            // No celular (tela de toque), Enter continua quebrando linha.
            const isTouch = window.matchMedia("(pointer: coarse)").matches;
            if (event.key === "Enter" && !event.shiftKey && !isTouch) {
              event.preventDefault();
              if (canSend) {
                event.currentTarget.form?.requestSubmit();
              }
            }
          }}
          placeholder="Escreva o que mediu ou observou..."
          className="max-h-[220px] min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
        />

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Enviar mensagem"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent-copper)] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-3 px-1">
        <button
          type="button"
          aria-pressed={deep}
          disabled={busy}
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
    </form>
  );
}

function PendingPreview({ state }: { state: SendState }) {
  if (state.phase !== "sending") {
    // Resposta pronta: a pagina esta recarregando com a versao salva.
    return (
      <div className="mb-3 justify-self-start rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-[var(--muted)]">
        Resposta pronta, atualizando…
      </div>
    );
  }

  return (
    <div className="mb-3 grid gap-2">
      {state.sentText || state.photoCount ? (
        <div className="max-w-[92%] self-end justify-self-end whitespace-pre-wrap rounded-2xl bg-[var(--accent-copper)] px-4 py-3 text-sm leading-6 text-white opacity-80">
          {state.sentText || "(foto)"}
          {state.sentText && state.photoCount ? `\n📷 ${state.photoCount} foto(s)` : ""}
        </div>
      ) : null}
      {state.reply ? (
        <div className="max-w-[92%] justify-self-start whitespace-pre-wrap rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm leading-6 text-[var(--foreground)]">
          {state.reply}
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-[var(--accent-copper)] align-middle" />
        </div>
      ) : (
        <div className="flex items-center gap-3 justify-self-start rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm text-[var(--muted)]">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-copper)] [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-copper)] [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-copper)]" />
          </span>
          {state.activity || "A IA está analisando o caso…"}
        </div>
      )}
    </div>
  );
}
