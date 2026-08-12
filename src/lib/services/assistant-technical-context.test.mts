import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLabSearchHrefForTest,
  buildTechnicalContextEvidence,
  extractTechnicalSearchTermsForTest,
  searchAssistantTechnicalContext,
  selectPreferredAssetForTest,
  summarizeTechnicalContextForAssistant,
  type AssistantTechnicalContextSupabaseClient,
} from "@/lib/services/assistant-technical-context";

test("extractTechnicalSearchTermsForTest keeps references, nets and quoted terms", () => {
  assert.deepEqual(
    extractTechnicalSearchTermsForTest(
      'procure "pp3v3_s5" perto do U1900 e da net PPBUS_G3H com C1009',
    ),
    ["PP3V3_S5", "U1900", "C1009", "PPBUS_G3H"],
  );
});

test("summarizeTechnicalContextForAssistant condenses selected assets, findings and limits", () => {
  const summary = summarizeTechnicalContextForAssistant({
    userPrompt: "onde medir PPBUS_G3H?",
    searchTerms: ["PPBUS_G3H"],
    selectedAssets: {
      boardview: {
        assetId: "asset-board",
        assetTitle: "820-00239.brd",
        selectionReason: "associado diretamente à placa",
        attemptedBuckets: ["technical-assets"],
        downloadBucketUsed: "technical-assets",
        downloadStatus: "downloaded",
        warning: null,
      },
      schematic: {
        assetId: "asset-pdf",
        assetTitle: "820-00239.pdf",
        selectionReason: "associado ao modelo",
        attemptedBuckets: ["technical-assets"],
        downloadBucketUsed: "technical-assets",
        downloadStatus: "downloaded",
        warning: null,
      },
    },
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
          openLabHref: "/boardview/lab?diagnostic_id=diag-1&boardview_asset_id=asset-board&net=PPBUS_G3H",
        },
      ],
    },
    schematic: {
      assetId: "asset-pdf",
      assetTitle: "820-00239.pdf",
      openLabHref: "/boardview/lab?diagnostic_id=diag-1&schematic_asset_id=asset-pdf",
      matches: [
        {
          term: "PPBUS_G3H",
          pageNumber: 5,
          occurrences: 2,
          excerpt: "PPBUS_G3H sai do fusível F7000 e segue para U7000.",
          openLabHref: "/boardview/lab?diagnostic_id=diag-1&schematic_asset_id=asset-pdf&page=5",
        },
      ],
    },
    limitations: ["Use a medição real para confirmar antes de condenar o CI."],
  });

  assert.match(summary, /Boardview escolhido: 820-00239\.brd/);
  assert.match(summary, /Esquema escolhido: 820-00239\.pdf/);
  assert.match(summary, /Boardview 820-00239\.brd/);
  assert.match(summary, /Limitações:/);
});

test("buildTechnicalContextEvidence prioritizes concise technical breadcrumbs", () => {
  assert.deepEqual(
    buildTechnicalContextEvidence({
      userPrompt: "procure U1900",
      searchTerms: ["U1900"],
      selectedAssets: {
        boardview: {
          assetId: "asset-board",
          assetTitle: "820-00239.brd",
          selectionReason: "associado diretamente à placa",
          attemptedBuckets: ["technical-assets"],
          downloadBucketUsed: "technical-assets",
          downloadStatus: "downloaded",
          warning: null,
        },
        schematic: {
          assetId: "asset-pdf",
          assetTitle: "820-00239.pdf",
          selectionReason: "associado ao modelo",
          attemptedBuckets: ["technical-assets"],
          downloadBucketUsed: "technical-assets",
          downloadStatus: "downloaded",
          warning: null,
        },
      },
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
            openLabHref: "/boardview/lab?diagnostic_id=diag-1&boardview_asset_id=asset-board&component=U1900",
          },
        ],
      },
      schematic: {
        assetId: "asset-pdf",
        assetTitle: "820-00239.pdf",
        openLabHref: "/boardview/lab?diagnostic_id=diag-1&schematic_asset_id=asset-pdf",
        matches: [
          {
            term: "U1900",
            pageNumber: 12,
            occurrences: 1,
            excerpt: "U1900 charger controller.",
            openLabHref: "/boardview/lab?diagnostic_id=diag-1&schematic_asset_id=asset-pdf&page=12",
          },
        ],
      },
      limitations: ["Busca limitada a assets já associados."],
    }),
    [
      "Asset boardview: 820-00239.brd.",
      "Asset esquema: 820-00239.pdf.",
      "Boardview: U1900 - ISL9239 charger.",
      "Esquema: U1900 na página 12.",
      "Limitação: Busca limitada a assets já associados.",
    ],
  );
});

