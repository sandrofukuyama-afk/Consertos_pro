export type DecisionBranch = {
  success: string | null;      // ID do próximo nó se o teste passar (passed)
  failed: string | null;       // ID do próximo nó se o teste falhar (failed)
  inconclusive: string | null; // ID do próximo nó se for inconclusivo
};

export type GuidedTreeNode = {
  id: string;
  label: string;
  description: string;
  testSlug: string;
  testGroup: string;
  branches: DecisionBranch;
  conclusion?: {
    outcome: "success" | "failure";
    summary: string;
  };
};

const DESKTOP_TREE: Record<string, GuidedTreeNode> = {
  root: {
    id: "root",
    label: "Confirmar energização",
    description: "Conectar a fonte de alimentação e checar se há consumo ou LEDs acesos.",
    testSlug: "teste_fonte_assimetrica",
    testGroup: "power",
    branches: {
      success: "check_video",
      failed: "isolate_psu",
      inconclusive: "check_video",
    },
  },
  isolate_psu: {
    id: "isolate_psu",
    label: "Isolar a fonte de alimentação (PSU)",
    description: "Medir tensões de saída da fonte (12V, 5V, 3.3V) desconectada da placa.",
    testSlug: "medicao_tensao",
    testGroup: "power",
    branches: {
      success: "check_video",
      failed: "replace_psu",
      inconclusive: "check_video",
    },
  },
  replace_psu: {
    id: "replace_psu",
    label: "Fazer substituição cruzada da fonte",
    description: "Testar o computador usando outra fonte sabidamente boa.",
    testSlug: "substituicao_cruzada",
    testGroup: "replacement",
    branches: {
      success: "conclusion_psu_ok",
      failed: "conclusion_motherboard_dead",
      inconclusive: "conclusion_motherboard_dead",
    },
  },
  check_video: {
    id: "check_video",
    label: "Verificar sinais de vídeo",
    description: "Ligar a placa e checar se apresenta vídeo na saída integrada (HDMI/VGA) ou se emite beeps.",
    testSlug: "teste_continuidade",
    testGroup: "electrical",
    branches: {
      success: "test_boot",
      failed: "isolate_gpu",
      inconclusive: "test_boot",
    },
  },
  isolate_gpu: {
    id: "isolate_gpu",
    label: "Isolar placa de vídeo dedicada",
    description: "Remover a GPU dedicada e testar apenas com o vídeo integrado para descartar curto na linha PCI Express.",
    testSlug: "substituicao_cruzada",
    testGroup: "replacement",
    branches: {
      success: "conclusion_gpu_bad",
      failed: "test_ram_bios",
      inconclusive: "test_ram_bios",
    },
  },
  test_ram_bios: {
    id: "test_ram_bios",
    label: "Validar memória RAM e BIOS",
    description: "Limpar os contatos dos módulos de memória ou testar com outro módulo de teste.",
    testSlug: "regravacao_bios",
    testGroup: "firmware",
    branches: {
      success: "conclusion_ram_bios_ok",
      failed: "conclusion_motherboard_dead",
      inconclusive: "conclusion_motherboard_dead",
    },
  },
  test_boot: {
    id: "test_boot",
    label: "Testar sequência de boot",
    description: "Validar se o sistema operacional carrega sem telas azuis ou travamentos de disco.",
    testSlug: "regravacao_bios",
    testGroup: "firmware",
    branches: {
      success: "conclusion_system_ok",
      failed: "conclusion_system_corrupt",
      inconclusive: "conclusion_system_corrupt",
    },
  },
  // Conclusões / Nós Folhas
  conclusion_psu_ok: {
    id: "conclusion_psu_ok",
    label: "Fonte com defeito confirmada",
    description: "O computador ligou normalmente com a nova fonte. Substituição definitiva é recomendada.",
    testSlug: "substituicao_cruzada",
    testGroup: "replacement",
    branches: { success: null, failed: null, inconclusive: null },
    conclusion: { outcome: "success", summary: "Substituição da fonte de alimentação recomendada." },
  },
  conclusion_motherboard_dead: {
    id: "conclusion_motherboard_dead",
    label: "Placa-mãe sem reparo aparente",
    description: "Mesmo com fonte nova e componentes isolados, a placa-mãe não responde aos testes básicos.",
    testSlug: "substituicao_cruzada",
    testGroup: "replacement",
    branches: { success: null, failed: null, inconclusive: null },
    conclusion: { outcome: "failure", summary: "Defeito na placa-mãe sem possibilidade de reparo rápido." },
  },
  conclusion_gpu_bad: {
    id: "conclusion_gpu_bad",
    label: "Placa de vídeo com defeito",
    description: "O vídeo integrado funcionou perfeitamente após a remoção da placa dedicada. A GPU está em curto ou com falha.",
    testSlug: "substituicao_cruzada",
    testGroup: "replacement",
    branches: { success: null, failed: null, inconclusive: null },
    conclusion: { outcome: "success", summary: "Substituição ou reparo da placa de vídeo dedicada." },
  },
  conclusion_ram_bios_ok: {
    id: "conclusion_ram_bios_ok",
    label: "Problema resolvido na memória ou BIOS",
    description: "Após a limpeza física ou regravação de BIOS, o equipamento voltou a dar sinal de vida estável.",
    testSlug: "regravacao_bios",
    testGroup: "firmware",
    branches: { success: null, failed: null, inconclusive: null },
    conclusion: { outcome: "success", summary: "Problema solucionado com manutenção preventiva de RAM/BIOS." },
  },
  conclusion_system_ok: {
    id: "conclusion_system_ok",
    label: "Equipamento testado e aprovado",
    description: "Toda a sequência de boot, tensões e funcionamento do sistema operacional estão perfeitos.",
    testSlug: "regravacao_bios",
    testGroup: "firmware",
    branches: { success: null, failed: null, inconclusive: null },
    conclusion: { outcome: "success", summary: "Diagnóstico finalizado. Aparelho em perfeito estado." },
  },
  conclusion_system_corrupt: {
    id: "conclusion_system_corrupt",
    label: "Falha de software ou HD/SSD",
    description: "As tensões e vídeo estão OK, mas o carregamento do sistema falha. Indica corrupção ou disco danificado.",
    testSlug: "substituicao_cruzada",
    testGroup: "replacement",
    branches: { success: null, failed: null, inconclusive: null },
    conclusion: { outcome: "success", summary: "Necessário reinstalar sistema operacional ou substituir HD/SSD." },
  },
};

