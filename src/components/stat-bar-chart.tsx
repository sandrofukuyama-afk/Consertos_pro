type StatBarChartItem = {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  valueLabel: string;
};

type StatBarChartProps = {
  items: StatBarChartItem[];
  accent?: "teal" | "copper";
  emptyLabel: string;
};

export function StatBarChart({ items, accent = "teal", emptyLabel }: StatBarChartProps) {
  if (!items.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
        {emptyLabel}
      </div>
    );
  }

  const maxValue = Math.max(...items.map((item) => item.value), 1);
  const barColor = accent === "teal" ? "var(--accent-teal)" : "var(--accent-copper)";

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.key}>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">{item.label}</p>
              {item.sublabel ? (
                <p className="text-xs text-[var(--muted)]">{item.sublabel}</p>
              ) : null}
            </div>
            <p className="shrink-0 font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              {item.valueLabel}
            </p>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--panel-border)]"
            role="img"
            aria-label={`${item.label}: ${item.valueLabel}`}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((item.value / maxValue) * 100, 4)}%`,
                backgroundColor: barColor,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

type StatusSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type StatusDistributionBarProps = {
  segments: StatusSegment[];
};

export function StatusDistributionBar({ segments }: StatusDistributionBarProps) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return (
      <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-[var(--background)] px-5 py-10 text-center text-sm text-[var(--muted)]">
        Ainda nao ha casos resolvidos suficientes para medir a distribuicao.
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {segments.map((segment) =>
          segment.value > 0 ? (
            <div
              key={segment.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${(segment.value / total) * 100}%`,
                backgroundColor: segment.color,
              }}
              role="img"
              aria-label={`${segment.label}: ${segment.value} de ${total}`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        {segments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
              aria-hidden="true"
            />
            <span className="text-[var(--foreground)]">{segment.label}</span>
            <span className="font-mono text-xs text-[var(--muted)]">
              {segment.value} ({Math.round((segment.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
