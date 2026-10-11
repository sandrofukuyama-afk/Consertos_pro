"use client";

import { type ReactNode, useEffect, useRef } from "react";

type ChatScrollAreaProps = {
  messageCount: number;
  className?: string;
  children: ReactNode;
};

// Mantem a conversa rolada ate a mensagem mais recente, como num chat comum.
export function ChatScrollArea({ messageCount, className, children }: ChatScrollAreaProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    if (element.scrollHeight > element.clientHeight + 1) {
      // Computador: a conversa tem rolagem propria.
      element.scrollTop = element.scrollHeight;
    } else if (messageCount > 0) {
      // Celular: a pagina inteira rola; leva a ultima mensagem para a vista,
      // acima da caixa de mensagem fixa.
      element.lastElementChild?.scrollIntoView({ block: "end" });
    }
  }, [messageCount]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