test("searchAssistantTechnicalContext uses diagnostic context even when prompt is empty", async () => {
  const mockSupabase: AssistantTechnicalContextSupabaseClient = {
    from(table) {
      return {
        select() {
          if (table === "diagnostics") {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        id: "diag-1",
                        equipment_model_id: "model-1",
                        diagnostic_boards: [{ board_id: "board-1" }],
                      },
                      error: null,
                    };
                  },
                };
              },
              async or() {
                return { data: [], error: null };
              },
            };
          }

          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: null, error: null };
                },
              };
            },
            async or() {
              return {
                data: [
                  {
                    board_id: "board-1",
                    equipment_model_id: "model-1",
                    boards: { board_code: "820-00239" },
                    equipment_models: { model_name: "A1706" },
                    technical_assets: {
                      id: "asset-board",
                      original_filename: "820-00239.brd",
                      asset_type: "boardview",
                      file_format: "brd",
                      storage_bucket: "technical-assets",
                      storage_path: "board/path",
                      created_at: "2026-08-12T09:00:00.000Z",
                    },
                  },
                  {
                    board_id: "board-1",
                    equipment_model_id: "model-1",
                    boards: { board_code: "820-00239" },
                    equipment_models: { model_name: "A1706" },
                    technical_assets: {
                      id: "asset-pdf",
                      original_filename: "820-00239.pdf",
                      asset_type: "schematic_pdf",
                      file_format: "pdf",
                      storage_bucket: "technical-assets",
                      storage_path: "pdf/path",
                      created_at: "2026-08-12T09:00:00.000Z",
                    },
                  },
                ],
                error: null,
              };
            },
          };
        },
      };
    },
    storage: {
      from() {
        return {
          async download() {
            return {
              data: new Blob(["dummy"]),
              error: null,
            };
          },
        };
      },
    },
  };

  const context = await searchAssistantTechnicalContext({
    diagnosticId: "diag-1",
    benchPrompt: null,
    contextSources: {
      initialReport: "Não liga com entrada de 20V",
      summary: "PP3V3_G3H em 0V e suspeita em U6990",
      symptoms: ["sem imagem"],
      measurements: ["PPBUS_G3H 12.28V"],
      tests: ["medir U6990"],
      hypotheses: ["falha em S5"],
      recentHistory: ["assistant medir PP3V3_G3H"],
      attachments: ["foto sem oxidação"],
      assetNames: ["820-00239.brd", "820-00239.pdf"],
    },
    supabase: mockSupabase,
  });

  assert.ok(context.searchTerms.includes("U6990"));
  assert.ok(context.searchTerms.includes("PP3V3_G3H"));
  assert.equal(context.selectedAssets?.boardview?.assetId, "asset-board");
  assert.equal(context.selectedAssets?.schematic?.assetId, "asset-pdf");
});

