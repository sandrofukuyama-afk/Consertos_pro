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
    label: "Diagnosticos",
    description: "Casos, timeline e proximos testes",
  },
  {
    href: "/catalogo-tecnico",
    label: "Catalogo Tecnico",
    description: "Modelos, placas e componentes",
  },
  {
    href: "/biblioteca",
    label: "Biblioteca",
    description: "Documentos, PDFs e firmwares",
  },
  {
    href: "/conhecimento",
    label: "Conhecimento",
    description: "Causas confirmadas e solucoes",
  },
  {
    href: "/busca",
    label: "Busca",
    description: "Consulta estruturada e semantica",
  },
  {
    href: "/estatisticas",
    label: "Estatisticas",
    description: "Defeitos recorrentes e tempo de resolucao",
  },
  {
    href: "/configuracoes",
    label: "Configuracoes",
    description: "Usuarios, revisao e governanca",
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
    change: "1 promovido para memoria",
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
    updatedAt: "ha 12 min",
    status: "Ativo",
  },
  {
    id: "DX-2051",
    category: "Televisor",
    equipment: "Samsung UN50AU7700",
    symptom: "Liga com som sem imagem",
    board: "T-Con BN96-56812A",
    technician: "Bruna Cezar",
    updatedAt: "ha 27 min",
    status: "Aguardando teste",
  },
  {
    id: "DX-2053",
    category: "Celular",
    equipment: "Motorola Edge 30 Neo",
    symptom: "Nao carrega apos troca de conector",
    board: "Sub-board carga XT2245",
    technician: "Rafael Teles",
    updatedAt: "ha 45 min",
    status: "Ativo",
  },
  {
    id: "DX-2054",
    category: "Desktop",
    equipment: "Dell OptiPlex 7090",
    symptom: "Desliga apos 15 segundos",
    board: "Mainboard Q470",
    technician: "Livia Rocha",
    updatedAt: "ha 1 h",
    status: "Resolvido hoje",
  },
];

export const timeline: TimelineEntry[] = [
  {
    time: "09:12",
    title: "Medicao 19V registrada",
    description: "Linha principal estavel na entrada da mainboard.",
  },
  {
    time: "09:36",
    title: "Teste com fonte assimetrica",
    description: "Consumo inicial em 0.041A sem subida de imagem.",
  },
  {
    time: "10:05",
    title: "Hipotese fortalecida",
    description: "Curto intermitente na linha LCD_VDD apos aquecimento.",
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
    title: "Firmware corrompido apos atualizacao",
    confidence: "0.41",
    evidence: "Historico do equipamento indica falha apos reinicio",
    status: "Aberta",
  },
  {
    title: "Cabo flat com fuga para terra",
    confidence: "0.18",
    evidence: "Sem reproducao ao isolar o conjunto",
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
    title: "Mapa de tensoes BN96-56812A",
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
    cause: "Curto no circuito de backlight apos oxidacao",
    incidence: "12 casos",
    note: "Recorrencia alta em notebooks com dano liquido leve.",
  },
  {
    cause: "EEPROM corrompida apos queda de energia",
    incidence: "7 casos",
    note: "Regravacao validada em 5 ocorrencias deste trimestre.",
  },
  {
    cause: "MOSFET aquecendo na linha de carga",
    incidence: "5 casos",
    note: "Maior frequencia em sub-placas com retrabalho anterior.",
  },
];

export const moduleTasks: Record<string, ModuleTask[]> = {
  catalogo: [
    {
      title: "Estruturar cadastro mestre",
      description: "Fabricantes, categorias, modelos, placas e componentes com relacionamentos claros.",
    },
    {
      title: "Preparar consistencia futura",
      description: "Campos normalizados para evitar duplicidade e melhorar busca por bancada.",
    },
  ],
  biblioteca: [
    {
      title: "Receber documentos tecnicos",
      description: "Metadados, associacoes por modelo ou placa e caminho pronto para storage.",
    },
    {
      title: "Abrir trilha para indexacao",
      description: "Separar arquivo, chunking e preparo para embeddings sem acoplar ao MVP.",
    },
  ],
  conhecimento: [
    {
      title: "Separar evidencia de confirmacao",
      description: "Promover apenas causas revisadas como memoria forte da oficina.",
    },
    {
      title: "Conectar solucao ao caso",
      description: "Registrar o que foi aplicado, o que funcionou e o que deve perder peso futuro.",
    },
  ],
  busca: [
    {
      title: "Comecar por busca textual",
      description: "Casos, sintomas, placas, componentes e documentos com filtros objetivos.",
    },
    {
      title: "Reservar a camada semantica",
      description: "Area pronta para pgvector, ranking e recuperacao contextual posterior.",
    },
  ],
  configuracoes: [
    {
      title: "Mapear perfis tecnicos",
      description: "Controle basico de acesso, revisor tecnico e rastreabilidade de autores.",
    },
    {
      title: "Definir governanca",
      description: "Auditoria, revisao humana e promocao controlada de conhecimento.",
    },
  ],
};
