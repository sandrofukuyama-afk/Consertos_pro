"use client";

import { useState } from "react";
import { BoardAnnotator } from "@/components/board-annotator";
import { analyzeAttachmentImageAction } from "@/app/actions";
import type { ComponentAnnotation } from "@/types/domain";

type AttachmentItem = {
  id: string;
  title: string;
  description: string;
  attachmentType: string;
  mimeType: string;
  uploadedAt: string;
  signedUrl: string | null;
  annotations: ComponentAnnotation[];
  imageAnalysis: {
    observations: string[];
    suspectedIssues: string[];
    confidence: string;
    recommendation: string;
    analyzedAt: string;
  } | null;
};

type AttachmentCardProps = {
  item: AttachmentItem;
  diagnosticId: string;
};

export function AttachmentCard({ item, diagnosticId }: AttachmentCardProps) {
  const [isAnnotatorOpen, setIsAnnotatorOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAiAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("diagnostic_id", diagnosticId);
      formData.append("attachment_id", item.id);
      await analyzeAttachmentImageAction(formData);
    } catch (error) {
      console.error("Erro na analise:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isImage = item.mimeType.startsWith("image/");

  return (
    <div className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-5 text-white shadow-inner">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{item.title}</p>
          {item.description && (
            <p className="mt-1 text-sm text-[rgba(255,245,236,0.7)]">{item.description}</p>
          )}
          <p className="mt-2 text-xs text-[rgba(255,245,236,0.5)]">
            {item.attachmentType} • {item.uploadedAt}
          </p>
        </div>
        {item.signedUrl && !isImage && (
          <a
            href={item.signedUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition"
          >
            Download
          </a>
        )}
      </div>

      {/* Visualização da imagem com marcadores posicionados */}
      {isImage && item.signedUrl && (
        <div className="mt-4">
          <div className="relative inline-block max-w-full overflow-hidden rounded-[18px] border border-white/10 bg-black/20">
            <img
              src={item.signedUrl}
              alt={item.title}
              className="max-h-[300px] w-auto object-contain select-none"
            />
            {/* Overlay dos pinos na miniatura */}
            {item.annotations.map((pin) => {
              const colorBg =
                pin.color === "red"
                  ? "bg-red-500 shadow-red-500/50"
                  : pin.color === "yellow"
                  ? "bg-amber-500 shadow-amber-500/50"
                  : "bg-emerald-500 shadow-emerald-500/50";

              return (
                <div
                  key={pin.id}
                  className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-md group"
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                >
                  <span className={`block h-full w-full rounded-full ${colorBg}`} />
                  {/* Tooltip ao passar o mouse */}
                  <div className="absolute bottom-5 left-1/2 z-10 hidden w-40 -translate-x-1/2 rounded-lg bg-black/90 p-2 text-center text-[10px] leading-normal text-white group-hover:block border border-white/10 shadow-lg">
                    {pin.note}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setIsAnnotatorOpen(true)}
              className="rounded-full bg-[var(--accent-copper)] px-4 py-2 text-xs font-semibold text-white hover:brightness-110 active:scale-98 transition-all"
            >
              Anotar placa ({item.annotations.length})
            </button>
            {item.signedUrl && (
              <a
                href={item.signedUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white hover:bg-white/5 transition"
              >
                Abrir imagem cheia
              </a>
            )}
          </div>
        </div>
      )}

      {/* Análise de IA */}
      {isImage && (
        <div className="mt-4">
          {item.imageAnalysis ? (
            <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface-soft)] p-4 text-xs text-[rgba(255,245,236,0.85)]">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent-teal)]">
                Análise de imagem por IA • confiança {item.imageAnalysis.confidence} • {item.imageAnalysis.analyzedAt}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {item.imageAnalysis.observations.map((observation) => (
                  <li key={observation}>{observation}</li>
                ))}
              </ul>
              {item.imageAnalysis.suspectedIssues.length ? (
                <p className="mt-2 text-[var(--danger)] font-medium">
                  Suspeitas: {item.imageAnalysis.suspectedIssues.join("; ")}
                </p>
              ) : null}
              {item.imageAnalysis.recommendation && (
                <p className="mt-2 text-[rgba(255,245,236,0.6)]">
                  Recomendação: {item.imageAnalysis.recommendation}
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleAiAnalysis}>
              <button
                type="submit"
                disabled={isAnalyzing}
                className="rounded-full border border-[var(--accent-teal)]/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-teal)] hover:bg-[var(--accent-teal)]/5 transition disabled:opacity-50"
              >
                {isAnalyzing ? "Analisando..." : "Analisar imagem com IA"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Modal de Anotação Interativa */}
      {isAnnotatorOpen && item.signedUrl && (
        <BoardAnnotator
          attachmentId={item.id}
          diagnosticId={diagnosticId}
          imageUrl={item.signedUrl}
          initialAnnotations={item.annotations}
          onClose={() => setIsAnnotatorOpen(false)}
        />
      )}
    </div>
  );
}
