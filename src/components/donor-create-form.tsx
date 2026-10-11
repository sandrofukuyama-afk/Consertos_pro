"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { createDonorBoardAction, createDonorPhotoUploadUrlsAction } from "@/app/doadoras/actions";
import { createClient } from "@/lib/supabase/client";

const MAX_SIDE = 1600;

/** Reduz a foto no proprio aparelho (fotos de celular tem 4-8 MB). */
async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao preparar a foto."))), "image/jpeg", 0.85),
  );
}

type Result = Awaited<ReturnType<typeof createDonorBoardAction>>;

export function DonorCreateForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [boardCode, setBoardCode] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function submit() {
    setError(null);
    setResult(null);
    try {
      setBusy("Enviando fotos…");
      const uploads = files.length ? await createDonorPhotoUploadUrlsAction(files.length) : [];
      const storage = createClient().storage.from("diagnostic-attachments");
      for (const [index, upload] of uploads.entries()) {
        const blob = await shrinkPhoto(files[index]);
        const sent = await storage.uploadToSignedUrl(upload.path, upload.token, blob, { contentType: "image/jpeg" });
        if (sent.error) throw new Error(sent.error.message);
      }
      setBusy("Lendo a placa e indexando o esquema… (pode levar até 1 minuto)");
      const created = await createDonorBoardAction({ photoPaths: uploads.map((upload) => upload.path), boardCode, notes });
      setResult(created);
      setFiles([]);
      setBoardCode("");
      setNotes("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Falha ao cadastrar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-3">
      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-4 py-5 text-sm font-semibold text-[var(--foreground)] transition hover:border-[rgba(109,94,242,0.5)]">
        📷 {files.length ? `${files.length} foto(s) — trocar` : "Fotografar a placa (até 4 fotos)"}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 4))}
        />
      </label>
      <p className="text-xs text-[var(--muted)]">
        Fotografe de perto a serigrafia com o código da placa (ex.: LA-D801P, DA0…, 820-…) e a região dos CIs.
      </p>
      <input
        value={boardCode}
        onChange={(event) => setBoardCode(event.target.value)}
        placeholder="Código da placa (opcional — a IA tenta ler na foto)"
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      />
      <input
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Observação (opcional): ex.: sem chip de vídeo, conector quebrado"
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      />
      <button
        type="button"
        disabled={Boolean(busy) || (!files.length && !boardCode.trim())}
        onClick={() => void submit()}
        className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ?? "Cadastrar doadora"}
      </button>

      {error ? <p className="rounded-xl bg-[rgba(202,106,85,0.12)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}

      {result ? (
        <div className="rounded-2xl border border-[rgba(45,139,130,0.4)] bg-[rgba(45,139,130,0.08)] p-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-teal)]">Escreva na placa</p>
          <p className="mt-1 font-mono text-5xl font-bold tracking-wider text-[var(--foreground)]">{result.code}</p>
          <p className="mt-2 text-sm text-[var(--foreground)]">{result.title ?? "Placa sem código identificado"}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {result.indexStatus === "indexada"
              ? "Esquema indexado: os componentes já aparecem na busca."
              : result.indexStatus === "sem_esquema"
                ? "Sem esquema desta placa na biblioteca: a busca usa o que foi lido na foto."
                : "Não consegui indexar o esquema agora; tente reindexar na lista."}
          </p>
          {result.markings.length ? (
            <p className="mt-2 text-xs text-[var(--muted)]">Lido na foto: {result.markings.slice(0, 12).join(", ")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
