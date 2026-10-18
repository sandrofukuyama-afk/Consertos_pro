import type Anthropic from "@anthropic-ai/sdk";

import {
  getComponentPadPins,
  getNetDetails,
  inferNetVoltageHint,
  searchBoardviewLabModel,
} from "@/lib/boardview/lab";
import { findSchematicPdfMatches } from "@/lib/boardview/schematic-pdf";
import {
  CLOSURE_CASE_STATUSES,
  CLOSURE_CAUSE_TYPES,
  CLOSURE_SOLUTION_TYPES,
  closeDiagnosticCase,
} from "@/lib/services/diagnostic-closure";
import type { DiagnosticTechnicalWorkbench } from "@/lib/services/assistant-technical-context";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type DiagnosticAgentToolContext = {
  diagnosticId: string;
  userId: string;
  supabase: SupabaseServerClient;
  workbench: DiagnosticTechnicalWorkbench;
  /** Registro legivel do que o agente consultou/alterou nesta resposta. */
  actions: string[];
  /** Indica se o agente gravou algo no caso (para revalidar a pagina). */
  wroteToCase: { value: boolean };
  /** A IA encerrou o caso nesta resposta (gera o parecer tecnico depois). */
  closedCase?: { value: boolean };
};

const MEASUREMENT_TYPES = [
  "voltage",
  "current",
  "resistance",
  "temperature",
  "consumption",
  "frequency",
  "continuity",
  "other",
] as const;

const TEST_RESULT_STATUSES = ["passed", "failed", "inconclusive"] as const;
const SCREEN_CONDITIONS = ["good", "broken", "no_image"] as const;

const HYPOTHESIS_STATUSES = [
  "open",
  "strengthened",
  "weakened",
  "discarded",
  "confirmed",
] as const;

// Tudo o que as ferramentas devolvem e relido a cada volta do agente (custo):
// limites menores; a IA pode refinar a busca se precisar de mais.
const MAX_SCHEMATIC_PAGE_CHARS = 8000;
const MAX_NET_COMPONENTS = 30;
const MAX_NET_TEST_POINTS = 10;
const MAX_SCHEMATIC_MATCHES = 8;
const MAX_REFERENCE_VALUES = 60;