const NOTEBOOK_TREE: Record<string, GuidedTreeNode> = {
  root: {
    id: "root",
    label: "Medir consumo inicial",
    description: "Conectar na fonte assimétrica sem bateria. Observar o consumo de corrente (mA) em standby.",
    testSlug: "teste_fonte_assimetrica",
    testGroup: "power",
    branches: {
      success: "check_power_button",
      failed: "measure_input_voltages",
      inconclusive: "check_power_button",
    },
  },
  measure_input_voltages: {
    id: "measure_input_voltages",
    label: "Medir tensões de entrada",
    description: "Verificar se os 19V chegam após o DC Jack e passam pelos MOSFETs de entrada.",
    testSlug: "medicao_tensao",
    testGroup: "power",
    branches: {
      success: "check_charger_control",
      failed: "conclusion_input_short",
      inconclusive: "check_charger_control",
    },
  },
  check_charger_control: {
    id: "check_charger_control",
    label: "Checar CI de carga (Charger)",
    description: "Validar se o circuito integrado de gerenciamento de energia está liberando os sinais corretos.",
    testSlug: "medicao_tensao",
    testGroup: "power",
    branches: {
      success: "check_power_button",
      failed: "conclusion_ic_failed",
      inconclusive: "check_power_button",
    },
  },
  check_power_button: {
    id: "check_power_button",
    label: "Confirmar sequência de start",
    description: "Medir se o sinal do botão power cai para 0V ao pressioná-lo e sobe novamente.",
    testSlug: "medicao_tensao",
    testGroup: "power",
    branches: {
      success: "check_screen_video",
      failed: "conclusion_io_failed",
      inconclusive: "check_screen_video",
    },
  },
  check_screen_video: {
    id: "check_screen_video",
    label: "Checar tela e vídeo externo",
    description: "Se ligar mas não apresentar imagem, conectar um monitor externo para isolar se a falha é na tela.",
    testSlug: "teste_continuidade",
    testGroup: "electrical",
    branches: {
      success: "conclusion_screen_bad",
      failed: "validate_bios",
      inconclusive: "validate_bios",
    },
  },
  validate_bios: {
    id: "validate_bios",
    label: "Validar firmware da BIOS",
    description: "Realizar a regravação da BIOS com um arquivo limpo e verificado para o modelo exato.",
    testSlug: "regravacao_bios",
    testGroup: "firmware",
    branches: {
      success: "conclusion_bios_ok",
      failed: "conclusion_motherboard_dead",
      inconclusive: "conclusion_motherboard_dead",
    },
  },
  // Conclusões
  conclusion_input_short: {
    id: "conclusion_input_short",
    label: "Curto-circuito na linha principal",
    description: "Confirmado curto ou queima nos componentes da entrada de energia (DC Jack ou MOSFETs).",
    testSlug: "medicao_tensao",
    testGroup: "power",
    branches: { success: null, failed: null, inconclusive: null },
    conclusion: { outcome: "success", summary: "Reparo recomendado no circuito de entrada de 19V." },
  },
  conclusion_ic_failed: {
    id: "conclusion_ic_failed",
    label: "Falha no CI de Charger ou Super I/O",
    description: "Sinais de controle ausentes. Substituição do circuito integrado de gerenciamento de carga recomendada.",
    testSlug: "medicao_tensao",
    testGroup: "power",
    branches: { success: null, failed: null, inconclusive: null },
    conclusion: { outcome: "success", summary: "Substituição do CI integrado recomendada." },
  },
  conclusion_io_failed: {
    id: "conclusion_io_failed",
    label: "Falha no sinal de acionamento do botão",
    description: "O botão está ruim ou o circuito integrado Super I/O não responde ao sinal físico.",
    testSlug: "medicao_tensao",
    testGroup: "power",
    branches: { success: null, failed: null, inconclusive: null },
    conclusion: { outcome: "success", summary: "Substituição do teclado/botão ou gravação de chip Super I/O." },
  },
  conclusion_screen_bad: {
    id: "conclusion_screen_bad",
    label: "Defeito na tela ou cabo flat",
    description: "Notebook apresenta vídeo normal no monitor externo, mas não na tela local. Sinaliza falha na tela ou cabo LVDS.",
    testSlug: "teste_continuidade",
    testGroup: "electrical",
    branches: { success: null, failed: null, inconclusive: null },
    conclusion: { outcome: "success", summary: "Recomendada a troca da tela do notebook ou do cabo flat." },
  },
  conclusion_bios_ok: {
    id: "conclusion_bios_ok",
    label: "Gravação de BIOS com sucesso",
    description: "Notebook voltou a dar vídeo e POST estável após a atualização limpa da BIOS.",
    testSlug: "regravacao_bios",
    testGroup: "firmware",
    branches: { success: null, failed: null, inconclusive: null },
    conclusion: { outcome: "success", summary: "Reparo feito através da reprogramação do chip SPI." },
  },
  conclusion_motherboard_dead: {
    id: "conclusion_motherboard_dead",
    label: "Falha física na placa-mãe (PCH / CPU)",
    description: "Todas as tensões estão presentes, BIOS regravada, mas a placa não responde de forma alguma.",
    testSlug: "substituicao_cruzada",
    testGroup: "replacement",
    branches: { success: null, failed: null, inconclusive: null },
    conclusion: { outcome: "failure", summary: "Defeito irreversível ou complexo na placa principal." },
  },
};

// Se a categoria for desconhecida ou TV/Celular, caímos em fluxos simplificados parecidos.
export function getGuidedTreeForCategory(categorySlug: string): Record<string, GuidedTreeNode> {
  const slug = categorySlug.toLowerCase();
  if (slug === "notebook") {
    return NOTEBOOK_TREE;
  }
  // Padrão para Desktop e outras categorias
  return DESKTOP_TREE;
}
