type StatusPillProps = {
  label: string;
};

const statusTone: Record<string, string> = {
  Ativo: "bg-[rgba(45,139,130,0.14)] text-[var(--accent-teal)]",
  "Aguardando teste": "bg-[rgba(184,109,60,0.14)] text-[var(--accent-copper)]",
  "Resolvido hoje": "bg-[rgba(216,166,84,0.18)] text-[var(--accent-amber)]",
  Aberta: "bg-[rgba(45,139,130,0.14)] text-[var(--accent-teal)]",
  Fortalecida: "bg-[rgba(184,109,60,0.14)] text-[var(--accent-copper)]",
  Descartada: "bg-[rgba(202,106,85,0.16)] text-[var(--danger)]",
};

export function StatusPill({ label }: StatusPillProps) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-tight ${
        statusTone[label] ?? "bg-[var(--card-surface)] text-[var(--foreground)]"
      }`}
    >
      {label}
    </span>
  );
}