export const DIAGNOSTIC_AGENT_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "listar_arquivos_tecnicos",
    description:
      "Lista os boardviews (.brd/.bdv) e esquemas (PDF) associados a este caso e qual esta ativo para consulta. Se 'busca' for informada, procura tambem na biblioteca tecnica inteira (cerca de mil arquivos: notebooks, desktops, placas de video, celulares). Cada palavra da busca precisa aparecer no nome do arquivo ou no fabricante/modelo/placa cadastrados, em qualquer ordem: prefira poucas palavras distintivas, como o codigo da placa (820-02016, LA-D801P, NM-D521, DA0HK9MB6D0, MS-V388) ou fabricante + modelo (dell 5567, msi 3080). Se nao achar, tente outra combinacao mais curta. Tambem lista BIOS/firmware e boardviews em formatos que voce nao le, para avisar o tecnico.",
    input_schema: {
      type: "object",
      properties: {
        busca: {
          type: "string",
          description: "Trecho do nome do arquivo para procurar na biblioteca (opcional).",
        },
      },
    },
  },
  {
    name: "usar_arquivo_tecnico",
    description:
      "Define qual boardview ou esquema da biblioteca sera consultado por este caso (pelo id retornado em listar_arquivos_tecnicos). A escolha fica salva no caso para as proximas mensagens.",
    input_schema: {
      type: "object",
      properties: {
        asset_id: { type: "string", description: "Id do arquivo tecnico." },
      },
      required: ["asset_id"],
    },
  },
  {
    name: "buscar_no_boardview",
    description:
      "Procura componentes e nets no boardview ativo por nome parcial (ex.: 'PP3V3', 'U7100', 'PPBUS', 'SMC_RESET'). Use para descobrir o nome exato antes de detalhar.",
    input_schema: {
      type: "object",
      properties: {
        consulta: { type: "string" },
      },
      required: ["consulta"],
    },
  },
  {
    name: "detalhar_componente",
    description:
      "Mostra um componente do boardview ativo: lado da placa, tipo, e cada pino com a net ligada e a tensao esperada inferida pelo nome da net. Use para saber onde medir e o que esperar em cada pino.",
    input_schema: {
      type: "object",
      properties: {
        referencia: { type: "string", description: "Referencia exata, ex.: U7100, PQ4101, C7020." },
      },
      required: ["referencia"],
    },
  },
  {
    name: "detalhar_net",
    description:
      "Mostra uma net do boardview ativo: todos os componentes ligados a ela, test points e a tensao esperada inferida pelo nome. Use para seguir uma linha (ex.: achar quem gera um rail, onde medir, ou o que pode estar em curto).",
    input_schema: {
      type: "object",
      properties: {
        net: { type: "string", description: "Nome exato da net, ex.: PP3V3_G3H." },
      },
      required: ["net"],
    },
  },
  {
    name: "buscar_no_esquema",
    description:
      "Procura um termo (net, componente, sinal) no texto do esquema PDF ativo e devolve as paginas onde aparece com um trecho de contexto.",
    input_schema: {
      type: "object",
      properties: {
        termo: { type: "string" },
      },
      required: ["termo"],
    },
  },
  {
    name: "ler_pagina_do_esquema",
    description:
      "Le o texto completo de uma pagina do esquema PDF ativo (nomes de nets, referencias, valores, notas de alimentacao e sequencia de power).",
    input_schema: {
      type: "object",
      properties: {
        pagina: { type: "integer", minimum: 1 },
      },
      required: ["pagina"],
    },
  },
  {
    name: "valores_de_referencia",
    description:
      "Le os valores de referencia cadastrados para a(s) placa(s) deste caso (medicoes conhecidas de uma placa boa: componente, ponto, valor esperado e condicao, ex.: power_off/diodo, standby). Filtre por componente quando quiser.",
    input_schema: {
      type: "object",
      properties: {
        componente: { type: "string", description: "Referencia do componente para filtrar (opcional)." },
      },
    },
  },
  {
    name: "consultar_registros_do_caso",
    description:
      "Le do banco o estado atual do caso: todas as medicoes (mais recentes primeiro), hipoteses com id e status, e testes executados. Use antes de atualizar hipoteses ou quando precisar do historico completo.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "registrar_medicao",
    description:
      "Grava no caso uma medicao que o TECNICO informou ter feito. Nunca registre valores esperados, estimados ou inventados como medidos.",
    input_schema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: [...MEASUREMENT_TYPES] },
        ponto: { type: "string", description: "Onde foi medido: net, componente/pino ou test point." },
        valor_medido: { type: "string", description: "Valor como o tecnico informou, ex.: '0V', '3.28', '12 ohm', 'curto'." },
        unidade: { type: "string" },
        valor_esperado: { type: "string" },
        fora_da_faixa: { type: "boolean" },
        contexto: { type: "string", description: "Condicao da medicao, ex.: 'com carregador, sem bateria, placa em standby'." },
      },
      required: ["tipo", "ponto", "valor_medido"],
    },
  },
  {
    name: "registrar_hipotese",
    description:
      "Registra uma nova hipotese de causa do defeito, com as evidencias que a sustentam e uma confianca de 0 a 100.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        descricao: { type: "string" },
        evidencias: { type: "string" },
        confianca: { type: "number", minimum: 0, maximum: 100 },
      },
      required: ["titulo", "evidencias"],
    },
  },
  {
    name: "atualizar_hipotese",
    description:
      "Atualiza o status de uma hipotese existente conforme novas evidencias (use o id de consultar_registros_do_caso).",
    input_schema: {
      type: "object",
      properties: {
        hipotese_id: { type: "string" },
        status: { type: "string", enum: [...HYPOTHESIS_STATUSES] },
        evidencias: { type: "string" },
        contradicoes: { type: "string" },
        confianca: { type: "number", minimum: 0, maximum: 100 },
      },
      required: ["hipotese_id", "status"],
    },
  },
  {
    name: "atualizar_resumo_do_caso",
    description:
      "Reescreve o resumo atual do caso (estado do diagnostico em poucas linhas: o que ja foi confirmado, o que foi descartado, suspeita principal e proximo passo).",
    input_schema: {
      type: "object",
      properties: {
        resumo: { type: "string" },
      },
      required: ["resumo"],
    },
  },
  {
    name: "atualizar_equipamento_do_caso",
    description:
      "Registra marca/modelo/placa do equipamento no caso (vira o titulo do caso na lista). Use quando o caso ainda nao tem equipamento registrado e o tecnico informar o modelo, ou voce ler com certeza na foto da etiqueta/placa; ou quando o tecnico corrigir. Nao chute: use as palavras do tecnico (pode corrigir grafia, ex.: 'steath' -> 'Stealth') e NAO acrescente serie, linha ou nome comercial que ele nao disse (ex.: nao transformar 'Stealth 15M' em 'GS65 Stealth'). Na duvida, registre so o codigo da placa.",
    input_schema: {
      type: "object",
      properties: {
        fabricante: { type: "string", description: "Ex.: MSI, HP, Dell, Apple." },
        modelo: { type: "string", description: "Modelo comercial, ex.: GF63 Thin 10SC, 15s-fq1126TU." },
        placa: { type: "string", description: "Codigo da placa, se souber. Ex.: MS-16R31, DA0P5DMB8C0." },
      },
    },
  },
  {
    name: "encerrar_diagnostico",
    description:
      "Encerra o caso e preenche o fechamento no painel: estado final, resumo, resultado do reparo, causa, solucao, testes feitos e dados do aparelho. Use SO quando o tecnico disser que o caso terminou (consertou e testou, vai entregar, cliente recusou, sem conserto) ou pedir para encerrar. Preencha com o que foi apurado na conversa e nos registros do caso (use consultar_registros_do_caso antes); nao invente: campo sem informacao fica de fora. Depois de encerrar, responda em 1-2 frases com o resumo do fechamento.",
    input_schema: {
      type: "object",
      properties: {
        estado_final: {
          type: "string",
          enum: [...CLOSURE_CASE_STATUSES],
          description:
            "confirmed = causa confirmada e reparo testado; probable = consertou mas a causa nao foi 100% comprovada; unresolved = sem conserto/cliente recusou.",
        },
        resumo: {
          type: "string",
          description: "Resumo tecnico do caso em 2-4 frases: defeito, o que foi medido, causa e o que foi feito.",
        },
        resultado_do_reparo: {
          type: "string",
          description: "Como o aparelho ficou, ex.: 'Liga, carrega e passou 30 min de teste' ou 'Devolvido sem reparo'.",
        },
        modo_de_falha: { type: "string", description: "Curto, ex.: 'PPBUS_G3H em curto', 'BIOS corrompida'." },
        causa: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: [...CLOSURE_CAUSE_TYPES] },
            titulo: { type: "string", description: "Ex.: 'Capacitor C7130 em curto no PPBUS_G3H'." },
            explicacao: { type: "string", description: "Explicacao tecnica com as evidencias (medicoes)." },
          },
          required: ["tipo", "titulo", "explicacao"],
        },
        solucao: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: [...CLOSURE_SOLUTION_TYPES] },
            titulo: { type: "string" },
            procedimento: {
              type: "string",
              description: "O que foi feito, com referencias (componente trocado, valor, arquivo de BIOS).",
            },
          },
          required: ["tipo", "titulo", "procedimento"],
        },
        testes_feitos: {
          type: "array",
          description: "Testes que o tecnico disse ter feito (nao repetir cada medicao, ja registrada).",
          items: {
            type: "object",
            properties: {
              teste: {
                type: "string",
                description:
                  "Nome do teste do catalogo: Medição de tensão, Teste de continuidade, Regravação de BIOS, Substituição cruzada, Teste com fonte assimétrica.",
              },
              o_que_aconteceu: { type: "string" },
              resultado: { type: "string", enum: [...TEST_RESULT_STATUSES] },
            },
            required: ["teste", "o_que_aconteceu", "resultado"],
          },
        },
        aparelho: {
          type: "object",
          description: "Dados do aparelho que o tecnico informou (so os que ele disse).",
          properties: {
            numero_de_serie: { type: "string" },
            chega_alimentacao: {
              type: "boolean",
              description: "Na entrada: tinha alimentacao (carregador detectado/consumo)?",
            },
            liga: { type: "boolean", description: "Na entrada: ligava?" },
            tela: { type: "string", enum: [...SCREEN_CONDITIONS] },
            estado_fisico: { type: "string", description: "Ex.: 'carcaca riscada, sinal de liquido no teclado'." },
          },
        },
      },
      required: ["estado_final", "resumo", "resultado_do_reparo"],
    },
  },
];

