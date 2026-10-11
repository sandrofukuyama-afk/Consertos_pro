import type { ReactNode } from "react";

// Renderizador minimo para as respostas do agente: paragrafos, listas
// numeradas/com marcador, **negrito**, *italico* e `codigo`. Evita depender de
// uma biblioteca de markdown so para o chat.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${index++}`;

    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-[var(--foreground)]">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-[var(--background)] px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

type Block =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "list"; ordered: boolean; items: Array<{ text: string; children: string[] }> };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  const flush = () => {
    if (current) {
      blocks.push(current);
      current = null;
    }
  };

  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flush();
      continue;
    }

    const ordered = /^\s{0,2}(\d+)[.)]\s+(.*)$/.exec(line);
    const bullet = /^\s{0,2}[-•*]\s+(.*)$/.exec(line);
    const nested = /^\s{3,}[-•*]\s+(.*)$/.exec(line);

    if (nested && current?.kind === "list" && current.items.length) {
      current.items[current.items.length - 1].children.push(nested[1]);
      continue;
    }

    if (ordered || bullet) {
      const isOrdered = Boolean(ordered);
      const itemText = ordered ? ordered[2] : bullet![1];

      if (current?.kind !== "list" || current.ordered !== isOrdered) {
        flush();
        current = { kind: "list", ordered: isOrdered, items: [] };
      }

      current.items.push({ text: itemText, children: [] });
      continue;
    }

    if (current?.kind === "list") {
      // Linha solta logo apos um item continua o item.
      current.items[current.items.length - 1].text += ` ${line.trim()}`;
      continue;
    }

    if (current?.kind !== "paragraph") {
      flush();
      current = { kind: "paragraph", lines: [] };
    }

    current.lines.push(line.trim());
  }

  flush();
  return blocks;
}

export function ChatMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        if (block.kind === "paragraph") {
          return (
            <p key={blockIndex}>
              {block.lines.map((line, lineIndex) => (
                <span key={lineIndex}>
                  {lineIndex > 0 ? <br /> : null}
                  {renderInline(line, `${blockIndex}-${lineIndex}`)}
                </span>
              ))}
            </p>
          );
        }

        const ListTag = block.ordered ? "ol" : "ul";

        return (
          <ListTag
            key={blockIndex}
            className={`space-y-1.5 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                {renderInline(item.text, `${blockIndex}-${itemIndex}`)}
                {item.children.length ? (
                  <ul className="mt-1 list-[circle] space-y-1 pl-5">
                    {item.children.map((child, childIndex) => (
                      <li key={childIndex}>
                        {renderInline(child, `${blockIndex}-${itemIndex}-${childIndex}`)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}
