"use client";

import { useMemo, useState } from "react";

import {
  analyzeAttachmentImageAction,
  extractAttachmentComponentRefAction,
} from "@/app/actions";
import { BoardAnnotator } from "@/components/board-annotator";
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

type ReferenceMeasurementLookup = {
  id: string;
  componentRef: string;
  measurementPoint: string;
  expectedValue: string;
  condition: string;
  notes: string | null;
};

type AttachmentCardProps = {
  item: AttachmentItem;
  diagnosticId: string;
  referenceMeasurements: ReferenceMeasurementLookup[];
};

function normalizeComponentRef(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function AttachmentCard({
  item,
  diagnosticId,
  referenceMeasurements,
}: AttachmentCardProps) {
  const [isAnnotatorOpen, setIsAnnotatorOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReadingReference, setIsReadingReference] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<{
    componentRef: string | null;
    confidence: string;
    rationale: string;
  } | null>(null);

  const handleAiAnalysis = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("diagnostic_id", diagnosticId);
      formData.append("attachment_id", item.id);
      await analyzeAttachmentImageAction(formData);
    } catch (error) {
      console.error("Erro na análise:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleComponentOcr = async () => {
    setIsReadingReference(true);
    setOcrError(null);

    try {
      const result = await extractAttachmentComponentRefAction(diagnosticId, item.id);
      setOcrResult(result);
    } catch (error) {
      setOcrError(
        error instanceof Error ? error.message : "Falha ao ler a serigrafia da imagem.",
      );
    } finally {
      setIsReadingReference(false);
    }
  };

  const matchedMeasurements = useMemo(() => {
    if (!ocrResult?.componentRef) {
      return [];
    }

    const normalizedRef = normalizeComponentRef(ocrResult.componentRef);
    return referenceMeasurements.filter(
      (measurement) => normalizeComponentRef(measurement.componentRef) === normalizedRef,
    );
  }, [ocrResult, referenceMeasurements]);

  const isImage = item.mimeType.startsWith("image/");

  return (
    <div className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--background)] p-5 text-white shadow-inner">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{item.title}</p>
          {item.description ? (
            <p className="mt-1 text-sm text-[rgba(255,245,236,0.7)]">{item.description}</p>
          ) : null}
          <p className="mt-2 text-xs text-[rgba(255,245,236,0.5)]">
            {item.attachmentType} • {item.uploadedAt}
          </p>
        </div>
        {item.signedUrl && !isImage ? (
          <a
            href={item.signedUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            Download
          </a>
        ) : null}
      </div>

      {isImage && item.signedUrl ? (
        <div className="mt-4">
          <div className="relative inline-block max-w-full overflow-hidden rounded-[18px] border border-white/10 bg-black/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.signedUrl}
              alt={item.title}
              className="max-h-[300px] w-auto object-contain select-none"
            />
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
                  className="group absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-md"
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                >
                  <span className={`block h-full w-full rounded-full ${colorBg}`} />
                  <div className="absolute bottom-5 left-1/2 z-10 hidden w-40 -translate-x-1/2 rounded-lg border border-white/10 bg-black/90 p-2 text-center text-[10px] leading-normal text-white shadow-lg group-hover:block">
                    {pin.note}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsAnnotatorOpen(true)}
              className="rounded-full bg-[var(--accent-copper)] px-4 py-2 text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-98"
            >
              Anotar placa ({item.annotations.length})
            </button>
            <button
              type="button"
              onClick={handleComponentOcr}
              disabled={isReadingReference}
              className="rounded-full border border-[var(--accent-amber)]/40 px-4 py-2 text-xs font-semibold text-[var(--accent-amber)] transition hover:bg-[var(--accent-amber)]/5 disabled:opacity-50"
            >
              {isReadingReference ? "Lendo serigrafia..." : "Identificar componente"}
            </button>
            <a
              href={item.signedUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
            >
              Abrir imagem cheia
            </a>
          </div>
        </div>
      ) : null}

      {isImage ? (
        <div className="mt-4">
          {item.imageAnalysis ? (
            <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface-soft)] p-4 text-xs text-[rgba(255,245,236,0.85)]">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent-teal)]">
                Análise de imagem por IA • confiança {item.imageAnalysis.confidence} •{" "}
                {item.imageAnalysis.analyzedAt}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {item.imageAnalysis.observations.map((observation) => (
                  <li key={observation}>{observation}</li>
                ))}
              </ul>
              {item.imageAnalysis.suspectedIssues.length ? (
                <p className="mt-2 font-medium text-[var(--danger)]">
                  Suspeitas: {item.imageAnalysis.suspectedIssues.join("; ")}
                </p>
              ) : null}
              {item.imageAnalysis.recommendation ? (
                <p className="mt-2 text-[rgba(255,245,236,0.6)]">
                  Recomendação: {item.imageAnalysis.recommendation}
                </p>
              ) : null}
            </div>
          ) : (
            <form onSubmit={handleAiAnalysis}>
              <button
                type="submit"
                disabled={isAnalyzing}
                className="rounded-full border border-[var(--accent-teal)]/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-teal)] transition hover:bg-[var(--accent-teal)]/5 disabled:opacity-50"
              >
                {isAnalyzing ? "Analisando..." : "Analisar imagem com IA"}
              </button>
            </form>
          )}
        </div>
      ) : null}

      {isImage ? (
        <div className="mt-4 rounded-[18px] border border-[var(--panel-border)] bg-[var(--card-surface-soft)] p-4 text-sm text-[rgba(255,245,236,0.85)]">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent-amber)]">
            OCR assistido de componente
          </p>
          <p className="mt-1 text-xs text-[rgba(255,245,236,0.62)]">
            Lê a serigrafia visível da foto e cruza com a base de medição desta placa.
          </p>

          {ocrError ? (
            <p className="mt-3 rounded-[14px] border border-[rgba(202,106,85,0.3)] bg-[rgba(202,106,85,0.08)] px-3 py-2 text-xs text-[var(--danger)]">
              {ocrError}
            </p>
          ) : null}

          {ocrResult ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-[16px] border border-white/8 bg-black/10 p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Leitura atual
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  {ocrResult.componentRef ?? "Sem referência confiável"}
                </p>
                <p className="mt-1 text-xs text-[rgba(255,245,236,0.62)]">
                  Confiança {ocrResult.confidence}
                </p>
                <p className="mt-2 text-xs leading-5 text-[rgba(255,245,236,0.72)]">
                  {ocrResult.rationale}
                </p>
              </div>

              {ocrResult.componentRef ? (
                matchedMeasurements.length ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-teal)]">
                      Medições de referência encontradas
                    </p>
                    {matchedMeasurements.map((measurement) => (
                      <div
                        key={measurement.id}
                        className="rounded-[16px] border border-[var(--panel-border)] bg-[var(--background)] p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">
                            {measurement.componentRef} • {measurement.measurementPoint}
                          </p>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase text-[rgba(255,245,236,0.62)]">
                            {measurement.condition}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--accent-teal)]">
                          Valor esperado: {measurement.expectedValue}
                        </p>
                        {measurement.notes ? (
                          <p className="mt-1 text-xs text-[rgba(255,245,236,0.62)]">
                            {measurement.notes}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-[16px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-3 py-3 text-xs text-[var(--muted)]">
                    A referência foi lida, mas ainda não existe medição cadastrada para{" "}
                    {ocrResult.componentRef} nesta placa.
                  </p>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {isAnnotatorOpen && item.signedUrl ? (
        <BoardAnnotator
          attachmentId={item.id}
          diagnosticId={diagnosticId}
          imageUrl={item.signedUrl}
          initialAnnotations={item.annotations}
          onClose={() => setIsAnnotatorOpen(false)}
        />
      ) : null}
    </div>
  );
}
