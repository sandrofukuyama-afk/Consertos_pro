import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { generateDiagnosticAssistantBenchResponse } from "@/lib/services/assistant";

export const maxDuration = 300;

// Gera o parecer tecnico estruturado do caso. Chamado pela tela logo depois que
// a IA encerra o caso pelo chat, num pedido proprio (com os 300 s inteiros).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  }

  const { id: diagnosticId } = await params;

  try {
    await generateDiagnosticAssistantBenchResponse(diagnosticId);
  } catch (error) {
    console.error("Parecer apos encerrar o caso falhou", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o parecer." },
      { status: 500 },
    );
  }

  revalidatePath(`/diagnosticos/${diagnosticId}`);
  return NextResponse.json({ ok: true });
}
