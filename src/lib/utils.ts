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
