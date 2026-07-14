"use client";

import { useState } from "react";
import { saveAttachmentAnnotationsAction } from "@/app/actions";
import type { ComponentAnnotation } from "@/types/domain";

type BoardAnnotatorProps = {
  attachmentId: string;
  diagnosticId: string;
  imageUrl: string;
  initialAnnotations: ComponentAnnotation[];
  onClose: () => void;
};

export function BoardAnnotator({
  attachmentId,
  diagnosticId,
  imageUrl,
  initialAnnotations,
  onClose,
}: BoardAnnotatorProps) {
  const [pins, setPins] = useState<ComponentAnnotation[]>(initialAnnotations);
  const [tempPin, setTempPin] = useState<{ x: number; y: number; note: string; color: "red" | "yellow" | "green" } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isSaving) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 10000) / 100;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 10000) / 100;

    setTempPin({
      x,
      y,
      note: "",
      color: "red",
    });
  };

  const handleAddPin = () => {
    if (!tempPin || !tempPin.note.trim()) return;

    const newPin: ComponentAnnotation = {
      id: crypto.randomUUID(),
      ...tempPin,
    };

    setPins([...pins, newPin]);
    setTempPin(null);
  };

  const handleRemovePin = (id: string) => {
    setPins(pins.filter((pin) => pin.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await saveAttachmentAnnotationsAction(attachmentId, diagnosticId, pins);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro desconhecido ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-5xl flex-col rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-xl font-bold text-white">Anotar Placa de Circuito</h3>
            <p className="text-sm text-[rgba(230,228,245,0.6)]">
              Clique em qualquer ponto da placa na imagem para inserir uma anotação técnica.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
          >
            ✕"
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-xl bg-red-950/50 border border-red-500/30 p-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Canvas da Imagem */}
          <div className="flex flex-col items-center justify-center">
            <div
              className="relative cursor-crosshair overflow-hidden rounded-[20px] border border-white/10 bg-black/40"
              onClick={handleImageClick}
            >
              <img
                src={imageUrl}
                alt="Placa de circuito"
                className="max-h-[50vh] w-auto object-contain select-none"
                draggable={false}
              />

              {/* Renderização das marcações existentes */}
              {pins.map((pin) => {
                const colorBg =
                  pin.color === "red"
                    ? "bg-red-500 shadow-red-500/50"
                    : pin.color === "yellow"
                    ? "bg-amber-500 shadow-amber-500/50"
                    : "bg-emerald-500 shadow-emerald-500/50";

                return (
                  <div
                    key={pin.id}
                    className={`absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-[0_0_8px] transition-transform hover:scale-125 group`}
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                    title={pin.note}
                  >
                    <span className={`h-3.5 w-3.5 rounded-full border border-white ${colorBg}`} />
                    {/* Tooltip personalizado */}
                    <div className="absolute bottom-6 left-1/2 z-10 hidden w-48 -translate-x-1/2 rounded-lg bg-black/90 p-2 text-center text-xs leading-normal text-white group-hover:block border border-white/10">
                      {pin.note}
                    </div>
                  </div>
                );
              })}

              {/* Marcador temporário enquanto digita a anotação */}
              {tempPin && (
                <div
                  className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-ping items-center justify-center rounded-full bg-blue-500/80"
                  style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}
                />
              )}
            </div>
          </div>

          {/* Lateral de anotações */}
          <div className="flex flex-col gap-4">
            {/* Formulário do marcador temporário */}
            {tempPin ? (
              <div className="rounded-[22px] border border-[var(--accent-copper)]/30 bg-[rgba(109,94,242,0.08)] p-4">
                <h4 className="text-sm font-bold text-[var(--accent-copper)]">Novo Ponto Técnico</h4>
                <div className="mt-3">
                  <label className="text-xs text-[rgba(230,228,245,0.6)]">Nota do problema</label>
                  <input
                    type="text"
                    value={tempPin.note}
                    onChange={(e) => setTempPin({ ...tempPin, note: e.target.value })}
                    placeholder="Ex: Curto no capacitor C42"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent-copper)]"
                    autoFocus
                  />
                </div>

                <div className="mt-3">
                  <label className="text-xs text-[rgba(230,228,245,0.6)]">Cor da marcação</label>
                  <select
                    value={tempPin.color}
                    onChange={(e) => setTempPin({ ...tempPin, color: e.target.value as any })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent-copper)]"
                  >
                    <option value="red">Vermelho (Falha / Aquecimento)</option>
                    <option value="yellow">Amarelo (Atenção / Suspeito)</option>
                    <option value="green">Verde (Normal / Testado OK)</option>
                  </select>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleAddPin}
                    disabled={!tempPin.note.trim()}
                    className="flex-1 rounded-full bg-[var(--accent-copper)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Adicionar
                  </button>
                  <button
                    onClick={() => setTempPin(null)}
                    className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-[22px] border border-white/5 bg-white/5 p-4 text-center">
                <p className="text-sm text-[rgba(230,228,245,0.7)]">
                  Clique na placa para registrar um ponto de atenção.
                </p>
              </div>
            )}

            {/* Lista de marcações atuais */}
            <div className="flex-1">
              <h4 className="text-sm font-semibold border-b border-white/10 pb-2">Pontos Marcados ({pins.length})</h4>
              <ul className="mt-3 space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                {pins.map((pin) => {
                  const colorDot =
                    pin.color === "red"
                      ? "bg-red-500"
                      : pin.color === "yellow"
                      ? "bg-amber-500"
                      : "bg-emerald-500";

                  return (
                    <li
                      key={pin.id}
                      className="flex items-center justify-between rounded-xl bg-white/5 p-2.5 text-xs border border-white/5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorDot}`} />
                        <span className="truncate text-[rgba(230,228,245,0.9)]" title={pin.note}>
                          {pin.note}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemovePin(pin.id)}
                        className="text-red-400 hover:text-red-300 font-semibold px-2"
                      >
                        Remover
                      </button>
                    </li>
                  );
                })}
                {pins.length === 0 && (
                  <p className="text-center text-xs text-[rgba(230,228,245,0.4)] mt-4">
                    Nenhum ponto marcado nesta imagem.
                  </p>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-4">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition disabled:opacity-50"
          >
            Fechar sem salvar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-full bg-[var(--accent-copper)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50 shadow-lg shadow-[rgba(109,94,242,0.2)]"
          >
            {isSaving ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Salvando...
              </>
            ) : (
              "Salvar tudo"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
