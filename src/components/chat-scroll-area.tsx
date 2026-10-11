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
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messageCount]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
