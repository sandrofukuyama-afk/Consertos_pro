export function formatRelativeTime(value: string | null) {
  if (!value) {
    return "agora";
  }

  const target = new Date(value);
  const diffInMinutes = Math.round((Date.now() - target.getTime()) / 60000);

  if (Number.isNaN(diffInMinutes) || diffInMinutes < 1) {
    return "agora";
  }

  if (diffInMinutes < 60) {
    return `há ${diffInMinutes} min`;
  }

  const diffInHours = Math.round(diffInMinutes / 60);

  if (diffInHours < 24) {
    return `há ${diffInHours} h`;
  }

  const diffInDays = Math.round(diffInHours / 24);
  return `há ${diffInDays} d`;
}

export function extractFirstSentence(value: string | null | undefined) {
  if (!value) {
    return "Sem detalhe registrado";
  }

  return value.split(".")[0]?.trim() || value;
}

const PROVIDER_LABELS: Record<string, string> = {
  "text-embedding-3-small": "IA externa (OpenAI)",
  "hashing-v1": "Modo local (sem IA externa)",
  "gpt-4o-mini": "IA externa (OpenAI)",
  "heuristic-v1": "Modo local (sem IA externa)",
  "assistant-v1": "Padrão",
};

export function formatProviderLabel(value: string) {
  return PROVIDER_LABELS[value] ?? value;
}

/** Limite padrao de gasto da IA por caso (US$) quando o caso nao tem um proprio. So avisa, nao bloqueia. */
export const DEFAULT_CHAT_COST_LIMIT_USD = 3;

/** A partir dessa fracao do limite o chat mostra o aviso "perto do limite". */
export const CHAT_COST_WARNING_RATIO = 0.8;

/** Valor em dolar no formato brasileiro (ex.: "US$ 0,09"); abaixo de 1 centavo vira "< US$ 0,01". */
export function formatUsd(value: number) {
  if (value > 0 && value < 0.01) {
    return "< US$ 0,01";
  }
  return `US$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
