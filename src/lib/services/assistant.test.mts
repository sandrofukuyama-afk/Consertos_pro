import assert from "node:assert/strict";
import test from "node:test";

import type { AssistantStructuredResponse, SemanticMatchResult } from "@/types/domain";
import {
  buildBenchComponentsToMeasure,
  buildBenchRelatedLines,
  buildStructuredResponseForTest,
  type DiagnosticAssistantContext,
} from "@/lib/services/assistant";
import { extractTechnicalSearchTermsForTest } from "@/lib/services/assistant-technical-context";

function createBaseContext(): DiagnosticAssistantContext {
  return {
    id: "diag-1",
    label: "MacBook Pro A1706",
    summary: "Nao liga, sem consumo ao pressionar power.",
    initialReport: "Nao liga. Entrada com 20V. Suspeita em PP3V3_G3H e U6990.",
    category: "Notebook",
    manufacturer: "Apple",
    model: "A1706",
    physicalNotes: "Sem oxidacao aparente.",
    equipmentDetails: [
      { label: "Alimentacao", value: "20V presente" },
      { label: "Liga", value: "Nao" },
      { label: "Condicao da tela", value: "Sem imagem" },
    ],
    symptoms: [
      {
        name: "Nao liga",
        severity: "high",
        isPrimary: true,
        group: "power",
        notes: "Sem consumo ao pressionar power",
      },
    ],
    tests: [
      {
        testId: "test-1",
        testName: "Medir tensoes always",
        testGroup: "power",
        resultStatus: "failed",
        stepOrder: 1,
        procedureNotes: "Mediu PP3V3_G3H e PPBUS_G3H",
        expectedResult: "3.3V e 12.3V",
        actualResult: "PP3V3_G3H em 0V",
        conclusion: "Linha 3V3 ausente",
      },
    ],
    measurements: [
      {
        measurementType: "voltage",
        pointLabel: "PP3V3_G3H",
        measuredValueNumeric: 0,
        measuredValueText: "0V",
        expectedValueText: "3.3V",
        unit: "V",
        context: "Standby com carregador",
        toleranceText: null,
        observation: "Sem consumo",
        inferredTerms: ["PP3V3_G3H", "3.3V"],
      },
      {
        measurementType: "voltage",
        pointLabel: "PPBUS_G3H",
        measuredValueNumeric: 12.28,
        measuredValueText: "12.28V",
        expectedValueText: "~12.3V",
        unit: "V",
        context: "Standby com carregador",
        toleranceText: null,
        observation: "Linha principal presente",
        inferredTerms: ["PPBUS_G3H", "12.3V"],
      },
    ],
    hypotheses: [
      {
        title: "Falha na geracao de 3V3 always",
        description: "Possivel problema no regulador da linha G3H",
        evidenceSummary: "PP3V3_G3H zerada com entrada presente",
        confidenceScore: 0.74,
        status: "open",
      },
    ],
    technicalAssets: [
      {
        id: "asset-brd",
        title: "820-00239.brd",
        assetType: "boardview",
        fileFormat: "brd",
        boardName: "820-00239",
        modelName: "A1706",
      },
      {
        id: "asset-pdf",
        title: "820-00239.pdf",
        assetType: "schematic_pdf",
        fileFormat: "pdf",
        boardName: "820-00239",
        modelName: "A1706",
      },
    ],
    recentAssistantHistory: [
      {
        role: "user",
        summary: "Quero saber por onde comecar.",
        createdAt: "2026-08-12T10:00:00.000Z",
      },
      {
        role: "assistant",
        summary: "Medir PPBUS_G3H e PP3V3_G3H antes de suspeitar de BIOS.",
        createdAt: "2026-08-12T10:01:00.000Z",
      },
    ],
    attachments: [
      {
        title: "Foto da placa",
        description: "Vista geral",
        summary: "Sem oxidacao visivel perto do U6990",
      },
    ],
    benchPrompt: "Nao liga; entrada 20V; PP3V3_G3H em 0V; suspeita em U6990.",
    technicalContextSummary: "Boardview encontrou U6990 e a net PP3V3_G3H. Esquema mostra PP3V3_G3H na pagina 12.",
  };
}