test("selectPreferredAssetForTest prioritizes matching board before model and recency", () => {
  const result = selectPreferredAssetForTest({
    kind: "boardview",
    context: {
      diagnosticId: "diag-1",
      equipmentModelId: "model-1",
      boardIds: ["board-1"],
    },
    assets: [
      {
        id: "asset-model-new",
        title: "model-new.brd",
        assetType: "boardview",
        fileFormat: "brd",
        storageBucket: "technical-assets",
        storagePath: "model-new",
        createdAt: "2026-08-12T09:30:00.000Z",
        boardId: null,
        equipmentModelId: "model-1",
        boardName: null,
        modelName: "A1706",
      },
      {
        id: "asset-board-old",
        title: "board-old.brd",
        assetType: "boardview",
        fileFormat: "brd",
        storageBucket: "technical-assets",
        storagePath: "board-old",
        createdAt: "2026-08-11T09:30:00.000Z",
        boardId: "board-1",
        equipmentModelId: "model-1",
        boardName: "820-00239",
        modelName: "A1706",
      },
    ],
  });

  assert.equal(result.asset?.id, "asset-board-old");
  assert.match(result.metadata?.selectionReason ?? "", /placa 820-00239/);
});

test("buildLabSearchHrefForTest prefers focused component, net and page parameters", () => {
  const componentHref = buildLabSearchHrefForTest(
    "diag-1",
    { id: "asset-brd", fileFormat: "brd", boardId: "board-1", equipmentModelId: "model-1" },
    { component: "U6990", net: "PP3V3_G3H" },
  );
  const netHref = buildLabSearchHrefForTest(
    "diag-1",
    { id: "asset-brd", fileFormat: "brd" },
    { net: "PPBUS_G3H" },
  );
  const pageHref = buildLabSearchHrefForTest(
    "diag-1",
    { id: "asset-pdf", fileFormat: "pdf" },
    { page: 12 },
  );

  assert.match(componentHref, /component=U6990/);
  assert.match(componentHref, /net=PP3V3_G3H/);
  assert.doesNotMatch(componentHref, /[?&]q=/);
  assert.match(netHref, /net=PPBUS_G3H/);
  assert.doesNotMatch(netHref, /[?&]q=/);
  assert.match(pageHref, /page=12/);
  assert.doesNotMatch(pageHref, /[?&]q=/);
});

test("searchAssistantTechnicalContext uses tolerant download fallback buckets", async () => {
  const bucketCalls: string[] = [];
  const mockSupabase: AssistantTechnicalContextSupabaseClient = {
    from(table) {
      return {
        select() {
          if (table === "diagnostics") {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        id: "diag-1",
                        equipment_model_id: "model-1",
                        diagnostic_boards: [{ board_id: "board-1" }],
                      },
                      error: null,
                    };
                  },
                };
              },
              async or() {
                return { data: [], error: null };
              },
            };
          }

          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: null, error: null };
                },
              };
            },
            async or() {
              return {
                data: [
                  {
                    board_id: "board-1",
                    equipment_model_id: "model-1",
                    boards: { board_code: "820-00239" },
                    equipment_models: { model_name: "A1706" },
                    technical_assets: {
                      id: "asset-board",
                      original_filename: "820-00239.brd",
                      asset_type: "boardview",
                      file_format: "brd",
                      storage_bucket: "wrong-bucket",
                      storage_path: "board/path",
                      created_at: "2026-08-12T09:00:00.000Z",
                    },
                  },
                ],
                error: null,
              };
            },
          };
        },
      };
    },
    storage: {
      from(bucket) {
        return {
          async download() {
            bucketCalls.push(String(bucket));
            if (bucket === "technical-assets") {
              return { data: new Blob(["dummy"]), error: null };
            }

            return {
              data: null,
              error: { message: "not found" },
            };
          },
        };
      },
    },
  };

  const context = await searchAssistantTechnicalContext({
    diagnosticId: "diag-1",
    benchPrompt: "U6990",
    contextSources: {
      summary: "suspeita em U6990",
    },
    supabase: mockSupabase,
  });

  assert.deepEqual(bucketCalls.slice(0, 2), ["wrong-bucket", "technical-assets"]);
  assert.equal(context.selectedAssets?.boardview?.downloadBucketUsed, "technical-assets");
  assert.equal(context.selectedAssets?.boardview?.downloadStatus, "downloaded");
  assert.match(context.selectedAssets?.boardview?.warning ?? "", /bucket alternativo usado/);
});
