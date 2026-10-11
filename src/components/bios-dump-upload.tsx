"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { createBiosUploadUrlAction, registerBiosUploadAction } from "@/app/diagnosticos/[id]/bios-actions";
import { createClient } from "@/lib/supabase/client";

type BiosDumpUploadProps = {
  diagnosticId: string;
};

// Envia o dump direto ao Storage por link assinado (dumps passam do limite de
// 4,5 MB das funcoes da Vercel) e depois registra e analisa no servidor.
export function BiosDumpUpload({ diagnosticId }: BiosDumpUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"original" | "enviado">("original");
  const [status, setStatus] = useState<{ tone: "info" | "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setStatus({ tone: "info", text: `Enviando ${file.name}…` });
    try {
      const { path, token } = await createBiosUploadUrlAction(diagnosticId);
      const upload = await createClient()
        .storage.from("technical-assets")
        .uploadToSignedUrl(path, token, file, { contentType: "application/octet-stream" });
      if (upload.error) {
        throw new Error(upload.error.message);
      }
      setStatus({ tone: "info", text: "Analisando o dump…" });
      const result = await registerBiosUploadAction({ diagnosticId, path, fileName: file.name, kind });
      setStatus({
        tone: result.warnings.length ? "error" : "ok",
        text: [result.summary, ...result.warnings].join("\n"),
      });
      router.refresh();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Falha no envio." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as "original" | "enviado")}
          aria-label="Tipo do dump"
          className="rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-3 py-2 text-xs"
        >
          <option value="original">Dump original (antes do reparo)</option>
          <option value="enviado">Outro arquivo</option>
        </select>
        <label
          className={`inline-flex cursor-pointer items-center rounded-full border border-[var(--panel-border)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[rgba(109,94,242,0.45)] ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {busy ? "Enviando…" : "Enviar dump (.bin)"}
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
      </div>
      {status ? (
        <p
          className={`whitespace-pre-line rounded-xl px-3 py-2 text-xs ${
            status.tone === "error"
              ? "bg-[rgba(202,106,85,0.12)] text-[var(--danger)]"
              : status.tone === "ok"
                ? "bg-[rgba(45,139,130,0.12)] text-[var(--accent-teal)]"
                : "text-[var(--muted)]"
          }`}
        >
          {status.text}
        </p>
      ) : null}
    </div>
  );
}