function createTechnicalContext(): NonNullable<AssistantStructuredResponse["technicalContext"]> {
  return {
    userPrompt: "Nao liga; entrada 20V; PP3V3_G3H em 0V; suspeita em U6990.",
    searchTerms: ["PP3V3_G3H", "U6990", "PPBUS_G3H", "20V"],
    boardview: {
      assetId: "asset-brd",
      assetTitle: "820-00239.brd",
      openLabHref: "/boardview/lab?diagnostic_id=diag-1&boardview_asset_id=asset-brd",
      results: [
        {
          kind: "component",
          term: "U6990",
          title: "U6990",
          subtitle: "Regulador 3V3",
          details: ["Nets ligadas: PP3V3_G3H, PPBUS_G3H", "Pad A1 perto de C6991"],
          openLabHref: "/boardview/lab?diagnostic_id=diag-1&boardview_asset_id=asset-brd&component=U6990",
          locationSummary: "Lado top perto da bobina L6995",
          relatedNet: "PP3V3_G3H",
          coordinateHint: "Pad A1 em 1200 mil x 845 mil",
        },
      ],
    },
    schematic: {
      assetId: "asset-pdf",
      assetTitle: "820-00239.pdf",
      openLabHref: "/boardview/lab?diagnostic_id=diag-1&schematic_asset_id=asset-pdf",
      matches: [
        {
          term: "PP3V3_G3H",
          pageNumber: 12,
          occurrences: 2,
          excerpt: "PP3V3_G3H sai de U6990 e alimenta sinais always.",
          openLabHref: "/boardview/lab?diagnostic_id=diag-1&schematic_asset_id=asset-pdf&page=12&q=PP3V3_G3H",
          referenceHint: "Pagina 12",
        },
      ],
    },
    similarCases: [],
    documentFindings: [],
    measurementContext: [],
    diagnosticHistory: [],
    limitations: [],
  };
}

test("extractTechnicalSearchTermsForTest combines prompt and history sources", () => {
  const terms = extractTechnicalSearchTermsForTest({
    prompt: "Nao liga; suspeita em U6990",
    initialReport: "Entrada 20V e PP3V3_G3H em 0V",
    symptoms: ["sem imagem", "consumo alto"],
    measurements: ["PPBUS_G3H 12.28V", "SMC_RESET_L 3.3V"],
    hypotheses: ["possivel curto na S5"],
    tests: ["medir U6990 e C6991"],
    assetNames: ["820-00239.brd", "820-00239.pdf"],
  });

  assert.deepEqual(
    terms.slice(0, 8),
    ["U6990", "PP3V3_G3H", "PPBUS_G3H", "SMC_RESET_L", "20V", "SEM_IMAGEM", "CONSUMO_ALTO", "S5"],
  );
});

test("bench helpers use measurements and boardview findings", () => {
  const context = createBaseContext();
  const technicalContext = createTechnicalContext();

  const relatedLines = buildBenchRelatedLines(context, technicalContext);
  const components = buildBenchComponentsToMeasure(context, technicalContext);

  assert.equal(relatedLines[0]?.name, "PP3V3_G3H");
  assert.match(relatedLines[0]?.note ?? "", /0V|Sem consumo/);
  assert.equal(components[0]?.reference, "U6990");
  assert.match(components[0]?.measurementPoint ?? "", /Pad A1|L6995|Regulador/);
});

test("buildStructuredResponseForTest returns sources and ordered test sequence", async () => {
  const context = createBaseContext();
  const technicalContext = createTechnicalContext();
  const similarCases: SemanticMatchResult[] = [
    {
      id: "case-1",
      title: "Caso semelhante de 3V3 always",
      subtitle: "Notebook nao liga",
      excerpt: "PP3V3_G3H zerada por falha no regulador.",
      href: "/diagnosticos/case-1",
      sourceType: "diagnostic",
      similarityLabel: "91%",
    },
  ];
  const relatedDocuments: SemanticMatchResult[] = [
    {
      id: "doc-1",
      title: "Esquema 820-00239",
      subtitle: "Documento tecnico relacionado",
      excerpt: "Pagina 12 contem PP3V3_G3H e U6990.",
      href: "/docs/doc-1",
      sourceType: "technical_document",
      similarityLabel: "88%",
    },
  ];

  const payload = await buildStructuredResponseForTest({
    context,
    similarCases,
    relatedDocuments,
    availableTests: [{ id: "test-2", name: "Verificar curto na linha", group: "power" }],
    technicalContext,
  });

  assert.ok(payload.structured.recommendedTestSequence?.length);
  assert.ok(payload.structured.sourcesUsed?.length);
  assert.ok(payload.structured.whereToOpen?.length);
  assert.ok(payload.structured.testPoints?.length);
  assert.ok(payload.structured.expectedVoltages?.length);
  assert.equal(payload.structured.probableSection, payload.structured.probableArea);
});

test("buildStructuredResponseForTest reports fallback provider when OpenAI is unavailable", async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const payload = await buildStructuredResponseForTest({
      context: createBaseContext(),
      technicalContext: createTechnicalContext(),
    });

    assert.equal(payload.modelName, "heuristic-v1");
    assert.equal(payload.narrativeProvider, "Modo local (fallback heuristico)");
    assert.equal(payload.fallbackUsed, true);
  } finally {
    if (previous) {
      process.env.OPENAI_API_KEY = previous;
    }
  }
});
