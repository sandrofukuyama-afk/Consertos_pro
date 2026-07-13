import type {
  DiagnosticCase,
  DocumentItem,
  Hypothesis,
  Kpi,
  KnowledgeItem,
  ModuleTask,
  NavItem,
  TimelineEntry,
} from "@/types/domain";

export const navItems: NavItem[] = [
  {
    href: "/",
    label: "Diagnósticos",
    description: "Casos, timeline e próximos testes",
  },
  {
    href: "/catalogo-tecnico",
    label: "Catálogo Técnico",
    description: "Marcas, modelos, placas e componentes",
  },
  {
    href: "/biblioteca",
    label: "Biblioteca",
    description: "Documentos, PDFs e firmwares",
  },
  {
    href: "/conhecimento",
    label: "Conhecimento",
    description: "Causas confirmadas e soluções",
  },
  {
    href: "/busca",
    label: "Busca",
    description: "Pesquisar casos e documentos",
  },
  {
    href: "/estatisticas",
    label: "Estatísticas",
    description: "Problemas que mais aparecem e tempo medio",
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    description: "Usuários e permissões",
  },
];

export const kpis: Kpi[] = [
  {
    label: "Ativos",
    value: "18",
    change: "+4 esta semana",
    tone: "teal",
  },
  {
    label: "Aguardando teste",
    value: "06",
    change: "2 com prioridade alta",
    tone: "copper",
  },
  {
    label: "Resolvidos hoje",
    value: "03",
    change: "1 promovido para memória",
    tone: "amber",
  },
];

export const activeDiagnostics: DiagnosticCase[] = [
  {
    id: "DX-2048",
    category: "Notebook",
    equipment: "Lenovo IdeaPad 3 15ALC6",
    symptom: "Liga sem imagem e aquece PCH",
    board: "Mainboard NM-D031",
    technician: "Marcos Vieira",
    updatedAt: "há 12 min",
    status: "Ativo",
  },
  {
    id: "DX-2051",
    category: "Televisor",
    equipment: "Samsung UN50AU7700",
    symptom: "Liga com som sem imagem",
    board: "T-Con BN96-56812A",
    technician: "Bruna Cezar",
    updatedAt: "há 27 min",
    status: "Aguardando teste",
  },
  {
    id: "DX-2053",
    category: "Celular",
    equipment: "Motorola Edge 30 Neo",
    symptom: "Não carrega após troca de conector",
    board: "Sub-board carga XT2245",
    technician: "Rafael Teles",
    updatedAt: "há 45 min",
    status: "Ativo",
  },
  {
    id: "DX-2054",
    category: "Desktop",
    equipment: "Dell OptiPlex 7090",
    symptom: "Desliga após 15 segundos",
    board: "Mainboard Q470",
    technician: "Livia Rocha",
    updatedAt: "há 1 h",
    status: "Resolvido hoje",
  },
];

export const timeline: TimelineEntry[] = [
  {
    time: "09:12",
    title: "Medição 19V registrada",
    description: "Linha principal estável na entrada da mainboard.",
  },
  {
    time: "09:36",
    title: "Teste com fonte assimétrica",
    description: "Consumo inicial em 0.041A sem subida de imagem.",
  },
  {
    time: "10:05",
    title: "Hipótese fortalecida",
    description: "Curto intermitente na linha LCD_VDD após aquecimento.",
  },
];

export const hypotheses: Hypothesis[] = [
  {
    title: "Falha em regulador da linha LCD_VDD",
    confidence: "0.74",
    evidence: "Consumo anormal ao acionar backlight",
    status: "Fortalecida",
  },
  {
    title: "Firmware corrompido após atualização",
    confidence: "0.41",
    evidence: "Histórico do equipamento indica falha após reinício",
    status: "Aberta",
  },
  {
    title: "Cabo flat com fuga para terra",
    confidence: "0.18",
    evidence: "Sem reprodução ao isolar o conjunto",
    status: "Descartada",
  },
];

export const documents: DocumentItem[] = [
  {
    title: "Esquema NM-D031 rev. 1.0",
    type: "Schematic",
    relation: "Lenovo IdeaPad 3",
  },
  {
    title: "Mapa de tensões BN96-56812A",
    type: "Voltage map",
    relation: "Samsung UN50AU7700",
  },
  {
    title: "BIOS dump OptiPlex 7090",
    type: "Firmware",
    relation: "Dell OptiPlex 7090",
  },
];

export const knowledgeItems: KnowledgeItem[] = [
  {
    cause: "Curto no circuito de backlight após oxidação",
    incidence: "12 casos",
    note: "Recorrência alta em notebooks com dano líquido leve.",
  },
  {
    cause: "EEPROM corrompida após queda de energia",
    incidence: "7 casos",
    note: "Regravacao resolveu 5 casos neste trimestre.",
  },
  {
    cause: "MOSFET aquecendo na linha de carga",
    incidence: "5 casos",
    note: "Maior frequência em sub-placas com retrabalho anterior.",
  },
];

export const moduleTasks: Record<string, ModuleTask[]> = {
  catalogo: [
    {
      title: "Organizar cadastros",
      description: "Marcas, categorias, modelos, placas e componentes bem separados.",
    },
    {
      title: "Evitar repeticao",
      description: "Campos padronizados para não cadastrar a mesma coisa mais de uma vez.",
    },
  ],
  biblioteca: [
    {
      title: "Guardar documentos",
      description: "Salvar arquivos com informações da placa, modelo ou equipamento.",
    },
    {
      title: "Preparar para busca",
      description: "Separar o texto do arquivo para facilitar a busca depois.",
    },
  ],
  conhecimento: [
    {
      title: "Separar suspeita de certeza",
      description: "Guardar como confirmado so o que ja foi revisado e validado.",
    },
    {
      title: "Salvar o que deu certo",
      description: "Registrar o que foi feito, o que resolveu e o que não ajudou.",
    },
  ],
  busca: [
    {
      title: "Buscar por texto",
      description: "Encontrar casos, sintomas, placas, componentes e documentos.",
    },
    {
      title: "Busca mais parecida",
      description: "Mostrar tambem casos e documentos parecidos com o que foi digitado.",
    },
  ],
  configuracoes: [
    {
      title: "Definir quem usa",
      description: "Controlar quem entra no sistema e quem fez cada registro.",
    },
    {
      title: "Guardar alterações",
      description: "Mostrar o histórico de mudanças e as revisões feitas.",
    },
  ],
};
