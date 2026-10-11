"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Enquanto houver leitura/gravacao em andamento, atualiza a tela sozinha.
export function BenchJobsAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [active, router]);

  return null;
}
