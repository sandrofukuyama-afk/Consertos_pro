export type GuidedFlowStepDefinition = {
  order: number;
  label: string;
  description: string;
  testGroup: string;
};

const DESKTOP_FLOW: GuidedFlowStepDefinition[] = [
  {
    order: 1,
    label: "Confirmar energizacao",
    description: "Checar LED de status, ventoinhas e resposta ao botao de power.",
    testGroup: "power",
  },
  {
    order: 2,
    label: "Isolar fonte de alimentacao",
    description: "Medir tensoes primarias da fonte fora da placa-mae, se possivel.",
    testGroup: "power",
  },
  {
    order: 3,
    label: "Verificar sinais de video",
    description: "Confirmar POST e saida de video antes de investigar perifericos.",
    testGroup: "electrical",
  },
  {
    order: 4,
    label: "Testar memoria e sequencia de boot",
    description: "Isolar modulos de memoria e checar beeps ou codigos de erro.",
    testGroup: "firmware",
  },
  {
    order: 5,
    label: "Isolar componente ou periferico suspeito",
    description: "Remover ou substituir o subconjunto suspeito por um conhecido bom.",
    testGroup: "replacement",
  },
];

const NOTEBOOK_FLOW: GuidedFlowStepDefinition[] = [
  {
    order: 1,
    label: "Medir consumo em fonte assimetrica",
    description: "Com bateria removida quando aplicavel, checar consumo inicial ao ligar.",
    testGroup: "power",
  },
  {
    order: 2,
    label: "Confirmar sequencia de start",
    description: "Observar LEDs, ventoinha e tentativas de POST.",
    testGroup: "power",
  },
  {
    order: 3,
    label: "Checar tela e backlight",
    description: "Testar com fonte de video externa se a imagem nao aparecer no painel.",
    testGroup: "electrical",
  },
  {
    order: 4,
    label: "Validar firmware ou BIOS",
    description: "Confirmar se ha corrupcao de firmware antes de trocas de hardware.",
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
    label: "Isolar a fonte de alimentacao",
    description: "Medir tensoes de saida da fonte antes de suspeitar do painel.",
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
    label: "Verificar T-Con e trilha de video",
    description: "Isolar entre processamento de imagem e o proprio painel.",
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
    description: "Medir consumo e tensao da linha principal de bateria.",
    testGroup: "power",
  },
  {
    order: 2,
    label: "Verificar linha de carga",
    description: "Confirmar se o carregamento inicia e se ha aquecimento anormal.",
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
