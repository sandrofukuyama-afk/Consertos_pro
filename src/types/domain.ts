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
  recordId?: string;
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

export type SymptomOption = CatalogOption & {
  group?: string | null;
};

export type TestOption = CatalogOption & {
  group?: string | null;
  unit?: string | null;
};

export type AssistantStructuredResponse = {
  technicalSummary: string;
  mainHypothesis: string;
  evidence: string[];
  nextTest: string;
  validationGoal: string;
  safetyNote: string;
  categoryStrategy: string;
  recommendedTestId: string | null;
  recommendedTestName: string | null;
};

export type AiFeedbackRating =
  | "helpful"
  | "partially_helpful"
  | "not_helpful";

export type DiagnosticDetail = {
  id: string;
  category: string;
  manufacturer: string;
  label: string;
  status: string;
  priority: string;
  summary: string;
  initialReport: string;
  physicalNotes: string;
  openedBy: string;
  createdAt: string;
  preventiveInsight: PreventiveInsight | null;
  resolvedCase: {
    caseStatus: string;
    resolutionSummary: string;
    repairOutcome: string;
  } | null;
  symptoms: Array<{
    id: string;
    name: string;
    severity: string;
    sourceType: string;
    isPrimary: boolean;
    capturedAt: string;
  }>;
  tests: Array<{
    id: string;
    testName: string;
    resultStatus: string;
    stepOrder: number;
    procedureNotes: string;
    actualResult: string;
    performedAt: string;
    technician: string;
    requestedByAi: boolean;
    requestedByAiResponseId: string | null;
  }>;
  measurements: Array<{
    id: string;
    measurementType: string;
    pointLabel: string;
    measuredValue: string;
    expectedValue: string;
    measuredAt: string;
    technician: string;
  }>;
  hypotheses: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    confidence: string;
    evidence: string;
    createdAt: string;
  }>;
  attachments: Array<{
    id: string;
    title: string;
    description: string;
    attachmentType: string;
    mimeType: string;
    uploadedAt: string;
    signedUrl: string | null;
    imageAnalysis: {
      observations: string[];
      suspectedIssues: string[];
      confidence: string;
      recommendation: string;
      analyzedAt: string;
    } | null;
  }>;
  timeline: Array<{
    id: string;
    kind: string;
    title: string;
    description: string;
    happenedAt: string;
  }>;
  assistantSnapshot: {
    latestResponse: {
      id: string;
      reasoningSummary: string;
      recommendedNextStep: string;
      confidenceScore: string;
      rawResponseText: string;
      modelName: string;
      createdAt: string;
      structured: AssistantStructuredResponse | null;
      feedback: {
        id: string;
        rating: AiFeedbackRating;
        wasFollowed: boolean | null;
        note: string;
        submittedBy: string;
        createdAt: string;
      } | null;
    } | null;
    similarCases: SemanticMatchResult[];
    relatedDocuments: SemanticMatchResult[];
    provider: string;
    externalProviderConfigured: boolean;
  };
};

export type TechnicalDocumentListItem = {
  id: string;
  title: string;
  documentType: string;
  manufacturer: string;
  relation: string;
  uploadedAt: string;
  chunksCount: number;
  isIndexed: boolean;
  signedUrl: string | null;
};

export type SearchFilters = {
  q: string;
  scope: "all" | "diagnostics" | "documents";
  status: string;
  categoryId: string;
};

export type SearchDiagnosticResult = {
  id: string;
  label: string;
  category: string;
  manufacturer: string;
  status: string;
  summary: string;
  updatedAt: string;
};

export type SearchDocumentResult = {
  id: string;
  title: string;
  documentType: string;
  manufacturer: string;
  relation: string;
  uploadedAt: string;
  signedUrl: string | null;
};

export type SemanticMatchResult = {
  id: string;
  sourceType: "diagnostic" | "resolved_case" | "technical_document";
  title: string;
  subtitle: string;
  excerpt: string;
  similarityLabel: string;
  href: string | null;
};

export type SearchPageData = {
  filters: SearchFilters;
  categories: CatalogOption[];
  diagnostics: SearchDiagnosticResult[];
  documents: SearchDocumentResult[];
  semanticMatches: SemanticMatchResult[];
  semanticProvider: string;
  externalProviderConfigured: boolean;
};

export type KnowledgeOverviewData = {
  provider: string;
  externalProviderConfigured: boolean;
  sourceCount: number;
  embeddingCount: number;
  pendingDocumentCount: number;
  aiMetrics: {
    totalResponses: number;
    feedbackCount: number;
    followedCount: number;
    helpfulCount: number;
    partiallyHelpfulCount: number;
    notHelpfulCount: number;
  };
  aiCategoryBreakdown: Array<{
    category: string;
    feedbackCount: number;
    helpfulCount: number;
    followedCount: number;
    helpfulRate: number;
    acceptanceRate: number;
  }>;
  topFollowedTests: Array<{
    testName: string;
    count: number;
  }>;
  aiFeedbackTrend: Array<{
    weekLabel: string;
    feedbackCount: number;
    helpfulCount: number;
    followedCount: number;
    helpfulRate: number;
    acceptanceRate: number;
  }>;
  recentResolvedCases: Array<{
    id: string;
    label: string;
    status: string;
    summary: string;
    createdAt: string;
  }>;
  recentAiFeedback: Array<{
    id: string;
    diagnosticId: string;
    rating: AiFeedbackRating;
    wasFollowed: boolean | null;
    note: string;
    submittedBy: string;
    createdAt: string;
  }>;
};

export type WorkshopStatistics = {
  totalResolvedCases: number;
  averageResolutionMinutes: number | null;
  resolutionRate: {
    confirmed: number;
    probable: number;
    unresolved: number;
  };
  byManufacturer: Array<{
    manufacturer: string;
    caseCount: number;
    averageResolutionMinutes: number | null;
  }>;
  byModel: Array<{
    model: string;
    manufacturer: string;
    caseCount: number;
    averageResolutionMinutes: number | null;
  }>;
  recurringComponents: Array<{
    componentRef: string;
    componentType: string;
    occurrences: number;
  }>;
  causeFrequency: Array<{
    causeType: string;
    count: number;
  }>;
};

export type PreventiveInsight = {
  causeType: string;
  causeLabel: string;
  occurrences: number;
  totalCases: number;
  componentRef: string | null;
};
