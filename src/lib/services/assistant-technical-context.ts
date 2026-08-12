import {
  buildBoardviewLabModel,
  getComponentPadPins,
  getNetDetails,
  searchBoardviewLabModel,
} from "@/lib/boardview/lab";
import { parseLandrexTestlinkBoardview } from "@/lib/boardview/landrex-testlink";
import {
  findSchematicPdfMatches,
  type SchematicPdfPageText,
} from "@/lib/boardview/schematic-pdf";
import type { AssistantStructuredResponse } from "@/types/domain";

type SupabaseMaybeSingleResult = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

type SupabaseSelectResult = Promise<{
  data: Array<Record<string, unknown>> | null;
  error: { message: string } | null;
}>;

export type AssistantTechnicalContextSupabaseClient = {
  from: (...args: unknown[]) => {
    select: (...selectArgs: unknown[]) => {
      eq: (...eqArgs: unknown[]) => {
        maybeSingle: () => SupabaseMaybeSingleResult;
      };
      or: (...orArgs: unknown[]) => SupabaseSelectResult;
    };
  };
  storage: {
    from: (...args: unknown[]) => {
      download: (...downloadArgs: unknown[]) => Promise<{
        data: Blob | null;
        error: { message: string } | null;
      }>;
    };
  };
};

type TechnicalAssetSearchRow = {
  board_id: string | null;
  equipment_model_id: string | null;
  boards:
    | { board_code: string | null }
    | Array<{ board_code: string | null }>
    | null;
  equipment_models:
    | { model_name: string | null }
    | Array<{ model_name: string | null }>
    | null;
  technical_assets:
    | {
        id: string;
        original_filename: string;
        asset_type: string;
        file_format: string;
        storage_bucket: string;
        storage_path: string;
      }
    | Array<{
        id: string;
        original_filename: string;
        asset_type: string;
        file_format: string;
        storage_bucket: string;
        storage_path: string;
      }>
    | null;
};

type DiagnosticAssetContext = {
  diagnosticId: string;
  equipmentModelId: string | null;
  boardIds: string[];
};

type AssociatedTechnicalAsset = {
  id: string;
  title: string;
  assetType: string;
  fileFormat: string;
  storageBucket: string;
  storagePath: string;
  boardId: string | null;
  equipmentModelId: string | null;
  boardName: string | null;
  modelName: string | null;
};

type AssistantTechnicalContext = NonNullable<
  AssistantStructuredResponse["technicalContext"]
>;
type AssistantBoardviewResult = NonNullable<
  AssistantTechnicalContext["boardview"]
>["results"][number];

function pickRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSearchToken(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/^[^A-Z0-9]+|[^A-Z0-9_.+\-\/]+$/g, "");
}

