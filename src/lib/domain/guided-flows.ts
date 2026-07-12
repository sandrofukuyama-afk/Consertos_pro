export type GuidedFlowStepDefinition = {
  order: number;
  label: string;
  description: string;
  testGroup: string;
};

const DESKTOP_FLOW: GuidedFlowStepDefinition[] = [
  {
    order: 1,
    label: "Confirmar energização",
    description: "Checar LED de status, ventoinhas e resposta ao botão de power.",
    testGroup: "power",
  },
  {
    order: 2,
    label: "Isolar fonte de alimentação",
    description: "Medir tensões primárias da fonte fora da placa-mãe, se possível.",
    testGroup: "power",
  },
  {
    order: 3,
    label: "Verificar sinais de vídeo",
    description: "Confirmar POST e saída de vídeo antes de investigar periféricos.",
    testGroup: "electrical",
  },
  {
    order: 4,
    label: "Testar memória e sequência de boot",
    description: "Isolar módulos de memória e checar beeps ou códigos de erro.",
    testGroup: "firmware",
  },
  {
    order: 5,
    label: "Isolar componente ou periférico suspeito",
    description: "Remover ou substituir o subconjunto suspeito por um conhecido bom.",
    testGroup: "replacement",
  },
];

const NOTEBOOK_FLOW: GuidedFlowStepDefinition[] = [
  {
    order: 1,
    label: "Medir consumo em fonte assimétrica",
    description: "Com bateria removida quando aplicável, checar consumo inicial ao ligar.",
    testGroup: "power",
  },
  {
    order: 2,
    label: "Confirmar sequência de start",
    description: "Observar LEDs, ventoinha e tentativas de POST.",
    testGroup: "power",
  },
  {
    order: 3,
    label: "Checar tela e backlight",
    description: "Testar com fonte de vídeo externa se a imagem não aparecer no painel.",
    testGroup: "electrical",
  },
  {
    order: 4,
    label: "Validar firmware ou BIOS",
    description: "Confirmar se há corrupção de firmware antes de trocas de hardware.",
    testGroup: "firmware",
  },
  {
    order: 5,
    label: "Isolar componente suspeito",
    description: "Substituir ou remover o subconjunto suspeito para confirmar a causa.",
    testGroup: "replacement",
  },
];

const TELEVISION_FLOW: GuidedFlowStepDefinition[] = [
  {
    order: 1,
    label: "Isolar a fonte de alimentação",
    description: "Medir tensões de saída da fonte antes de suspeitar do painel.",
    testGroup: "power",
  },
  {
    order: 2,
    label: "Checar backlight",
    description: "Usar lanterna no painel para confirmar imagem fantasma sem luz de fundo.",
    testGroup: "electrical",
  },
  {
    order: 3,
    label: "Verificar T-Con e trilha de vídeo",
    description: "Isolar entre processamento de imagem e o próprio painel.",
    testGroup: "electrical",
  },
  {
    order: 4,
    label: "Confirmar entradas de sinal (HDMI e afins)",
    description: "Testar com fontes de sinal alternativas antes de trocar placas.",
    testGroup: "replacement",
  },
];

const SMARTPHONE_FLOW: GuidedFlowStepDefinition[] = [
  {
    order: 1,
    label: "Verificar linha VBAT",
    description: "Medir consumo e tensão da linha principal de bateria.",
    testGroup: "power",
  },
  {
    order: 2,
    label: "Verificar linha de carga",
    description: "Confirmar se o carregamento inicia e se há aquecimento anormal.",
    testGroup: "power",
  },
  {
    order: 3,
    label: "Observar aquecimento localizado",
    description: "Identificar pontos quentes que indiquem curto ou componente danificado.",
    testGroup: "electrical",
  },
  {
    order: 4,
    label: "Testar tela e digitalizador",
    description: "Isolar entre defeito de imagem e defeito de toque.",
    testGroup: "replacement",
  },
];

export function getGuidedFlowForCategory(category: string): GuidedFlowStepDefinition[] {
  const normalized = category.toLowerCase();

  if (normalized.includes("notebook")) {
    return NOTEBOOK_FLOW;
  }

  if (normalized.includes("television")) {
    return TELEVISION_FLOW;
  }

  if (normalized.includes("smartphone")) {
    return SMARTPHONE_FLOW;
  }

  return DESKTOP_FLOW;
}
