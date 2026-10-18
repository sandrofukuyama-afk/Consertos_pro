import { updateChatCostLimitAction } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { formatUsd } from "@/lib/utils";
import type { DiagnosticDetail } from "@/types/domain";

type ChatCost = DiagnosticDetail["chatCost"];

const LEVEL_STYLES: Record<ChatCost["level"], string> = {
  ok: "border-[var(--panel-border)] bg-[var(--background)] text-[var(--muted)]",
  near: "border-[rgba(216,166,84,0.5)] bg-[rgba(216,166,84,0.14)] text-[var(--accent-amber)]",
  over: "border-red-500/50 bg-red-500/12 text-red-500",
};

/** Etiqueta "Gasto no caso: US$ X de US$ Y" no topo do chat; tocar abre o campo do limite. */
export function ChatCostMeter({ diagnosticId, cost }: { diagnosticId: string; cost: ChatCost }) {
  return (
    <details className="group relative ml-2 inline-block align-middle">
      <summary
        className={`cursor-pointer list-none rounded-full border px-2 py-0.5 text-[11px] font-medium [&::-webkit-details-marker]:hidden ${LEVEL_STYLES[cost.level]}`}
        title={
          cost.repliesWithoutCost
            ? `Gasto estimado da IA neste caso. ${cost.repliesWithoutCost} resposta(s) antiga(s) sem custo registrado não entram na soma. Toque para mudar o limite.`
            : "Gasto estimado da IA neste caso (soma de todas as respostas). Toque para mudar o limite."
        }
      >
        {cost.level === "over" ? "⚠️ " : ""}
        Gasto no caso: {formatUsd(cost.totalUsd)}
        {cost.repliesWithoutCost ? "+" : ""} de {formatUsd(cost.limitUsd)}
      </summary>
      <div className="absolute left-0 z-40 mt-2 w-64 rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] p-3 text-xs font-normal text-[var(--foreground)] shadow-lg">
        <ChatCostLimitForm diagnosticId={diagnosticId} cost={cost} />
      </div>
    </details>
  );
}

/** Aviso acima do campo de mensagem quando o gasto chega perto do limite ou passa dele. */
export function ChatCostWarning({ diagnosticId, cost }: { diagnosticId: string; cost: ChatCost }) {
  if (cost.level === "ok") {
    return null;
  }

  const over = cost.level === "over";
  return (
    <div
      className={`mb-3 rounded-2xl border px-4 py-3 text-sm text-[var(--foreground)] ${
        over ? "border-red-500/40 bg-red-500/10" : "border-[rgba(216,166,84,0.4)] bg-[rgba(216,166,84,0.1)]"
      }`}
    >
      <p className="font-semibold">
        {over ? "⚠️ Limite de gasto da IA atingido" : "Gasto da IA perto do limite"}
      </p>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
        Este caso já gastou {formatUsd(cost.totalUsd)} de {formatUsd(cost.limitUsd)}
        {cost.limitIsDefault ? " (limite padrão)" : ""}.{" "}
        {over
          ? "Você ainda pode continuar: o app pede confirmação antes de cada mensagem."
          : "Ao passar do limite o app pede confirmação antes de enviar."}
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-semibold text-[var(--accent-copper)]">
          Mudar o limite deste caso
        </summary>
        <div className="mt-2">
          <ChatCostLimitForm diagnosticId={diagnosticId} cost={cost} />
        </div>
      </details>
    </div>
  );
}

function ChatCostLimitForm({ diagnosticId, cost }: { diagnosticId: string; cost: ChatCost }) {
  return (
    <form action={updateChatCostLimitAction} className="grid gap-2">
      <input type="hidden" name="diagnostic_id" value={diagnosticId} />
      <label className="grid gap-1">
        <span className="text-[var(--muted)]">Limite deste caso (US$)</span>
        <input
          name="limit_usd"
          inputMode="decimal"
          defaultValue={cost.limitIsDefault ? "" : String(cost.limitUsd).replace(".", ",")}
          placeholder={`Padrão: ${String(cost.limitUsd).replace(".", ",")}`}
          className="rounded-xl border border-[var(--panel-border)] bg-[var(--background)] px-3 py-2 text-base text-[var(--foreground)]"
        />
      </label>
      <p className="text-[11px] leading-4 text-[var(--muted)]">
        Deixe vazio para usar o limite padrão. Passar do limite só avisa, não bloqueia.
      </p>
      <FormSubmitButton
        idleLabel="Salvar limite"
        pendingLabel="Salvando..."
        className="rounded-full bg-[var(--accent-copper)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      />
    </form>
  );
}
