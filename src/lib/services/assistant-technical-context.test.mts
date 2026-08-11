import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTechnicalContextEvidence,
  extractTechnicalSearchTermsForTest,
  summarizeTechnicalContextForAssistant,
} from "@/lib/services/assistant-technical-context";

test("extractTechnicalSearchTermsForTest keeps references, nets and quoted terms", () => {
  assert.deepEqual(
    extractTechnicalSearchTermsForTest(
      'procure "pp3v3_s5" perto do U1900 e da net PPBUS_G3H com C1009',
    ),
    ["PP3V3_S5", "U1900", "C1009", "PPBUS_G3H"],
  );
});

test("summarizeTechnicalContextForAssistant condenses boardview, schematic and limits", () => {
  const summary = summarizeTechnicalContextForAssistant({
    userPrompt: "onde medir PPBUS_G3H?",
    searchTerms: ["PPBUS_G3H"],
    boardview: {
      assetId: "asset-board",
      assetTitle: "820-00239.brd",
      openLabHref: "/boardview/lab?diagnostic_id=diag-1",
      results: [
        {
          kind: "net",
          term: "PPBUS_G3H",
          title: "PPBUS_G3H",
          subtitle: "Net com 12 pads",
          details: ["Componentes ligados: U7000, C1009", "Test points: TP100"],
          openLabHref: "/boardview/lab?diagnostic_id=diag-1&q=PPBUS_G3H",
        },
      ],
    },
    schematic: {
      assetId: "asset-pdf",
      assetTitle: "820-00239.pdf",
      openLabHref: "/boardview/lab?diagnostic_id=diag-1&view=schematic",
      matches: [
        {
          term: "PPBUS_G3H",
          pageNumber: 5,
          occurrences: 2,
          excerpt: "PPBUS_G3H sai do fusível F7000 e segue para U7000.",
          openLabHref: "/boardview/lab?diagnostic_id=diag-1&q=PPBUS_G3H&view=schematic",
        },
      ],
    },
    limitations: ["Use a medição real para confirmar antes de condenar o CI."],
  });

  assert.match(summary, /Boardview 820-00239\.brd/);
  assert.match(summary, /Esquema 820-00239\.pdf/);
  assert.match(summary, /Limitações:/);
});

test("buildTechnicalContextEvidence prioritizes concise technical breadcrumbs", () => {
  assert.deepEqual(
    buildTechnicalContextEvidence({
      userPrompt: "procure U1900",
      searchTerms: ["U1900"],
      boardview: {
        assetId: "asset-board",
        assetTitle: "820-00239.brd",
        openLabHref: "/boardview/lab?diagnostic_id=diag-1",
        results: [
          {
            kind: "component",
            term: "U1900",
            title: "U1900",
            subtitle: "ISL9239 charger",
            details: ["Nets ligadas: PPBUS_G3H"],
            openLabHref: "/boardview/lab?diagnostic_id=diag-1&q=U1900",
          },
        ],
      },
      schematic: {
        assetId: "asset-pdf",
        assetTitle: "820-00239.pdf",
        openLabHref: "/boardview/lab?diagnostic_id=diag-1&view=schematic",
        matches: [
          {
            term: "U1900",
            pageNumber: 12,
            occurrences: 1,
            excerpt: "U1900 charger controller.",
            openLabHref: "/boardview/lab?diagnostic_id=diag-1&q=U1900&view=schematic",
          },
        ],
      },
      limitations: ["Busca limitada a assets já associados."],
    }),
    [
      "Boardview: U1900 â€” ISL9239 charger.",
      "Esquema: U1900 na página 12.",
      "Limitação: Busca limitada a assets já associados.",
    ],
  );
});