class ToolInputError extends Error {}

function readString(input: Record<string, unknown>, key: string, required = false) {
  const value = input[key];

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (required) {
    throw new ToolInputError(`Parametro obrigatorio ausente: ${key}.`);
  }

  return null;
}

function readNumber(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readEnum<T extends readonly string[]>(
  input: Record<string, unknown>,
  key: string,
  allowed: T,
): T[number] {
  const value = readString(input, key, true);

  if (!allowed.includes(value as T[number])) {
    throw new ToolInputError(`Valor invalido para ${key}: ${value}. Use um de: ${allowed.join(", ")}.`);
  }

  return value as T[number];
}

function parseNumericValue(value: string) {
  const match = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

async function listTechnicalAssets(ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) {
  const query = readString(input, "busca");
  const associated = ctx.workbench.listAssociatedAssets();
  const library = query ? await ctx.workbench.searchLibrary(query) : null;

  if (query) {
    ctx.actions.push(`Biblioteca: buscou "${query}"`);
  }

  return {
    boardview_ativo: ctx.workbench.getActiveAsset("boardview"),
    esquema_ativo: ctx.workbench.getActiveAsset("schematic"),
    associados_ao_caso: associated,
    resultados_da_biblioteca: library?.readable,
    outros_arquivos_para_download: library?.others.length
      ? {
          aviso:
            "BIOS, firmware ou boardview em formato que a IA nao le. Avise o tecnico que pode baixar na Biblioteca.",
          arquivos: library.others,
        }
      : undefined,
  };
}

async function activateTechnicalAsset(ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) {
  const assetId = readString(input, "asset_id", true)!;
  const asset = await ctx.workbench.activateAsset(assetId);

  if (!asset) {
    throw new ToolInputError("Arquivo tecnico nao encontrado ou nao e boardview/esquema.");
  }

  const { data: diagnostic } = await ctx.supabase
    .from("diagnostics")
    .select("equipment_details")
    .eq("id", ctx.diagnosticId)
    .maybeSingle();
  const details =
    diagnostic?.equipment_details && typeof diagnostic.equipment_details === "object"
      ? (diagnostic.equipment_details as Record<string, unknown>)
      : {};
  const associatedIds = Array.isArray(details.associatedTechnicalAssetIds)
    ? (details.associatedTechnicalAssetIds as unknown[]).map(String)
    : [];

  const { error } = await ctx.supabase
    .from("diagnostics")
    .update({
      equipment_details: {
        ...details,
        associatedTechnicalAssetIds: [...new Set([...associatedIds, asset.id])],
        [asset.kind === "boardview" ? "preferredBoardviewAssetId" : "preferredSchematicAssetId"]:
          asset.id,
      },
    })
    .eq("id", ctx.diagnosticId);

  if (error) {
    throw new Error(error.message);
  }

  ctx.wroteToCase.value = true;
  ctx.actions.push(`Associou ${asset.kind === "boardview" ? "boardview" : "esquema"} ${asset.title} ao caso`);

  return { ativo: asset };
}

async function requireBoardview(ctx: DiagnosticAgentToolContext) {
  const loaded = await ctx.workbench.loadBoardview();

  if (!loaded) {
    throw new ToolInputError(
      "Nenhum boardview ativo neste caso. Use listar_arquivos_tecnicos com uma busca e depois usar_arquivo_tecnico.",
    );
  }

  return loaded;
}

async function requireSchematic(ctx: DiagnosticAgentToolContext) {
  const loaded = await ctx.workbench.loadSchematicPages();

  if (!loaded) {
    throw new ToolInputError(
      "Nenhum esquema ativo neste caso. Use listar_arquivos_tecnicos com uma busca e depois usar_arquivo_tecnico.",
    );
  }

  return loaded;
}

async function searchBoardview(ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) {
  const query = readString(input, "consulta", true)!;
  const { asset, model } = await requireBoardview(ctx);
  const hits = searchBoardviewLabModel(model, query, "both", 25);

  ctx.actions.push(`Boardview: buscou "${query}"`);

  return {
    arquivo: asset.title,
    resultados: hits.map((hit) => ({
      tipo: hit.selection.kind === "component" ? "componente" : hit.selection.kind,
      nome: hit.title,
      detalhe: hit.subtitle,
    })),
  };
}

async function describeComponent(ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) {
  const reference = readString(input, "referencia", true)!.toUpperCase();
  const { asset, model } = await requireBoardview(ctx);
  const component = model.componentsByRef.get(reference.toLowerCase());

  if (!component) {
    const suggestions = searchBoardviewLabModel(model, reference, "both", 8).map((hit) => hit.title);
    throw new ToolInputError(
      `Componente ${reference} nao encontrado no boardview. Parecidos: ${suggestions.join(", ") || "nenhum"}.`,
    );
  }

  const pins = getComponentPadPins(model, component);
  ctx.actions.push(`Boardview: consultou ${component.ref}`);

  return {
    arquivo: asset.title,
    referencia: component.ref,
    tipo: component.kind,
    lado: component.mountingSide,
    total_de_pinos: component.pinCount,
    pinos: pins.map((pin) => ({
      pino: pin.pinOrdinalWithinPart,
      net: pin.netName || null,
      tensao_esperada: pin.netName ? inferNetVoltageHint(pin.netName) : null,
    })),
    abrir_no_lab: ctx.workbench.buildLabHref("boardview", {
      component: component.ref,
      net: pins[0]?.netName ?? null,
    }),
  };
}

async function describeNet(ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) {
  const requested = readString(input, "net", true)!;
  const { asset, model } = await requireBoardview(ctx);
  const netName =
    model.netsByName.has(requested)
      ? requested
      : [...model.netsByName.keys()].find((name) => name.toUpperCase() === requested.toUpperCase());

  if (!netName) {
    const suggestions = searchBoardviewLabModel(model, requested, "both", 8).map((hit) => hit.title);
    throw new ToolInputError(
      `Net ${requested} nao encontrada no boardview. Parecidas: ${suggestions.join(", ") || "nenhuma"}.`,
    );
  }

  const details = getNetDetails(model, netName);
  ctx.actions.push(`Boardview: seguiu a net ${netName}`);

  return {
    arquivo: asset.title,
    net: netName,
    tensao_esperada: inferNetVoltageHint(netName),
    total_de_componentes: details.components.length,
    ...(details.components.length > MAX_NET_COMPONENTS
      ? { aviso: `Mostrando ${MAX_NET_COMPONENTS} de ${details.components.length} componentes.` }
      : {}),
    componentes: details.components.slice(0, MAX_NET_COMPONENTS).map((component) => {
      const pinsOnNet = details.padPins
        .filter((pin) => pin.partIndex === component.partIndex)
        .map((pin) => pin.pinOrdinalWithinPart);

      return {
        referencia: component.ref,
        tipo: component.kind,
        lado: component.mountingSide,
        pinos_nesta_net: pinsOnNet,
      };
    }),
    test_points: details.testPoints.slice(0, MAX_NET_TEST_POINTS).map((testPoint) => ({
      id: testPoint.id,
      lado: testPoint.side,
    })),
    ...(details.testPoints.length
      ? {
          sobre_test_points:
            "Os IDs TP-n sao numeracao do app (o arquivo nao traz nome do test point). O tecnico acha digitando o ID na busca do laboratorio; no esquema eles nao aparecem, la procure pela net. Ao citar, diga o lado da placa.",
        }
      : {}),
    abrir_no_lab: ctx.workbench.buildLabHref("boardview", { net: netName }),
  };
}

async function searchSchematic(ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) {
  const term = readString(input, "termo", true)!;
  const { asset, pages } = await requireSchematic(ctx);
  const allMatches = findSchematicPdfMatches(pages, term);
  const matches = allMatches.slice(0, MAX_SCHEMATIC_MATCHES);

  ctx.actions.push(`Esquema: buscou "${term}"`);

  return {
    arquivo: asset.title,
    total_de_paginas: pages.length,
    ...(allMatches.length > MAX_SCHEMATIC_MATCHES
      ? { aviso: `Mostrando ${MAX_SCHEMATIC_MATCHES} de ${allMatches.length} paginas; use um termo mais especifico.` }
      : {}),
    ocorrencias: matches.map((match) => ({
      pagina: match.pageNumber,
      vezes: match.occurrences,
      trecho: match.excerpt,
    })),
  };
}

async function readSchematicPage(ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) {
  const pageNumber = readNumber(input, "pagina");
  const { asset, pages } = await requireSchematic(ctx);
  const page = pages.find((item) => item.pageNumber === pageNumber);

  if (!page) {
    throw new ToolInputError(`Pagina invalida. O esquema tem ${pages.length} paginas.`);
  }

  ctx.actions.push(`Esquema: leu a página ${page.pageNumber}`);

  return {
    arquivo: asset.title,
    pagina: page.pageNumber,
    texto:
      page.text.length > MAX_SCHEMATIC_PAGE_CHARS
        ? `${page.text.slice(0, MAX_SCHEMATIC_PAGE_CHARS)} [...texto cortado]`
        : page.text,
    abrir_no_lab: ctx.workbench.buildLabHref("schematic", { page: page.pageNumber }),
  };
}

async function readReferenceValues(ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) {
  const component = readString(input, "componente");
  const { data: boards } = await ctx.supabase
    .from("diagnostic_boards")
    .select("board_id, boards(board_code)")
    .eq("diagnostic_id", ctx.diagnosticId);
  const boardIds = (boards ?? [])
    .map((item) => item.board_id as string | null)
    .filter((value): value is string => Boolean(value));

  if (!boardIds.length) {
    return {
      valores: [],
      aviso: "Nenhuma placa (codigo da board) vinculada a este caso; nao ha valores de referencia para consultar.",
    };
  }

  let query = ctx.supabase
    .from("board_measurements")
    .select("component_ref, measurement_point, expected_value, condition, notes")
    .in("board_id", boardIds)
    .order("component_ref", { ascending: true })
    .limit(MAX_REFERENCE_VALUES);

  if (component) {
    query = query.ilike("component_ref", `%${component.replace(/[%_]/g, " ").trim()}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  ctx.actions.push(`Consultou valores de referência${component ? ` de ${component}` : ""}`);

  return { valores: data ?? [] };
}

async function readCaseRecords(ctx: DiagnosticAgentToolContext) {
  const [measurements, hypotheses, tests] = await Promise.all([
    ctx.supabase
      .from("measurements")
      .select(
        "measurement_type, point_label, measured_value_text, measured_value_numeric, unit, expected_value_text, is_out_of_range, measurement_context, measured_at",
      )
      .eq("diagnostic_id", ctx.diagnosticId)
      .order("measured_at", { ascending: false })
      .limit(100),
    ctx.supabase
      .from("hypotheses")
      .select("id, title, description, status, confidence_score, evidence_summary, contradictions_summary, created_by_type")
      .eq("diagnostic_id", ctx.diagnosticId)
      .order("created_at", { ascending: true }),
    ctx.supabase
      .from("diagnostic_test_runs")
      .select("result_status, actual_result, conclusion, procedure_notes, tests(name)")
      .eq("diagnostic_id", ctx.diagnosticId)
      .order("step_order", { ascending: true }),
  ]);

  return {
    medicoes: measurements.data ?? [],
    hipoteses: hypotheses.data ?? [],
    testes: tests.data ?? [],
  };
}

async function recordMeasurement(ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) {
  const measurementType = readEnum(input, "tipo", MEASUREMENT_TYPES);
  const pointLabel = readString(input, "ponto", true)!;
  const measuredValueText = readString(input, "valor_medido", true)!;
  const { error } = await ctx.supabase.from("measurements").insert({
    diagnostic_id: ctx.diagnosticId,
    measurement_type: measurementType,
    point_label: pointLabel,
    measured_value_text: measuredValueText,
    measured_value_numeric: parseNumericValue(measuredValueText),
    unit: readString(input, "unidade"),
    expected_value_text: readString(input, "valor_esperado"),
    is_out_of_range: input.fora_da_faixa === true,
    measurement_context: readString(input, "contexto"),
    measured_by_user_id: ctx.userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  ctx.wroteToCase.value = true;
  ctx.actions.push(`Registrou medição: ${pointLabel} = ${measuredValueText}`);

  return { ok: true };
}

async function recordHypothesis(ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) {
  const title = readString(input, "titulo", true)!;
  const { data, error } = await ctx.supabase
    .from("hypotheses")
    .insert({
      diagnostic_id: ctx.diagnosticId,
      title,
      description: readString(input, "descricao"),
      evidence_summary: readString(input, "evidencias"),
      confidence_score: readNumber(input, "confianca"),
      status: "open",
      created_by_type: "ai",
      created_by_user_id: ctx.userId,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  ctx.wroteToCase.value = true;
  ctx.actions.push(`Registrou hipótese: ${title}`);

  return { ok: true, hipotese_id: data.id };
}

async function updateHypothesis(ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) {
  const hypothesisId = readString(input, "hipotese_id", true)!;
  const status = readEnum(input, "status", HYPOTHESIS_STATUSES);
  const updates: Record<string, unknown> = { status };
  const evidence = readString(input, "evidencias");
  const contradictions = readString(input, "contradicoes");
  const confidence = readNumber(input, "confianca");

  if (evidence) updates.evidence_summary = evidence;
  if (contradictions) updates.contradictions_summary = contradictions;
  if (confidence !== null) updates.confidence_score = confidence;

  const { data, error } = await ctx.supabase
    .from("hypotheses")
    .update(updates)
    .eq("id", hypothesisId)
    .eq("diagnostic_id", ctx.diagnosticId)
    .select("title")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new ToolInputError("Hipotese nao encontrada neste caso.");
  }

  ctx.wroteToCase.value = true;
  ctx.actions.push(`Hipótese "${data.title}" → ${status}`);

  return { ok: true };
}

async function updateCaseSummary(ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) {
  const summary = readString(input, "resumo", true)!;
  const { error } = await ctx.supabase
    .from("diagnostics")
    .update({ current_summary: summary })
    .eq("id", ctx.diagnosticId);

  if (error) {
    throw new Error(error.message);
  }

  ctx.wroteToCase.value = true;
  ctx.actions.push("Atualizou o resumo do caso");

  return { ok: true };
}

function normalizeCatalogName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Grava o equipamento no caso. O texto vai sempre em equipment_label (titulo
 * na lista); fabricante e modelo so sao ligados ao catalogo quando ja existem
 * com o mesmo nome — a IA nao cria entradas novas no catalogo.
 */
async function updateCaseEquipment(ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) {
  const manufacturerName = readString(input, "fabricante");
  const modelName = readString(input, "modelo");
  const boardCode = readString(input, "placa");

  if (!manufacturerName && !modelName && !boardCode) {
    throw new ToolInputError("Informe ao menos fabricante, modelo ou placa.");
  }

  const label = [
    [manufacturerName, modelName].filter(Boolean).join(" "),
    boardCode ? (manufacturerName || modelName ? `(${boardCode})` : boardCode) : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 120);

  const update: Record<string, string> = { equipment_label: label };
  const linked: string[] = [];

  let manufacturerId: string | null = null;
  if (manufacturerName) {
    const { data } = await ctx.supabase
      .from("manufacturers")
      .select("id, name")
      .eq("normalized_name", normalizeCatalogName(manufacturerName))
      .maybeSingle();
    if (data?.id) {
      manufacturerId = data.id as string;
      update.manufacturer_id = manufacturerId;
      linked.push(`fabricante ${data.name}`);
    }
  }

  if (modelName && manufacturerId) {
    const { data } = await ctx.supabase
      .from("equipment_models")
      .select("id, model_name")
      .eq("manufacturer_id", manufacturerId)
      .eq("normalized_model_name", normalizeCatalogName(modelName))
      .maybeSingle();
    if (data?.id) {
      update.equipment_model_id = data.id as string;
      linked.push(`modelo ${data.model_name}`);
    }
  }

  // O nome que o tecnico fala (ex.: "Stealth 15M A11UEK") raramente bate com o nome
  // curto do catalogo (ex.: "MS 1563", baseado no codigo da placa) — quando o modelo
  // nao casou mas veio o codigo da placa, tenta achar o modelo por ela.
  if (!update.equipment_model_id && boardCode) {
    const { data: board } = await ctx.supabase
      .from("boards")
      .select("id, board_code")
      .ilike("board_code", boardCode)
      .maybeSingle();
    if (board?.id) {
      const { data: modelBoard } = await ctx.supabase
        .from("model_boards")
        .select("equipment_model_id, equipment_models(id, model_name, manufacturer_id)")
        .eq("board_id", board.id)
        .maybeSingle();
      const model = modelBoard?.equipment_models as
        | { id: string; model_name: string; manufacturer_id: string }
        | null
        | undefined;
      if (model?.id && (!manufacturerId || model.manufacturer_id === manufacturerId)) {
        update.equipment_model_id = model.id;
        if (!manufacturerId) {
          update.manufacturer_id = model.manufacturer_id;
        }
        linked.push(`modelo ${model.model_name} (pela placa ${board.board_code})`);
      }
    }
  }

  const { error } = await ctx.supabase.from("diagnostics").update(update).eq("id", ctx.diagnosticId);

  if (error) {
    throw new Error(error.message);
  }

  ctx.wroteToCase.value = true;
  ctx.actions.push(`Registrou o equipamento: ${label}`);

  return {
    ok: true,
    equipamento: label,
    ligado_ao_catalogo: linked.length ? linked : "nao (modelo nao cadastrado no catalogo; ficou so a descricao)",
  };
}

function readObject(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

async function recordCaseTests(ctx: DiagnosticAgentToolContext, items: unknown) {
  const registered: string[] = [];
  const unmatched: string[] = [];

  if (!Array.isArray(items) || !items.length) {
    return { registered, unmatched };
  }

  const [{ data: catalog }, { data: lastRun }, { data: primaryBoard }] = await Promise.all([
    ctx.supabase.from("tests").select("id, name"),
    ctx.supabase
      .from("diagnostic_test_runs")
      .select("step_order")
      .eq("diagnostic_id", ctx.diagnosticId)
      .order("step_order", { ascending: false })
      .limit(1),
    ctx.supabase
      .from("diagnostic_boards")
      .select("id")
      .eq("diagnostic_id", ctx.diagnosticId)
      .eq("is_primary", true)
      .maybeSingle(),
  ]);

  let step = lastRun?.[0]?.step_order ?? 0;

  for (const raw of items) {
    const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const name = readString(item, "teste");
    const happened = readString(item, "o_que_aconteceu");
    if (!name || !happened) {
      continue;
    }
    const wanted = normalizeCatalogName(name);
    const test = (catalog ?? []).find((entry) => {
      const known = normalizeCatalogName(String(entry.name));
      return known === wanted || known.includes(wanted) || wanted.includes(known);
    });
    if (!test) {
      unmatched.push(name);
      continue;
    }

    step += 1;
    const { error } = await ctx.supabase.from("diagnostic_test_runs").insert({
      diagnostic_id: ctx.diagnosticId,
      test_id: test.id,
      diagnostic_board_id: primaryBoard?.id ?? null,
      performed_by_user_id: ctx.userId,
      step_order: step,
      result_status: readEnum(item, "resultado", TEST_RESULT_STATUSES),
      actual_result: happened,
    });
    if (error) {
      throw new Error(error.message);
    }
    registered.push(String(test.name));
  }

  return { registered, unmatched };
}

async function recordDeviceData(ctx: DiagnosticAgentToolContext, device: Record<string, unknown> | null) {
  const filled: string[] = [];
  if (!device) {
    return filled;
  }

  const { data: current } = await ctx.supabase
    .from("diagnostics")
    .select("equipment_details")
    .eq("id", ctx.diagnosticId)
    .maybeSingle();
  const details = { ...((current?.equipment_details as Record<string, unknown> | null) ?? {}) };
  const update: Record<string, unknown> = {};

  const serial = readString(device, "numero_de_serie");
  if (serial) {
    update.equipment_serial_number = serial;
    filled.push("série");
  }
  const physical = readString(device, "estado_fisico");
  if (physical) {
    update.physical_condition_notes = physical;
    filled.push("estado físico");
  }
  if (typeof device.chega_alimentacao === "boolean") {
    details.powerPresent = device.chega_alimentacao;
    filled.push("alimentação");
  }
  if (typeof device.liga === "boolean") {
    details.powersOn = device.liga;
    filled.push("liga");
  }
  const screen = readString(device, "tela");
  if (screen && (SCREEN_CONDITIONS as readonly string[]).includes(screen)) {
    details.screenCondition = screen;
    filled.push("tela");
  }

  if (!filled.length) {
    return filled;
  }

  const { error } = await ctx.supabase
    .from("diagnostics")
    .update({ ...update, equipment_details: details })
    .eq("id", ctx.diagnosticId);
  if (error) {
    throw new Error(error.message);
  }
  return filled;
}

async function closeCase(ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) {
  const caseStatus = readEnum(input, "estado_final", CLOSURE_CASE_STATUSES);
  const summary = readString(input, "resumo", true)!;
  const outcome = readString(input, "resultado_do_reparo", true)!;
  const cause = readObject(input, "causa");
  const solution = readObject(input, "solucao");

  // Testes e dados do aparelho antes do fechamento: entram no texto usado na busca de casos parecidos.
  const tests = await recordCaseTests(ctx, input.testes_feitos);
  const deviceFields = await recordDeviceData(ctx, readObject(input, "aparelho"));

  await closeDiagnosticCase(ctx.supabase, ctx.diagnosticId, ctx.userId, {
    caseStatus,
    resolutionSummary: summary,
    repairOutcome: outcome,
    finalFailureMode: readString(input, "modo_de_falha"),
    cause: cause
      ? {
          type: readEnum(cause, "tipo", CLOSURE_CAUSE_TYPES),
          title: readString(cause, "titulo") ?? "",
          explanation: readString(cause, "explicacao") ?? "",
        }
      : null,
    solution: solution
      ? {
          type: readEnum(solution, "tipo", CLOSURE_SOLUTION_TYPES),
          title: readString(solution, "titulo") ?? "",
          procedure: readString(solution, "procedimento") ?? "",
        }
      : null,
  });

  ctx.wroteToCase.value = true;
  if (ctx.closedCase) {
    ctx.closedCase.value = true;
  }
  ctx.actions.push(`Encerrou o caso (${caseStatus})`);
  if (tests.registered.length) {
    ctx.actions.push(`Registrou testes: ${tests.registered.join(", ")}`);
  }
  if (deviceFields.length) {
    ctx.actions.push(`Preencheu dados do aparelho: ${deviceFields.join(", ")}`);
  }

  return {
    ok: true,
    testes_registrados: tests.registered,
    testes_fora_do_catalogo: tests.unmatched,
    dados_do_aparelho: deviceFields,
    parecer: "o parecer tecnico estruturado sera gerado automaticamente em seguida",
  };
}

const TOOL_HANDLERS: Record<
  string,
  (ctx: DiagnosticAgentToolContext, input: Record<string, unknown>) => Promise<unknown>
> = {
  listar_arquivos_tecnicos: listTechnicalAssets,
  usar_arquivo_tecnico: activateTechnicalAsset,
  buscar_no_boardview: searchBoardview,
  detalhar_componente: describeComponent,
  detalhar_net: describeNet,
  buscar_no_esquema: searchSchematic,
  ler_pagina_do_esquema: readSchematicPage,
  valores_de_referencia: readReferenceValues,
  consultar_registros_do_caso: readCaseRecords,
  registrar_medicao: recordMeasurement,
  registrar_hipotese: recordHypothesis,
  atualizar_hipotese: updateHypothesis,
  atualizar_resumo_do_caso: updateCaseSummary,
  atualizar_equipamento_do_caso: updateCaseEquipment,
  encerrar_diagnostico: closeCase,
};

export async function runDiagnosticAgentTool(
  ctx: DiagnosticAgentToolContext,
  toolUse: Anthropic.Beta.BetaToolUseBlock,
): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  const handler = TOOL_HANDLERS[toolUse.name];
  const input =
    toolUse.input && typeof toolUse.input === "object"
      ? (toolUse.input as Record<string, unknown>)
      : {};

  if (!handler) {
    return {
      type: "tool_result",
      tool_use_id: toolUse.id,
      is_error: true,
      content: `Ferramenta desconhecida: ${toolUse.name}`,
    };
  }

  try {
    const result = await handler(ctx, input);
    return {
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: JSON.stringify(result),
    };
  } catch (error) {
    return {
      type: "tool_result",
      tool_use_id: toolUse.id,
      is_error: true,
      content: error instanceof Error ? error.message : "Falha ao executar a ferramenta.",
    };
  }
}
