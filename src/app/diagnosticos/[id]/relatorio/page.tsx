import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { generateCustomerReportAction, updateCustomerReportAction } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PrintReportButton } from "@/components/print-report-button";
import { requireCurrentUser } from "@/lib/auth";
import {
  CUSTOMER_REPORT_LABELS,
  CUSTOMER_REPORT_WARRANTY_DAYS,
  formatReportDate,
  WORKSHOP_INFO,
  type CustomerReport,
} from "@/lib/customer-report";
import { getCustomerReportData } from "@/lib/services/customer-report";
import { getDiagnosticDetail } from "@/lib/services/diagnostics";
import { createClient } from "@/lib/supabase/server";

// Gerar o relatorio chama a IA (~20-60 s) pela acao desta pagina.
export const maxDuration = 300;

type ReportPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
};

const fieldClass =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-orange-500";

/** Relatorio de servico para o cliente: gerado pela IA, revisado aqui e salvo em PDF pela impressao. */
export default async function CustomerReportPage({ params, searchParams }: ReportPageProps) {
  await requireCurrentUser();
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const [detail, data] = await Promise.all([
    getDiagnosticDetail(id).catch(() => null),
    getCustomerReportData(supabase, id),
  ]);
  if (!detail || !data) {
    notFound();
  }

  const report = data.report;

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-6 text-gray-900 print:bg-white print:p-0">
      <div className="mx-auto grid max-w-3xl gap-4 print:max-w-none">
        <div className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/diagnosticos/${id}`}
              className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            >
              ← Voltar ao caso
            </Link>
            {report ? <PrintReportButton label="Salvar PDF / Compartilhar" /> : null}
          </div>

          {query.error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{query.error}</p>
          ) : null}
          {query.message ? (
            <p className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {query.message}
            </p>
          ) : null}

          {!data.status || (data.status !== "resolved" && data.status !== "unresolved") ? (
            <p className="text-sm text-gray-600">
              O caso ainda não foi encerrado: o relatório fica melhor depois do fechamento (peças trocadas e testes finais).
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {(["pt", "ja"] as const).map((language) => (
              <form key={language} action={generateCustomerReportAction}>
                <input type="hidden" name="diagnostic_id" value={id} />
                <input type="hidden" name="language" value={language} />
                <FormSubmitButton
                  idleLabel={`${report ? "Gerar de novo" : "Gerar"} em ${language === "pt" ? "Português" : "Japonês"}`}
                  pendingLabel="A IA está escrevendo..."
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:border-orange-500 disabled:opacity-60"
                />
              </form>
            ))}
          </div>
          {report ? (
            <p className="text-xs text-gray-500">
              Gerar de novo substitui o texto atual (inclusive o que você editou).
            </p>
          ) : null}

          {report ? <ReportEditForm diagnosticId={id} report={report} /> : null}
        </div>

        {report ? (
          <ReportSheet
            report={report}
            reference={id.slice(0, 8).toUpperCase()}
            equipment={detail.label}
            serialNumber={detail.serialNumber}
            technician={detail.openedBy}
            createdAt={data.createdAt}
            completedAt={data.completedAt}
            showWarranty={data.status === "resolved"}
          />
        ) : (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-gray-600 shadow-sm print:hidden">
            Escolha o idioma acima para a IA escrever o relatório a partir do caso. Depois você revisa e salva em PDF.
          </p>
        )}
      </div>
    </main>
  );
}

function ReportEditForm({ diagnosticId, report }: { diagnosticId: string; report: CustomerReport }) {
  const area = (name: string, label: string, value: string, rows = 3, hint?: string) => (
    <label className="grid gap-1 text-sm text-gray-700">
      {label}
      <textarea name={name} defaultValue={value} rows={rows} className={fieldClass} />
      {hint ? <span className="text-xs text-gray-500">{hint}</span> : null}
    </label>
  );

  return (
    <details className="rounded-xl border border-gray-200 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-gray-800">Editar o relatório</summary>
      <form action={updateCustomerReportAction} className="mt-3 grid gap-3">
        <input type="hidden" name="diagnostic_id" value={diagnosticId} />
        {area("problem", "Problema relatado", report.problem)}
        {area("diagnosis", "Diagnóstico", report.diagnosis)}
        <label className="grid gap-1 text-sm text-gray-700">
          Tipo de serviço
          <input name="service_type" defaultValue={report.serviceType} className={fieldClass} />
        </label>
        {area("service_description", "Serviço executado", report.serviceDescription, 4)}
        {area(
          "parts",
          "Peças substituídas",
          report.partsReplaced.map((item) => (item.note ? `${item.part} - ${item.note}` : item.part)).join("\n"),
          3,
          "Uma por linha: peça - observação",
        )}
        {area(
          "checks",
          "Testes e verificações",
          report.checks.map((item) => (item.result ? `${item.item} - ${item.result}` : item.item)).join("\n"),
          4,
          "Um por linha: verificação - resultado",
        )}
        {area("result", "Resultado", report.result)}
        {area("recommendations", "Recomendações", report.recommendations, 2)}
        <FormSubmitButton idleLabel="Salvar relatório" pendingLabel="Salvando..." />
      </form>
    </details>
  );
}

function ReportSheet({
  report,
  reference,
  equipment,
  serialNumber,
  technician,
  createdAt,
  completedAt,
  showWarranty,
}: {
  report: CustomerReport;
  reference: string;
  equipment: string;
  serialNumber: string;
  technician: string;
  createdAt: string;
  completedAt: string | null;
  showWarranty: boolean;
}) {
  const labels = CUSTOMER_REPORT_LABELS[report.language];
  const receivedAt = formatReportDate(createdAt, report.language);
  const doneAt = formatReportDate(completedAt, report.language);
  const warrantyFrom = doneAt ?? formatReportDate(report.generatedAt, report.language) ?? "";
  const contact = [
    WORKSHOP_INFO.address[report.language],
    WORKSHOP_INFO.phone ? `Tel. ${WORKSHOP_INFO.phone}` : "",
    WORKSHOP_INFO.whatsapp ? `WhatsApp ${WORKSHOP_INFO.whatsapp}` : "",
    WORKSHOP_INFO.email,
  ].filter(Boolean);

  const section = (title: string, body: ReactNode) =>
    body ? (
      <section className="break-inside-avoid border-t border-gray-200 pt-4">
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">{title}</h3>
        {body}
      </section>
    ) : null;

  return (
    <article
      lang={report.language}
      className="grid gap-4 rounded-2xl bg-white p-6 text-sm leading-6 text-gray-900 shadow-sm print:rounded-none print:p-0 print:shadow-none sm:p-10"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-gray-900 pb-4">
        <div>
          <p className="text-2xl font-bold tracking-tight">{WORKSHOP_INFO.name}</p>
          {contact.length ? <p className="mt-1 text-xs text-gray-600">{contact.join(" • ")}</p> : null}
        </div>
        <div className="text-right">
          <h1 className="text-lg font-bold">{labels.title}</h1>
          <p className="font-mono text-xs text-gray-500">
            {labels.reference} #{reference}
          </p>
        </div>
      </header>

      <section className="grid gap-1 sm:grid-cols-2 print:grid-cols-2">
        <p>
          <span className="text-gray-500">{labels.equipment}: </span>
          <strong>{equipment}</strong>
        </p>
        <p>
          <span className="text-gray-500">{labels.serialNumber}: </span>
          {serialNumber && serialNumber !== "Nao informado" ? serialNumber : labels.notInformed}
        </p>
        {receivedAt ? (
          <p>
            <span className="text-gray-500">{labels.receivedAt}: </span>
            {receivedAt}
          </p>
        ) : null}
        {doneAt ? (
          <p>
            <span className="text-gray-500">{labels.completedAt}: </span>
            {doneAt}
          </p>
        ) : null}
      </section>

      {section(labels.problem, report.problem ? <p>{report.problem}</p> : null)}
      {section(labels.diagnosis, report.diagnosis ? <p>{report.diagnosis}</p> : null)}
      {section(
        labels.service,
        <div>
          {report.serviceType ? (
            <p>
              <span className="text-gray-500">{labels.serviceType}: </span>
              <strong>{report.serviceType}</strong>
            </p>
          ) : null}
          {report.serviceDescription ? <p className="mt-1">{report.serviceDescription}</p> : null}
        </div>,
      )}
      {section(
        labels.parts,
        report.partsReplaced.length ? (
          <ul className="list-disc space-y-1 pl-5">
            {report.partsReplaced.map((item, index) => (
              <li key={index}>
                <strong>{item.part}</strong>
                {item.note ? ` — ${item.note}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">{labels.noParts}</p>
        ),
      )}
      {section(
        labels.checks,
        report.checks.length ? (
          <table className="w-full border-collapse text-left">
            <tbody>
              {report.checks.map((item, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-1 pr-3">{item.item}</td>
                  <td className="py-1 text-right font-semibold">{item.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null,
      )}
      {section(labels.result, report.result ? <p>{report.result}</p> : null)}
      {section(labels.recommendations, report.recommendations ? <p>{report.recommendations}</p> : null)}
      {showWarranty
        ? section(
            labels.warrantyTitle,
            <p className="text-gray-700">{labels.warranty(CUSTOMER_REPORT_WARRANTY_DAYS, warrantyFrom)}</p>,
          )
        : null}

      <footer className="mt-10 grid grid-cols-2 gap-8 text-center text-xs text-gray-600">
        <div>
          <div className="mx-auto h-10 w-4/5 border-b border-gray-400" />
          <p className="mt-2 font-semibold text-gray-800">{technician}</p>
          <p>{labels.technician}</p>
        </div>
        <div>
          <div className="mx-auto h-10 w-4/5 border-b border-gray-400" />
          <p className="mt-2">{labels.customerSignature}</p>
        </div>
      </footer>
    </article>
  );
}