function normalizeLooseSearchText(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_.+\-\/\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildLabSearchHref(
  diagnosticId: string,
  asset: AssociatedTechnicalAsset,
  term: string,
) {
  const params = new URLSearchParams({
    diagnostic_id: diagnosticId,
    q: term,
  });

  if (asset.fileFormat === "pdf") {
    params.set("schematic_asset_id", asset.id);
    params.set("view", "schematic");
  } else {
    params.set("boardview_asset_id", asset.id);
    params.set("view", "boardview");
  }

  if (asset.boardId) {
    params.set("board_id", asset.boardId);
  }

  if (asset.equipmentModelId) {
    params.set("model_id", asset.equipmentModelId);
  }

  return `/boardview/lab?${params.toString()}`;
}

type TechnicalSearchSourceInput =
  | string
  | {
      prompt?: string | null;
      summary?: string | null;
      initialReport?: string | null;
      symptoms?: Array<string | null | undefined>;
      measurements?: Array<string | null | undefined>;
      hypotheses?: Array<string | null | undefined>;
      tests?: Array<string | null | undefined>;
      assetNames?: Array<string | null | undefined>;
    };

function extractTechnicalSearchTerms(input: TechnicalSearchSourceInput) {
  const source =
    typeof input === "string"
      ? {
          prompt: input,
        }
      : input;
  const orderedChunks = [
    source.prompt ?? "",
    source.summary ?? "",
    source.initialReport ?? "",
    ...(source.symptoms ?? []),
    ...(source.measurements ?? []),
    ...(source.hypotheses ?? []),
    ...(source.tests ?? []),
    ...(source.assetNames ?? []),
  ]
    .map((item) => item?.trim() ?? "")
    .filter(Boolean);
  const mergedText = orderedChunks.join(" ");
  const normalizedPrompt = normalizeLooseSearchText(mergedText);
  const quotedTerms = [...mergedText.matchAll(/"([^"]+)"/g)]
    .map((match) => normalizeSearchToken(match[1] ?? ""))
    .filter(Boolean);
  const componentLikeTerms = normalizedPrompt.match(
    /\b[A-Z]{1,4}\d{2,6}(?:\.\d+)?\b/g,
  ) ?? [];
  const netLikeTerms = normalizedPrompt.match(
    /\b(?:PP[A-Z0-9_+\-/.]+|SMC[A-Z0-9_+\-/.]*|PM[A-Z0-9_+\-/.]*|G3H[A-Z0-9_+\-/.]*|S5[A-Z0-9_+\-/.]*|S4[A-Z0-9_+\-/.]*|SUS[A-Z0-9_+\-/.]*|AUX[A-Z0-9_+\-/.]*|GND|VBAT[A-Z0-9_+\-/.]*|VCC[A-Z0-9_+\-/.]*|SYS[A-Z0-9_+\-/.]*|SCL[A-Z0-9_+\-/.]*|SDA[A-Z0-9_+\-/.]*)\b/g,
  ) ?? [];
  const voltageLikeTerms = normalizedPrompt.match(/\b\d{1,2}(?:\.\d+)?V\b/g) ?? [];
  const symptomLikeTerms = normalizedPrompt.match(
    /\b(?:NAO LIGA|SEM IMAGEM|SEM VIDEO|CURTO|AQUECIMENTO|CONSUMO ALTO|CONSUMO ELEVADO|SEM CONSUMO|NAO CARREGA|SEM BACKLIGHT)\b/g,
  ) ?? [];

  return [
    ...new Set([
      ...quotedTerms,
      ...componentLikeTerms,
      ...netLikeTerms,
      ...voltageLikeTerms,
      ...symptomLikeTerms.map((item) => item.replace(/\s+/g, "_")),
    ]),
  ]
    .map((item) => normalizeSearchToken(item))
    .filter(Boolean)
    .slice(0, 12);
}

async function loadDiagnosticAssetContext(
  diagnosticId: string,
  supabase: AssistantTechnicalContextSupabaseClient,
) {
  const { data, error } = await supabase
    .from("diagnostics")
    .select(
      `
        id,
        equipment_model_id,
        diagnostic_boards(board_id)
      `,
    )
    .eq("id", diagnosticId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const diagnosticRow = data as {
    id: string;
    equipment_model_id: string | null;
    diagnostic_boards: Array<{ board_id: string | null }> | null;
  };

  return {
    diagnosticId: diagnosticRow.id,
    equipmentModelId: diagnosticRow.equipment_model_id ?? null,
    boardIds: (diagnosticRow.diagnostic_boards ?? [])
      .map((item) => item.board_id)
      .filter((item): item is string => Boolean(item)),
  } satisfies DiagnosticAssetContext;
}

async function loadAssociatedTechnicalAssets(
  context: DiagnosticAssetContext,
  supabase: AssistantTechnicalContextSupabaseClient,
) {
  const filters: string[] = [];

  if (context.equipmentModelId) {
    filters.push(`equipment_model_id.eq.${context.equipmentModelId}`);
  }

  if (context.boardIds.length) {
    filters.push(`board_id.in.(${context.boardIds.join(",")})`);
  }

  if (!filters.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("technical_asset_links")
    .select(
      `
        board_id,
        equipment_model_id,
        boards(board_code),
        equipment_models(model_name),
        technical_assets(
          id,
          original_filename,
          asset_type,
          file_format,
          storage_bucket,
          storage_path
        )
      `,
    )
    .or(filters.join(","));

  if (error) {
    throw new Error(error.message);
  }

  return Array.from(
    new Map(
      ((data ?? []) as TechnicalAssetSearchRow[])
        .map((row) => {
          const asset = pickRelation(row.technical_assets);

          if (!asset) {
            return null;
          }

          return [
            asset.id,
            {
              id: asset.id,
              title: asset.original_filename,
              assetType: asset.asset_type,
              fileFormat: asset.file_format,
              storageBucket: asset.storage_bucket,
              storagePath: asset.storage_path,
              boardId: row.board_id ?? null,
              equipmentModelId: row.equipment_model_id ?? null,
              boardName: pickRelation(row.boards)?.board_code ?? null,
              modelName: pickRelation(row.equipment_models)?.model_name ?? null,
            } satisfies AssociatedTechnicalAsset,
          ] as const;
        })
        .filter(
          (
            entry,
          ): entry is readonly [string, AssociatedTechnicalAsset] => Boolean(entry),
        ),
    ).values(),
  );
}

async function downloadAssetBytes(
  asset: AssociatedTechnicalAsset,
  supabase: AssistantTechnicalContextSupabaseClient,
) {
  const { data, error } = await supabase.storage
    .from(asset.storageBucket)
    .download(asset.storagePath);

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível baixar o arquivo técnico.");
  }

  return new Uint8Array(await data.arrayBuffer());
}

function buildBoardviewSearchContext(
  diagnosticId: string,
  asset: AssociatedTechnicalAsset,
  bytes: Uint8Array,
  searchTerms: string[],
): AssistantTechnicalContext["boardview"] {
  const parsed = parseLandrexTestlinkBoardview(bytes);
  const model = buildBoardviewLabModel(parsed);

  const results = searchTerms.flatMap((term) => {
    const hits = searchBoardviewLabModel(model, term, "both", 4);

    return (hits
      .map((hit) => {
        if (hit.selection.kind === "component") {
          const padPins = getComponentPadPins(model, hit.selection.component);
          const nets = [...new Set(padPins.map((padPin) => padPin.netName))]
            .filter(Boolean)
            .slice(0, 6);
          const firstPad = padPins[0] ?? null;

          return {
            kind: "component" as const,
            term,
            title: hit.title,
            subtitle: hit.subtitle,
            details: [
              nets.length
                ? `Nets ligadas: ${nets.join(", ")}`
                : "Sem nets ligadas detectadas.",
              `Centro aproximado: ${hit.selection.component.centerXMil} mil × ${hit.selection.component.centerYMil} mil`,
            ],
            openLabHref: buildLabSearchHref(diagnosticId, asset, hit.title),
            locationSummary: `Lado ${hit.selection.component.mountingSide} com ${hit.selection.component.pinCount} pads`,
            relatedNet: nets[0] ?? null,
            coordinateHint: firstPad
              ? `Pad ${firstPad.id} em ${firstPad.xMil} mil x ${firstPad.yMil} mil`
              : `Centro ${hit.selection.component.centerXMil} mil x ${hit.selection.component.centerYMil} mil`,
          };
        }

        const netName = hit.selection.net?.name;

        if (!netName) {
          return null;
        }

        const netDetails = getNetDetails(model, netName);
        const componentRefs = netDetails.components
          .map((component) => component.ref)
          .slice(0, 8);
        const testPointIds = netDetails.testPoints
          .map((testPoint) => testPoint.id)
          .slice(0, 5);
        const firstPad = netDetails.padPins[0] ?? null;
        const firstTestPoint = netDetails.testPoints[0] ?? null;

        return {
          kind: "net" as const,
          term,
          title: hit.title,
          subtitle: hit.subtitle,
          details: [
            componentRefs.length
              ? `Componentes ligados: ${componentRefs.join(", ")}`
              : "Nenhum componente ligado detectado.",
            testPointIds.length
              ? `Test points: ${testPointIds.join(", ")}`
              : "Sem test points nessa net.",
          ],
          openLabHref: buildLabSearchHref(diagnosticId, asset, netName),
          locationSummary: firstTestPoint
            ? `Primeiro test point no lado ${firstTestPoint.side}`
            : firstPad
              ? `Primeiro pad no lado ${firstPad.side}`
              : null,
          relatedNet: netName,
          coordinateHint: firstTestPoint
            ? `${firstTestPoint.id} em ${firstTestPoint.xMil} mil x ${firstTestPoint.yMil} mil`
            : firstPad
              ? `${firstPad.id} em ${firstPad.xMil} mil x ${firstPad.yMil} mil`
              : null,
        };
      })
      .filter((result) => Boolean(result)) as AssistantBoardviewResult[])
      .slice(0, 4);
  });

  return {
    assetId: asset.id,
    assetTitle: asset.title,
    openLabHref: buildLabSearchHref(
      diagnosticId,
      asset,
      searchTerms[0] ?? asset.title,
    ),
    results: Array.from(
      new Map(results.map((item) => [`${item.kind}:${item.title}`, item] as const)).values(),
    ).slice(0, 6),
  };
}

async function extractSchematicPageTexts(bytes: Uint8Array) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({
    data: Buffer.from(bytes),
  });

  try {
    const result = await parser.getText();
    return result.pages.map(
      (page): SchematicPdfPageText => ({
        pageNumber: page.num,
        text: normalizeWhitespace(page.text),
      }),
    );
  } finally {
    await parser.destroy();
  }
}

async function buildSchematicSearchContext(
  diagnosticId: string,
  asset: AssociatedTechnicalAsset,
  bytes: Uint8Array,
  searchTerms: string[],
): Promise<AssistantTechnicalContext["schematic"]> {
  const pages = await extractSchematicPageTexts(bytes);
  const matches = searchTerms.flatMap((term) =>
    findSchematicPdfMatches(pages, term)
      .slice(0, 4)
      .map((match) => ({
        term,
        pageNumber: match.pageNumber,
        occurrences: match.occurrences,
        excerpt: match.excerpt,
        openLabHref: buildLabSearchHref(diagnosticId, asset, term),
        referenceHint: `Pagina ${match.pageNumber} para ${term}`,
      })),
  );

  return {
    assetId: asset.id,
    assetTitle: asset.title,
    openLabHref: buildLabSearchHref(
      diagnosticId,
      asset,
      searchTerms[0] ?? asset.title,
    ),
    matches: Array.from(
      new Map(
        matches.map((item) => [`${item.term}:${item.pageNumber}`, item] as const),
      ).values(),
    ).slice(0, 8),
  };
}

export async function searchAssistantTechnicalContext({
  diagnosticId,
  benchPrompt,
  contextSources,
  supabase,
}: {
  diagnosticId: string;
  benchPrompt: string | null;
  contextSources?: Omit<TechnicalSearchSourceInput, "prompt">;
  supabase: AssistantTechnicalContextSupabaseClient;
}): Promise<AssistantTechnicalContext> {
  const prompt = normalizeWhitespace(benchPrompt ?? "");
  const searchTerms = prompt
    ? extractTechnicalSearchTerms({
        prompt,
        ...contextSources,
      })
    : extractTechnicalSearchTerms({
        ...contextSources,
      });
  const limitations: string[] = [];
  const diagnosticAssetContext = await loadDiagnosticAssetContext(diagnosticId, supabase);

  if (!diagnosticAssetContext) {
    return {
      userPrompt: benchPrompt,
      searchTerms,
      boardview: null,
      schematic: null,
      limitations: ["Diagnóstico não encontrado para busca técnica."],
    };
  }

  const associatedAssets = await loadAssociatedTechnicalAssets(
    diagnosticAssetContext,
    supabase,
  );
  const boardviewAsset =
    associatedAssets.find(
      (asset) => asset.fileFormat === "brd" || asset.fileFormat === "bdv",
    ) ?? null;
  const schematicAsset =
    associatedAssets.find((asset) => asset.fileFormat === "pdf") ?? null;

  if (!prompt) {
    return {
      userPrompt: null,
      searchTerms: [],
      boardview: null,
      schematic: null,
      limitations: [],
    };
  }

  if (!searchTerms.length) {
    limitations.push(
      "A pergunta não trouxe uma referência ou net pesquisável. Cite algo como U1900, C1009 ou PPBUS_G3H.",
    );
  }

  if (/boardview|brd|bdv/i.test(prompt) && !boardviewAsset) {
    limitations.push("Não há boardview associado a este diagnóstico.");
  }

  if (/esquema|schematic|pdf/i.test(prompt) && !schematicAsset) {
    limitations.push("Não há esquema PDF associado a este diagnóstico.");
  }

  let boardview: AssistantTechnicalContext["boardview"] = null;
  let schematic: AssistantTechnicalContext["schematic"] = null;

  if (boardviewAsset && searchTerms.length) {
    try {
      const bytes = await downloadAssetBytes(boardviewAsset, supabase);
      boardview = buildBoardviewSearchContext(
        diagnosticId,
        boardviewAsset,
        bytes,
        searchTerms,
      );

      if (!boardview || !boardview.results.length) {
        limitations.push("Nenhum resultado encontrado no boardview para os termos pesquisados.");
      }
    } catch (error) {
      limitations.push(
        error instanceof Error
          ? `Falha ao consultar o boardview: ${error.message}`
          : "Falha ao consultar o boardview associado.",
      );
    }
  }

  if (schematicAsset && searchTerms.length) {
    try {
      const bytes = await downloadAssetBytes(schematicAsset, supabase);
      schematic = await buildSchematicSearchContext(
        diagnosticId,
        schematicAsset,
        bytes,
        searchTerms,
      );

      if (!schematic || !schematic.matches.length) {
        limitations.push("Nenhum trecho relevante encontrado no esquema para os termos pesquisados.");
      }
    } catch (error) {
      limitations.push(
        error instanceof Error
          ? `Falha ao consultar o esquema: ${error.message}`
          : "Falha ao consultar o esquema associado.",
      );
    }
  }

  return {
    userPrompt: benchPrompt,
    searchTerms,
    boardview,
    schematic,
    limitations,
  };
}

export function summarizeTechnicalContextForAssistant(
  context: AssistantTechnicalContext,
) {
  const sections: string[] = [];

  if (context.boardview?.results.length) {
    sections.push(
      `Boardview ${context.boardview.assetTitle}: ${context.boardview.results
        .map(
          (item) =>
            `${item.kind} ${item.title} (${item.subtitle}). ${item.details.join(" ")}`,
        )
        .join(" ")}`,
    );
  }

  if (context.schematic?.matches.length) {
    sections.push(
      `Esquema ${context.schematic.assetTitle}: ${context.schematic.matches
        .map(
          (item) =>
            `termo ${item.term} na página ${item.pageNumber} (${item.occurrences} ocorrência(s)): ${item.excerpt}`,
        )
        .join(" ")}`,
    );
  }

  if (context.limitations.length) {
    sections.push(`Limitações: ${context.limitations.join(" ")}`);
  }

  return sections.join(" ").trim();
}

export function buildTechnicalContextEvidence(
  context: AssistantTechnicalContext,
) {
  const evidence: string[] = [];

  for (const result of context.boardview?.results ?? []) {
    evidence.push(`Boardview: ${result.title} — ${result.subtitle}.`);
  }

  for (const match of context.schematic?.matches ?? []) {
    evidence.push(`Esquema: ${match.term} na página ${match.pageNumber}.`);
  }

  for (const limitation of context.limitations) {
    evidence.push(`Limitação: ${limitation}`);
  }

  return evidence.slice(0, 6);
}

export function buildTechnicalContextSources(
  context: AssistantTechnicalContext,
) {
  const sources: string[] = [];

  if (context.boardview?.assetTitle) {
    sources.push(`Boardview: ${context.boardview.assetTitle}`);
  }

  if (context.schematic?.assetTitle) {
    sources.push(`Esquema PDF: ${context.schematic.assetTitle}`);
  }

  for (const result of context.boardview?.results ?? []) {
    sources.push(
      result.kind === "net"
        ? `Boardview net ${result.title}${result.coordinateHint ? ` (${result.coordinateHint})` : ""}`
        : `Boardview componente ${result.title}${result.coordinateHint ? ` (${result.coordinateHint})` : ""}`,
    );
  }

  for (const match of context.schematic?.matches ?? []) {
    sources.push(`Esquema ${match.term} na pagina ${match.pageNumber}`);
  }

  return Array.from(new Set(sources)).slice(0, 10);
}

export function extractTechnicalSearchTermsForTest(input: TechnicalSearchSourceInput) {
  return extractTechnicalSearchTerms(input);
}
