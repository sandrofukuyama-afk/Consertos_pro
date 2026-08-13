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
import { TECHNICAL_ASSET_BUCKET } from "@/lib/technical-assets.mjs";
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
        created_at: string;
      }
    | Array<{
        id: string;
        original_filename: string;
        asset_type: string;
        file_format: string;
        storage_bucket: string;
        storage_path: string;
        created_at: string;
      }>
    | null;
};

type DiagnosticAssetContext = {
  diagnosticId: string;
  equipmentModelId: string | null;
  boardIds: string[];
  preferredAssetIds: string[];
  preferredBoardviewAssetId: string | null;
  preferredSchematicAssetId: string | null;
};

type AssociatedTechnicalAsset = {
  id: string;
  title: string;
  assetType: string;
  fileFormat: string;
  storageBucket: string;
  storagePath: string;
  createdAt: string;
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
type SelectedAssetMetadata = NonNullable<
  AssistantTechnicalContext["selectedAssets"]
>["boardview"];
type AssetFocusTarget =
  | { component: string; net?: string | null }
  | { net: string; component?: string | null }
  | { page: number }
  | { query: string };
type AssetSelectionResult = {
  asset: AssociatedTechnicalAsset | null;
  metadata: SelectedAssetMetadata;
};
type AssetDownloadResult = {
  bytes: Uint8Array;
  bucketUsed: string;
  attemptedBuckets: string[];
  warning: string | null;
};

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

function readDiagnosticTechnicalAssetPreferences(details: Record<string, unknown> | null | undefined) {
  const preferredAssetIds = Array.isArray(details?.associatedTechnicalAssetIds)
    ? details.associatedTechnicalAssetIds
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    : [];
  const preferredBoardviewAssetId =
    typeof details?.preferredBoardviewAssetId === "string" &&
    details.preferredBoardviewAssetId.trim()
      ? details.preferredBoardviewAssetId.trim()
      : null;
  const preferredSchematicAssetId =
    typeof details?.preferredSchematicAssetId === "string" &&
    details.preferredSchematicAssetId.trim()
      ? details.preferredSchematicAssetId.trim()
      : null;

  return {
    preferredAssetIds: [...new Set(preferredAssetIds)],
    preferredBoardviewAssetId,
    preferredSchematicAssetId,
  };
}

function buildLabSearchHref(
  diagnosticId: string,
  asset: AssociatedTechnicalAsset,
  focus: AssetFocusTarget,
) {
  const params = new URLSearchParams({
    diagnostic_id: diagnosticId,
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

  if ("component" in focus && focus.component) {
    params.set("component", focus.component);
    if (focus.net) {
      params.set("net", focus.net);
    }
  } else if ("net" in focus && focus.net) {
    params.set("net", focus.net);
    if (focus.component) {
      params.set("component", focus.component);
    }
  } else if ("page" in focus) {
    params.set("page", String(focus.page));
  } else if ("query" in focus && focus.query) {
    params.set("q", focus.query);
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
      recentHistory?: Array<string | null | undefined>;
      attachments?: Array<string | null | undefined>;
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
    ...(source.recentHistory ?? []),
    ...(source.attachments ?? []),
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
        equipment_details,
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
    equipment_details: Record<string, unknown> | null;
    diagnostic_boards: Array<{ board_id: string | null }> | null;
  };
  const preferences = readDiagnosticTechnicalAssetPreferences(diagnosticRow.equipment_details);

  return {
    diagnosticId: diagnosticRow.id,
    equipmentModelId: diagnosticRow.equipment_model_id ?? null,
    boardIds: (diagnosticRow.diagnostic_boards ?? [])
      .map((item) => item.board_id)
      .filter((item): item is string => Boolean(item)),
    preferredAssetIds: preferences.preferredAssetIds,
    preferredBoardviewAssetId: preferences.preferredBoardviewAssetId,
    preferredSchematicAssetId: preferences.preferredSchematicAssetId,
  } satisfies DiagnosticAssetContext;
}

async function loadAssociatedTechnicalAssets(
  context: DiagnosticAssetContext,
  supabase: AssistantTechnicalContextSupabaseClient,
) {
  const mapRowToAsset = (row: TechnicalAssetSearchRow) => {
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
        createdAt: asset.created_at,
        boardId: row.board_id ?? null,
        equipmentModelId: row.equipment_model_id ?? null,
        boardName: pickRelation(row.boards)?.board_code ?? null,
        modelName: pickRelation(row.equipment_models)?.model_name ?? null,
      } satisfies AssociatedTechnicalAsset,
    ] as const;
  };

  const selectedAssetRows = context.preferredAssetIds.length
    ? await (supabase as unknown as { from: (table: string) => { select: (query: string) => { in: (column: string, values: string[]) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> } } })
        .from("technical_assets")
        .select(
          `
            id,
            original_filename,
            asset_type,
            file_format,
            storage_bucket,
            storage_path,
            created_at,
            technical_asset_links(
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
                storage_path,
                created_at
              )
            )
          `,
        )
        .in("id", context.preferredAssetIds)
    : await Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null });

  const filters: string[] = [];

  if (context.equipmentModelId) {
    filters.push(`equipment_model_id.eq.${context.equipmentModelId}`);
  }

  if (context.boardIds.length) {
    filters.push(`board_id.in.(${context.boardIds.join(",")})`);
  }

  const contextualAssetRows = filters.length
    ? await supabase
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
              storage_path,
              created_at
            )
          `,
        )
        .or(filters.join(","))
    : await Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null });

  const errors = [selectedAssetRows.error, contextualAssetRows.error].filter(Boolean);
  if (errors.length) {
    throw new Error(errors[0]?.message ?? "Falha ao carregar assets tecnicos associados.");
  }

  const preferredAssets = ((selectedAssetRows.data ?? []) as Array<{
    id: string;
    original_filename: string;
    asset_type: string;
    file_format: string;
    storage_bucket: string;
    storage_path: string;
    created_at: string;
    technical_asset_links: TechnicalAssetSearchRow[] | null;
  }>).map((row) => {
    const matchingLink =
      row.technical_asset_links?.find(
        (link) =>
          (link.board_id && context.boardIds.includes(link.board_id)) ||
          (link.equipment_model_id && link.equipment_model_id === context.equipmentModelId),
      ) ??
      row.technical_asset_links?.[0] ??
      null;

    return [
      row.id,
      {
        id: row.id,
        title: row.original_filename,
        assetType: row.asset_type,
        fileFormat: row.file_format,
        storageBucket: row.storage_bucket,
        storagePath: row.storage_path,
        createdAt: row.created_at,
        boardId: matchingLink?.board_id ?? null,
        equipmentModelId: matchingLink?.equipment_model_id ?? null,
        boardName: pickRelation(matchingLink?.boards)?.board_code ?? null,
        modelName: pickRelation(matchingLink?.equipment_models)?.model_name ?? null,
      } satisfies AssociatedTechnicalAsset,
    ] as const;
  });

  return Array.from(
    new Map(
      [
        ...preferredAssets,
        ...((contextualAssetRows.data ?? []) as TechnicalAssetSearchRow[]).map(mapRowToAsset),
      ]
        .filter(
          (
            entry,
          ): entry is readonly [string, AssociatedTechnicalAsset] => Boolean(entry),
        ),
    ).values(),
  );
}

function buildAssetSelectionReason(
  asset: AssociatedTechnicalAsset,
  context: DiagnosticAssetContext,
) {
  const reasons: string[] = [];
  if (context.preferredAssetIds.includes(asset.id)) {
    reasons.push("associado manualmente a este diagnostico");
  }

  if (asset.boardId && context.boardIds.includes(asset.boardId)) {
    reasons.push(`associado diretamente à placa ${asset.boardName ?? asset.boardId}`);
  }

  if (asset.equipmentModelId && asset.equipmentModelId === context.equipmentModelId) {
    reasons.push(`associado ao modelo ${asset.modelName ?? asset.equipmentModelId}`);
  }

  reasons.push(`arquivo mais recente em ${asset.createdAt}`);

  return reasons.join("; ");
}

function rankAssociatedAsset(
  asset: AssociatedTechnicalAsset,
  context: DiagnosticAssetContext,
) {
  let score = 0;

  if (asset.boardId && context.boardIds.includes(asset.boardId)) {
    score += 100;
  }

  if (asset.equipmentModelId && asset.equipmentModelId === context.equipmentModelId) {
    score += 20;
  }

  if (asset.boardId && asset.equipmentModelId) {
    score += 5;
  }

  if (asset.fileFormat === "brd") {
    score += 2;
  }

  const createdAtScore = Number.isFinite(Date.parse(asset.createdAt))
    ? Date.parse(asset.createdAt)
    : 0;

  return {
    score,
    createdAtScore,
  };
}

function selectPreferredAsset(
  assets: AssociatedTechnicalAsset[],
  context: DiagnosticAssetContext,
  kind: "boardview" | "schematic",
): AssetSelectionResult {
  const filteredAssets = assets.filter((asset) =>
    kind === "schematic"
      ? asset.fileFormat === "pdf"
      : asset.fileFormat === "brd" || asset.fileFormat === "bdv",
  );

  if (!filteredAssets.length) {
    return {
      asset: null,
      metadata: null,
    };
  }

  const sortedAssets = [...filteredAssets].sort((left, right) => {
    const leftPreferred =
      (kind === "boardview" && context.preferredBoardviewAssetId === left.id) ||
      (kind === "schematic" && context.preferredSchematicAssetId === left.id);
    const rightPreferred =
      (kind === "boardview" && context.preferredBoardviewAssetId === right.id) ||
      (kind === "schematic" && context.preferredSchematicAssetId === right.id);

    if (leftPreferred !== rightPreferred) {
      return leftPreferred ? -1 : 1;
    }

    const leftRank = rankAssociatedAsset(left, context);
    const rightRank = rankAssociatedAsset(right, context);

    return (
      rightRank.score - leftRank.score ||
      rightRank.createdAtScore - leftRank.createdAtScore ||
      left.title.localeCompare(right.title)
    );
  });

  const selectedAsset = sortedAssets[0];

  return {
    asset: selectedAsset,
    metadata: {
      assetId: selectedAsset.id,
      assetTitle: selectedAsset.title,
      selectionReason: buildAssetSelectionReason(selectedAsset, context),
      attemptedBuckets: [selectedAsset.storageBucket, TECHNICAL_ASSET_BUCKET, "technical-documents"]
        .filter((value, index, array) => Boolean(value) && array.indexOf(value) === index),
      downloadBucketUsed: null,
      downloadStatus: "pending",
      warning:
        sortedAssets.length > 1
          ? `${sortedAssets.length} candidatos encontrados; foi escolhido o asset mais específico e mais recente.`
          : null,
    },
  };
}

async function downloadAssetBytes(
  asset: AssociatedTechnicalAsset,
  supabase: AssistantTechnicalContextSupabaseClient,
): Promise<AssetDownloadResult> {
  const candidateBuckets = Array.from(
    new Set(
      [asset.storageBucket, TECHNICAL_ASSET_BUCKET, "technical-documents"].filter(
        (value): value is string => Boolean(value?.trim()),
      ),
    ),
  );
  const downloadErrors: string[] = [];

  for (const bucket of candidateBuckets) {
    const { data, error } = await supabase.storage.from(bucket).download(asset.storagePath);

    if (data) {
      return {
        bytes: new Uint8Array(await data.arrayBuffer()),
        bucketUsed: bucket,
        attemptedBuckets: candidateBuckets,
        warning:
          bucket !== asset.storageBucket
            ? `bucket alternativo usado: esperado ${asset.storageBucket}, usado ${bucket}`
            : null,
      };
    }

    if (error?.message) {
      downloadErrors.push(`${bucket}: ${error.message}`);
    }
  }

  throw new Error(
    downloadErrors[0] ??
      "Não foi possível baixar o arquivo técnico pelos buckets disponíveis.",
  );
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
              `Centro aproximado: ${hit.selection.component.centerXMil} mil x ${hit.selection.component.centerYMil} mil`,
            ],
            openLabHref: buildLabSearchHref(diagnosticId, asset, {
              component: hit.title,
              net: nets[0] ?? null,
            }),
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
          openLabHref: buildLabSearchHref(diagnosticId, asset, {
            net: netName,
          }),
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
    openLabHref: buildLabSearchHref(diagnosticId, asset, {
      query: searchTerms[0] ?? asset.title,
    }),
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
        openLabHref: buildLabSearchHref(diagnosticId, asset, {
          page: match.pageNumber,
        }),
        referenceHint: `Pagina ${match.pageNumber} para ${term}`,
      })),
  );

  return {
    assetId: asset.id,
    assetTitle: asset.title,
    openLabHref: buildLabSearchHref(diagnosticId, asset, {
      query: searchTerms[0] ?? asset.title,
    }),
    matches: Array.from(
      new Map(
        matches.map((item) => [`${item.term}:${item.pageNumber}`, item] as const),
      ).values(),
    ).slice(0, 8),
  };
}

function updateSelectedAssetMetadata(
  metadata: SelectedAssetMetadata,
  updates: Partial<NonNullable<SelectedAssetMetadata>>,
): SelectedAssetMetadata {
  if (!metadata) {
    return null;
  }

  return {
    ...metadata,
    ...updates,
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
  const searchTerms = extractTechnicalSearchTerms({
    prompt,
    ...contextSources,
  });
  const limitations: string[] = [];
  const diagnosticAssetContext = await loadDiagnosticAssetContext(diagnosticId, supabase);

  if (!diagnosticAssetContext) {
    return {
      userPrompt: benchPrompt,
      searchTerms,
      selectedAssets: {
        boardview: null,
        schematic: null,
      },
      boardview: null,
      schematic: null,
      limitations: ["Diagnóstico não encontrado para busca técnica."],
    };
  }

  const associatedAssets = await loadAssociatedTechnicalAssets(
    diagnosticAssetContext,
    supabase,
  );
  const boardviewSelection = selectPreferredAsset(
    associatedAssets,
    diagnosticAssetContext,
    "boardview",
  );
  const schematicSelection = selectPreferredAsset(
    associatedAssets,
    diagnosticAssetContext,
    "schematic",
  );

  if (!searchTerms.length) {
    limitations.push(
      "Não foi possível extrair uma referência pesquisável do contexto atual. Registre algo como U1900, C1009 ou PPBUS_G3H.",
    );
  }

  if (/boardview|brd|bdv/i.test(prompt) && !boardviewSelection.asset) {
    limitations.push("Não há boardview associado a este diagnóstico.");
  }

  if (/esquema|schematic|pdf/i.test(prompt) && !schematicSelection.asset) {
    limitations.push("Não há esquema PDF associado a este diagnóstico.");
  }

  let selectedBoardviewMetadata = boardviewSelection.metadata;
  let selectedSchematicMetadata = schematicSelection.metadata;
  let boardview: AssistantTechnicalContext["boardview"] = null;
  let schematic: AssistantTechnicalContext["schematic"] = null;

  if (boardviewSelection.asset && searchTerms.length) {
    try {
      const boardviewDownload = await downloadAssetBytes(boardviewSelection.asset, supabase);
      selectedBoardviewMetadata = updateSelectedAssetMetadata(selectedBoardviewMetadata, {
        attemptedBuckets: boardviewDownload.attemptedBuckets,
        downloadBucketUsed: boardviewDownload.bucketUsed,
        downloadStatus: "downloaded",
        warning:
          boardviewDownload.warning ?? selectedBoardviewMetadata?.warning ?? null,
      });
      boardview = buildBoardviewSearchContext(
        diagnosticId,
        boardviewSelection.asset,
        boardviewDownload.bytes,
        searchTerms,
      );

      if (!boardview?.results.length) {
        limitations.push("Nenhum resultado encontrado no boardview para os termos pesquisados.");
      }

      if (boardviewDownload.warning) {
        limitations.push(`Boardview: ${boardviewDownload.warning}.`);
      }
    } catch (error) {
      selectedBoardviewMetadata = updateSelectedAssetMetadata(selectedBoardviewMetadata, {
        downloadStatus: "failed",
        warning: error instanceof Error ? error.message : "Falha ao baixar boardview.",
      });
      limitations.push(
        error instanceof Error
          ? `Falha ao consultar o boardview: ${error.message}`
          : "Falha ao consultar o boardview associado.",
      );
    }
  }

  if (schematicSelection.asset && searchTerms.length) {
    try {
      const schematicDownload = await downloadAssetBytes(schematicSelection.asset, supabase);
      selectedSchematicMetadata = updateSelectedAssetMetadata(selectedSchematicMetadata, {
        attemptedBuckets: schematicDownload.attemptedBuckets,
        downloadBucketUsed: schematicDownload.bucketUsed,
        downloadStatus: "downloaded",
        warning:
          schematicDownload.warning ?? selectedSchematicMetadata?.warning ?? null,
      });
      schematic = await buildSchematicSearchContext(
        diagnosticId,
        schematicSelection.asset,
        schematicDownload.bytes,
        searchTerms,
      );

      if (!schematic?.matches.length) {
        limitations.push("Nenhum trecho relevante encontrado no esquema para os termos pesquisados.");
      }

      if (schematicDownload.warning) {
        limitations.push(`Esquema: ${schematicDownload.warning}.`);
      }
    } catch (error) {
      selectedSchematicMetadata = updateSelectedAssetMetadata(selectedSchematicMetadata, {
        downloadStatus: "failed",
        warning: error instanceof Error ? error.message : "Falha ao baixar esquema.",
      });
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
    selectedAssets: {
      boardview: selectedBoardviewMetadata,
      schematic: selectedSchematicMetadata,
    },
    boardview,
    schematic,
    limitations,
  };
}

export function summarizeTechnicalContextForAssistant(
  context: AssistantTechnicalContext,
) {
  const sections: string[] = [];

  if (context.selectedAssets?.boardview) {
    sections.push(
      `Boardview escolhido: ${context.selectedAssets.boardview.assetTitle} (${context.selectedAssets.boardview.selectionReason}).`,
    );
  }

  if (context.selectedAssets?.schematic) {
    sections.push(
      `Esquema escolhido: ${context.selectedAssets.schematic.assetTitle} (${context.selectedAssets.schematic.selectionReason}).`,
    );
  }

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

  if (context.selectedAssets?.boardview?.assetTitle) {
    evidence.push(`Asset boardview: ${context.selectedAssets.boardview.assetTitle}.`);
  }

  if (context.selectedAssets?.schematic?.assetTitle) {
    evidence.push(`Asset esquema: ${context.selectedAssets.schematic.assetTitle}.`);
  }

  for (const result of context.boardview?.results ?? []) {
    evidence.push(`Boardview: ${result.title} - ${result.subtitle}.`);
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

  if (context.selectedAssets?.boardview?.downloadBucketUsed) {
    sources.push(
      `Boardview bucket: ${context.selectedAssets.boardview.downloadBucketUsed}`,
    );
  }

  if (context.selectedAssets?.schematic?.downloadBucketUsed) {
    sources.push(
      `Esquema bucket: ${context.selectedAssets.schematic.downloadBucketUsed}`,
    );
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

export function buildLabSearchHrefForTest(
  diagnosticId: string,
  asset: {
    id: string;
    fileFormat: string;
    boardId?: string | null;
    equipmentModelId?: string | null;
  },
  focus: AssetFocusTarget,
) {
  return buildLabSearchHref(
    diagnosticId,
    {
      id: asset.id,
      title: asset.id,
      assetType: asset.fileFormat === "pdf" ? "schematic_pdf" : "boardview",
      fileFormat: asset.fileFormat,
      storageBucket: TECHNICAL_ASSET_BUCKET,
      storagePath: asset.id,
      createdAt: new Date(0).toISOString(),
      boardId: asset.boardId ?? null,
      equipmentModelId: asset.equipmentModelId ?? null,
      boardName: null,
      modelName: null,
    },
    focus,
  );
}

export function selectPreferredAssetForTest(args: {
  assets: AssociatedTechnicalAsset[];
  context: DiagnosticAssetContext;
  kind: "boardview" | "schematic";
}) {
  return selectPreferredAsset(args.assets, args.context, args.kind);
}
