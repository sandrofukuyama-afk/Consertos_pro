"use client";

import Link from "next/link";

type ShortcutItem = {
  href: string;
  label: string;
};

export function CatalogShortcutLinks({
  title = "Não encontrou a opção?",
  items,
}: {
  title?: string;
  items: ShortcutItem[];
}) {
  return (
    <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full border border-[var(--accent-copper)]/30 px-3 py-1.5 text-xs font-semibold text-[var(--accent-copper)] transition hover:bg-[var(--accent-copper)]/10"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
