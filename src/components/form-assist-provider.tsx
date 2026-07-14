"use client";

import { useEffect } from "react";

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
};

type SpeechRecognitionInstance = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const TEXT_INPUT_TYPES = new Set(["", "text", "search"]);
const TECHNICAL_FIELD_PATTERN =
  /(email|senha|password|serial|serie|c[oó]digo|code|ref|reference|component|componente|placa|board|bios|modelo|model|voltage|tens[aã]o|corrente|amp|ohm|resistance|capacitance|inductance|token|api|url|link|slug)/i;
const LONG_TEXT_HINT_PATTERN =
  /(relato|descri[cç][aã]o|observa[cç][aã]o|coment[aá]rio|comment|notes?|anota[cç][aã]o|report|problem|defeito|symptom|sintoma|query|busca|review|feedback|full.?name|nome|title|t[ií]tulo|cause|solution|rationale)/i;

function isTextualField(
  field: HTMLInputElement | HTMLTextAreaElement,
): field is HTMLInputElement | HTMLTextAreaElement {
  if (field instanceof HTMLTextAreaElement) {
    return true;
  }

  return TEXT_INPUT_TYPES.has(field.type);
}

function getFieldDescriptor(field: HTMLInputElement | HTMLTextAreaElement) {
  return [field.name, field.id, field.placeholder, field.getAttribute("aria-label")]
    .filter(Boolean)
    .join(" ");
}

function shouldEnableTextAssist(field: HTMLInputElement | HTMLTextAreaElement) {
  if (!isTextualField(field)) {
    return false;
  }

  if (field.dataset.formAssist === "off") {
    return false;
  }

  const descriptor = getFieldDescriptor(field);
  return !TECHNICAL_FIELD_PATTERN.test(descriptor);
}

function shouldEnableVoiceAssist(field: HTMLInputElement | HTMLTextAreaElement) {
  if (field.dataset.voiceAssist === "off") {
    return false;
  }

  if (field instanceof HTMLTextAreaElement) {
    return true;
  }

  if (!TEXT_INPUT_TYPES.has(field.type)) {
    return false;
  }

  const descriptor = getFieldDescriptor(field);
  return LONG_TEXT_HINT_PATTERN.test(descriptor) && !TECHNICAL_FIELD_PATTERN.test(descriptor);
}

function updateFieldValue(field: HTMLInputElement | HTMLTextAreaElement, transcript: string) {
  const cleanTranscript = transcript.trim();

  if (!cleanTranscript) {
    return;
  }

  const supportsSelection =
    typeof field.selectionStart === "number" && typeof field.selectionEnd === "number";

  if (!supportsSelection) {
    field.value = field.value ? `${field.value} ${cleanTranscript}` : cleanTranscript;
  } else {
    const selectionStart = field.selectionStart ?? field.value.length;
    const selectionEnd = field.selectionEnd ?? field.value.length;
    const before = field.value.slice(0, selectionStart);
    const after = field.value.slice(selectionEnd);
    const needsLeadingSpace = before.length > 0 && !before.endsWith(" ");
    const insertion = `${needsLeadingSpace ? " " : ""}${cleanTranscript}`;

    field.value = `${before}${insertion}${after}`;

    const cursorPosition = before.length + insertion.length;
    field.setSelectionRange(cursorPosition, cursorPosition);
  }

  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  field.focus();
}

export function FormAssistProvider() {
  useEffect(() => {
    const browserWindow = window as WindowWithSpeechRecognition;
    const SpeechRecognitionClass =
      browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;

    let recognition: SpeechRecognitionInstance | null = null;
    let activeField: HTMLInputElement | HTMLTextAreaElement | null = null;
    let activeButton: HTMLButtonElement | null = null;
    const stopListening = () => {
      if (recognition) {
        recognition.stop();
      }

      if (activeButton) {
        activeButton.dataset.listening = "false";
        activeButton.textContent = "Falar";
      }

      activeField = null;
      activeButton = null;
    };

    const startListening = (
      field: HTMLInputElement | HTMLTextAreaElement,
      button: HTMLButtonElement,
    ) => {
      if (!SpeechRecognitionClass) {
        return;
      }

      if (!recognition) {
        recognition = new SpeechRecognitionClass();
        recognition.lang = "pt-BR";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onresult = (event) => {
          const result = event.results[event.resultIndex];
          const transcript = result?.[0]?.transcript ?? "";

          if (activeField) {
            updateFieldValue(activeField, transcript);
          }
        };
        recognition.onend = () => {
          if (activeButton) {
            activeButton.dataset.listening = "false";
            activeButton.textContent = "Falar";
          }

          activeField = null;
          activeButton = null;
        };
        recognition.onerror = () => {
          stopListening();
        };
      }

      if (activeButton && activeButton !== button) {
        stopListening();
      }

      activeField = field;
      activeButton = button;
      button.dataset.listening = "true";
      button.textContent = "Ouvindo...";
      recognition.start();
    };

    const enhanceField = (field: Element) => {
      if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLTextAreaElement)) {
        return;
      }

      if (shouldEnableTextAssist(field)) {
        field.spellcheck = true;
        field.setAttribute("autocorrect", "on");
        field.setAttribute(
          "autocapitalize",
          field instanceof HTMLTextAreaElement ? "sentences" : "words",
        );
      }

      if (!SpeechRecognitionClass || !shouldEnableVoiceAssist(field)) {
        return;
      }

      if (field.dataset.voiceEnhanced === "true") {
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "form-assist-voice-button";
      button.textContent = "Falar";
      button.setAttribute("aria-label", "Ditado por voz para este campo");
      button.dataset.listening = "false";
      button.addEventListener("click", () => {
        if (button.dataset.listening === "true") {
          stopListening();
          return;
        }

        startListening(field, button);
      });

      field.insertAdjacentElement("afterend", button);
      field.dataset.voiceEnhanced = "true";
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      enhanceField(event.target);
    };

    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      stopListening();
    };
  }, []);

  return null;
}
