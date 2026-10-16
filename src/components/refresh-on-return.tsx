"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// No app instalado no iPhone nao ha botao de recarregar nem "puxar para
// atualizar": ao voltar para o app o iOS mostra a tela como ficou, e um caso
// aberto em outro PC nao aparecia. Busca os dados de novo quando o app volta
// para a frente e, se intervalMs for passado, de tempos em tempos enquanto a
// tela estiver visivel. router.refresh() mantem o que esta digitado nos campos.
const MIN_GAP_MS = 10_000;

export function RefreshOnReturn({ intervalMs }: { intervalMs?: number }) {
  const router = useRouter();
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    lastRefreshRef.current = Date.now();

    function refresh() {
      if (document.visibilityState !== "visible" || Date.now() - lastRefreshRef.current < MIN_GAP_MS) {
        return;
      }
      lastRefreshRef.current = Date.now();
      router.refresh();
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        refresh();
      }
    }

    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", handlePageShow);
    const timer = intervalMs ? window.setInterval(refresh, intervalMs) : null;

    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", handlePageShow);
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [intervalMs, router]);

  return null;
}
