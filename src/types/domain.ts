export type NavItem = {
  href: string;
  label: string;
  description: string;
};

export type AppUser = {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
};

export type Kpi = {
  label: string;
  value: string;
  change: string;
  tone: "teal" | "copper" | "amber";
};

export type DiagnosticCase = {
  id: string;
  category: string;
  equipment: string;
  symptom: string;
  board: string;
  technician: string;
  updatedAt: string;
  status: "Ativo" | "Aguardando teste" | "Resolvido hoje";
};

export type TimelineEntry = {
  time: string;
  title: string;
  description: string;
};

export type Hypothesis = {
  title: string;
  confidence: string;
  evidence: string;
  status: "Aberta" | "Fortalecida" | "Descartada";
};

export type DocumentItem = {
  title: string;
  type: string;
  relation: string;
};

export type KnowledgeItem = {
  cause: string;
  incidence: string;
  note: string;
};

export type ModuleTask = {
  title: string;
  description: string;
};

export type DashboardData = {
  kpis: Kpi[];
  diagnostics: DiagnosticCase[];
  documents: DocumentItem[];
  knowledgeItems: KnowledgeItem[];
  hasLiveData: boolean;
};

export type CatalogOption = {
  id: string;
  name: string;
};
