// Relatorio de servico para o cliente: formato guardado em
// diagnostics.customer_report e textos fixos em portugues/japones.

export type CustomerReportLanguage = "pt" | "ja";

export type CustomerReport = {
  language: CustomerReportLanguage;
  generatedAt: string;
  editedAt: string | null;
  problem: string;
  diagnosis: string;
  serviceType: string;
  serviceDescription: string;
  partsReplaced: Array<{ part: string; note: string }>;
  checks: Array<{ item: string; result: string }>;
  result: string;
  recommendations: string;
};

// Dados da oficina no cabeçalho do relatorio. Campo vazio nao aparece.
export const WORKSHOP_INFO = {
  name: "Casablanca Eletroshop",
  address: "",
  phone: "",
  email: "",
};

export const CUSTOMER_REPORT_WARRANTY_DAYS = 90;

export const CUSTOMER_REPORT_LABELS = {
  pt: {
    title: "Relatório de Serviço",
    reference: "Ref.",
    equipment: "Equipamento",
    serialNumber: "Nº de série",
    receivedAt: "Data de entrada",
    completedAt: "Data de conclusão",
    problem: "Problema relatado",
    diagnosis: "Diagnóstico",
    service: "Serviço executado",
    serviceType: "Tipo de serviço",
    parts: "Peças substituídas",
    noParts: "Nenhuma peça substituída.",
    checks: "Testes e verificações",
    result: "Resultado",
    recommendations: "Recomendações",
    warrantyTitle: "Garantia",
    warranty: (days: number, from: string) =>
      `Garantia de ${days} dias para o serviço executado e as peças substituídas, a partir de ${from}. Não cobre danos por queda, líquido, mau uso ou defeitos não relacionados a este reparo.`,
    technician: "Técnico responsável",
    customerSignature: "Assinatura do cliente",
    notInformed: "Não informado",
  },
  ja: {
    title: "修理報告書",
    reference: "受付番号",
    equipment: "機器",
    serialNumber: "製造番号",
    receivedAt: "受付日",
    completedAt: "完了日",
    problem: "ご依頼内容（症状）",
    diagnosis: "診断結果",
    service: "実施した作業",
    serviceType: "作業区分",
    parts: "交換部品",
    noParts: "交換部品はありません。",
    checks: "動作確認",
    result: "結果",
    recommendations: "ご注意・おすすめ",
    warrantyTitle: "保証",
    warranty: (days: number, from: string) =>
      `本修理の作業内容および交換部品について、${from}から${days}日間保証いたします。落下・水濡れ・誤使用による故障、および本修理と関係のない不具合は保証対象外となります。`,
    technician: "担当技術者",
    customerSignature: "お客様署名",
    notInformed: "未記入",
  },
} as const;

export function formatReportDate(value: string | null | undefined, language: CustomerReportLanguage) {
  if (!value) {
    return null;
  }
  return new Intl.DateTimeFormat(language === "ja" ? "ja-JP" : "pt-BR", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: language === "ja" ? "long" : "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function isCustomerReport(value: unknown): value is CustomerReport {
  if (!value || typeof value !== "object") {
    return false;
  }
  const report = value as Record<string, unknown>;
  return (
    (report.language === "pt" || report.language === "ja") &&
    typeof report.problem === "string" &&
    Array.isArray(report.partsReplaced) &&
    Array.isArray(report.checks)
  );
}
