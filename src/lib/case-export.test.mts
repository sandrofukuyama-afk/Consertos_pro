import assert from "node:assert/strict";
import test from "node:test";

import { buildCaseExportFileName, buildCaseExportMarkdown } from "./case-export.ts";

const detail = {
  id: "857c806d-0000-0000-0000-000000000000",
  label: "Dell Inspiron 15 7559 (DA0AM9MB8D0)",
  category: "Notebook",
  manufacturer: "Dell",
  model: "Inspiron 15 7559",
  serialNumber: "",
  status: "Ativo",
  summary: "Liga sozinho ao conectar a fonte.",
  initialReport: "dell inspiron 15-7559 rev d, não dá imagem",
  physicalNotes: "",
  equipmentDetails: [{ label: "Placa", value: "DA0AM9MB8D0" }],
  resolvedCase: null,
  measurements: [
    {
      id: "m1",
      measurementType: "Tensao",
      pointLabel: "PU4 | pino 1",
      measuredValue: "0 V",
      expectedValue: "1,2 V",
      tolerance: "",
      context: "fonte plugada,\nsem ligar",
      isOutOfRange: true,
      linkedTestId: null,
      linkedTestName: null,
      boardLabel: "",
      measuredAt: "há 2 dias",
      technician: "Sandro",
    },
  ],
  hypotheses: [
    { id: "h1", title: "PU4 sem enable", description: "Regulador da DDR.", status: "Ativa", confidence: "0.6", evidence: "0 V no pino 1.", createdAt: "" },
  ],
  chatMessages: [
    { id: "c1", role: "user" as const, text: "deu 0V no PU4", createdAt: "há 2 dias", modelName: null, costUsd: null, agentActions: [], sources: [], photos: [] },
    { id: "c2", role: "assistant" as const, text: "Meça o EN do PU4.", createdAt: "há 2 dias", modelName: "claude-opus-5-5", costUsd: 0.1, agentActions: [], sources: [], photos: [] },
  ],
};

test("gera o Markdown com instrucoes, arquivos, medicoes e conversa", () => {
  const markdown = buildCaseExportMarkdown({
    detail,
    files: [
      { title: "AM9.brd", documentType: "Boardview BRD", association: "DA0AM9MB8D0", url: "https://x.supabase.co/sign/a" },
      { title: "AM9.pdf", documentType: "Esquema", association: "DA0AM9MB8D0", url: null },
    ],
    appUrl: "https://consertos-pro.vercel.app",
    generatedAt: new Date("2026-11-12T03:00:00Z"),
    linkValidityDays: 7,
  });

  assert.match(markdown, /^# Caso de bancada: Dell Inspiron 15 7559/);
  assert.match(markdown, /## Instruções para o Claude Code/);
  assert.match(markdown, /https:\/\/consertos-pro\.vercel\.app\/diagnosticos\/857c806d/);
  assert.match(markdown, /\*\*AM9\.brd\*\* — Boardview BRD, DA0AM9MB8D0: \[baixar\]\(https:\/\/x\.supabase\.co\/sign\/a\)/);
  assert.match(markdown, /\*\*AM9\.pdf\*\*.*link indisponível/);
  // Celula de tabela sem quebra de linha e com | escapado.
  assert.match(markdown, /\| PU4 \\\| pino 1 \| 0 V \| 1,2 V \| sim \| fonte plugada, sem ligar \| há 2 dias \|/);
  assert.match(markdown, /### Técnico — há 2 dias\n\ndeu 0V no PU4/);
  assert.match(markdown, /### IA — há 2 dias\n\nMeça o EN do PU4\./);
  assert.doesNotMatch(markdown, /Série:/);
});

test("nome do arquivo sem acento nem espaco", () => {
  assert.equal(buildCaseExportFileName(detail), "caso-dell-inspiron-15-7559-da0am9mb8d0-857c806d.md");
  assert.equal(
    buildCaseExportFileName({ id: "abcdef123", label: "Placa de vídeo RTX 3060 ç", category: "Placa de vídeo", initialReport: "" }),
    "caso-placa-de-video-rtx-3060-c-abcdef12.md",
  );
});

test("caso sem modelo usa o aparelho do comeco do relato", () => {
  const semModelo = {
    id: "61a704c2-0000",
    label: "Nao classificado",
    category: "Nao classificado",
    initialReport: "iPhone 14 problemas com a camera frontal , nao funciona",
  };
  assert.equal(buildCaseExportFileName(semModelo), "caso-iphone-14-61a704c2.md");
  assert.equal(
    buildCaseExportFileName({ ...semModelo, label: "Dell Notebook", category: "Notebook", initialReport: "Dell Inspiron 5565, não liga" }),
    "caso-dell-inspiron-5565-61a704c2.md",
  );
  assert.equal(
    buildCaseExportFileName({ ...semModelo, initialReport: "" }),
    "caso-nao-classificado-61a704c2.md",
  );
});
