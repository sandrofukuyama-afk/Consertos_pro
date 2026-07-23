import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { getDiagnosticDetail } from "@/lib/services/diagnostics";

type LaudoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LaudoPage({ params }: LaudoPageProps) {
  await requireCurrentUser();
  const { id } = await params;
  
  let detail;
  try {
    detail = await getDiagnosticDetail(id);
  } catch {
    notFound();
  }

  const resolved = detail.resolvedCase;

  return (
    <main className="min-h-screen bg-white p-8 text-black font-sans leading-relaxed">
      {/* Botão de Controle (Ocultado na impressão) */}
      <div className="mb-6 flex justify-between items-center border-b border-gray-200 pb-4 print:hidden">
        <Link
          href={`/diagnosticos/${id}`}
          className="rounded-full bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-all"
        >
          ← Voltar ao Diagnóstico
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-full bg-orange-600 px-5 py-2 text-xs font-semibold text-white hover:bg-orange-700 transition-all shadow-md"
        >
          Imprimir / Salvar PDF
        </button>
      </div>

      {/* Cabeçalho do Laudo */}
      <header className="flex justify-between items-start border-b-2 border-gray-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">ConsertosPro</h1>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">
            Plataforma de Diagnóstico Inteligente
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold text-gray-800 uppercase">Laudo Técnico</h2>
          <p className="text-xs font-mono text-gray-500 mt-0.5">Ref: #{id.slice(0, 8).toUpperCase()}</p>
        </div>
      </header>

      {/* Detalhes do Equipamento e Caso */}
      <section className="mt-8 grid grid-cols-2 gap-6 border-b border-gray-200 pb-6 text-sm">
        <div>
          <h3 className="font-bold text-gray-800 mb-2 uppercase text-xs tracking-wider">Identificação do Equipamento</h3>
          <p><strong className="text-gray-600">Aparelho:</strong> {detail.label}</p>
          <p><strong className="text-gray-600">Fabricante:</strong> {detail.manufacturer}</p>
          <p><strong className="text-gray-600">Modelo:</strong> {detail.model}</p>
          <p><strong className="text-gray-600">Nº de Série:</strong> {detail.serialNumber || "Não informado"}</p>
        </div>
        <div>
          <h3 className="font-bold text-gray-800 mb-2 uppercase text-xs tracking-wider">Informações do Caso</h3>
          <p><strong className="text-gray-600">Status atual:</strong> {detail.status.toUpperCase()}</p>
          <p><strong className="text-gray-600">Abertura:</strong> {detail.createdAt}</p>
          <p><strong className="text-gray-600">Técnico responsável:</strong> {detail.openedBy}</p>
        </div>
      </section>

      {/* Relato Inicial */}
      <section className="mt-6 border-b border-gray-200 pb-6 text-sm">
        <h3 className="font-bold text-gray-800 mb-2 uppercase text-xs tracking-wider">Relato Inicial do Problema</h3>
        <p className="text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100 italic">
          &quot;{detail.initialReport}&quot;
        </p>
      </section>

      {/* Sintomas Encontrados */}
      <section className="mt-6 border-b border-gray-200 pb-6 text-sm">
        <h3 className="font-bold text-gray-800 mb-2 uppercase text-xs tracking-wider">Sintomas Identificados</h3>
        {detail.symptoms.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1 text-gray-700">
            {detail.symptoms.map((symptom) => (
              <li key={symptom.id}>
                <strong>{symptom.name}</strong> (Severidade: {symptom.severity})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">Nenhum sintoma mapeado.</p>
        )}
      </section>

      {/* Testes e Procedimentos Executados */}
      <section className="mt-6 border-b border-gray-200 pb-6 text-sm">
        <h3 className="font-bold text-gray-800 mb-3 uppercase text-xs tracking-wider">Testes e Medições Realizadas</h3>
        {detail.tests.length > 0 || detail.measurements.length > 0 ? (
          <div className="space-y-4">
            {detail.tests.map((run) => (
              <div key={run.id} className="border-l-4 border-orange-500 pl-4 py-1">
                <p className="font-semibold text-gray-800">
                  Teste: {run.testName}
                </p>
                <p className="text-gray-600 text-xs">
                  <strong>Resultado:</strong> {run.resultStatus === "passed" || run.resultStatus === "Passed" || run.resultStatus === "Passou" ? "Aprovado" : "Falho / Problema detectado"} • <strong>Detalhes:</strong> {run.procedureNotes || "Sem anotações"}
                </p>
              </div>
            ))}

            {detail.measurements.map((measure) => (
              <div key={measure.id} className="border-l-4 border-teal-500 pl-4 py-1">
                <p className="font-semibold text-gray-800">
                  Medição no ponto: {measure.pointLabel}
                </p>
                <p className="text-gray-600 text-xs">
                  <strong>Valor encontrado:</strong> {measure.measuredValue} • <strong>Esperado:</strong> {measure.expectedValue || "Não informado"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Nenhum procedimento de teste registrado.</p>
        )}
      </section>

      {/* Resolução e Parecer Técnico */}
      <section className="mt-6 border-b border-gray-200 pb-6 text-sm">
        <h3 className="font-bold text-gray-800 mb-2 uppercase text-xs tracking-wider">Parecer Técnico e Resolução</h3>
        {resolved ? (
          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
            <p className="mb-2"><strong>Resultado do reparo:</strong> {resolved.repairOutcome}</p>
            <p className="mb-2"><strong>Status de solução:</strong> {resolved.caseStatus === "confirmed" || resolved.caseStatus === "Confirmado" ? "Causa Confirmada" : "Causa Provável"}</p>
            <p><strong>Resumo da solução:</strong> {resolved.resolutionSummary}</p>
          </div>
        ) : (
          <p className="text-gray-500">Este diagnóstico ainda não foi encerrado com uma solução oficial.</p>
        )}
      </section>

      {/* Assinaturas */}
      <footer className="mt-20 grid grid-cols-2 gap-12 text-sm">
        <div className="text-center">
          <div className="border-b border-gray-400 mx-auto w-4/5 h-8"></div>
          <p className="mt-2 font-semibold text-gray-700">{detail.openedBy}</p>
          <p className="text-xs text-gray-500">Técnico Responsável</p>
        </div>
        <div className="text-center">
          <div className="border-b border-gray-400 mx-auto w-4/5 h-8"></div>
          <p className="mt-2 font-semibold text-gray-700">Assinatura do Cliente</p>
          <p className="text-xs text-gray-500">Aprovação do Serviço</p>
        </div>
      </footer>

      {/* Autoprint Script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 600);
            };
          `,
        }}
      />
    </main>
  );
}
