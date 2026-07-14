"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

const STORAGE_KEY = "consertospro-install-prompt-dismissed";

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    if (window.matchMedia("(display-mode: standalone)").matches) {
      return true;
    }

    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setIsDismissed(false);
    };

    const handleInstalled = () => {
      setInstallEvent(null);
      setIsDismissed(true);
      window.localStorage.setItem(STORAGE_KEY, "true");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!installEvent || isDismissed) {
    return null;
  }

  const dismissPrompt = () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setIsDismissed(true);
  };

  const installApp = async () => {
    await installEvent.prompt();
    const choice = await installEvent.userChoice;

    if (choice.outcome === "accepted") {
      setInstallEvent(null);
      setIsDismissed(true);
      return;
    }

    setIsDismissed(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-22 z-50 md:inset-x-auto md:right-6 md:bottom-6 md:w-[360px]">
      <section className="rounded-[28px] border border-[rgba(184,109,60,0.34)] bg-[rgba(16,13,11,0.96)] p-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[rgba(255,245,236,0.58)]">
          Instalar aplicativo
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-heading)] text-xl font-semibold tracking-tight">
          Leve o ConsertosPro para a bancada
        </h2>
        <p className="mt-2 text-sm leading-6 text-[rgba(255,245,236,0.76)]">
          Instale o app para abrir em tela cheia, fixar no aparelho e ganhar acesso mais rapido no dia a dia.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={installApp}
            className="rounded-full bg-[var(--accent-copper)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a95f31]"
          >
            Instalar
          </button>
          <button
            type="button"
            onClick={dismissPrompt}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-[rgba(255,245,236,0.76)] hover:bg-white/5"
          >
            Agora nao
          </button>
        </div>
      </section>
    </div>
  );
}
