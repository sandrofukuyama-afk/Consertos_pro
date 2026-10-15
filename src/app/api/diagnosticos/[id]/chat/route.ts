import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { postDiagnosticChatMessage } from "@/lib/services/diagnostic-chat-post";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

// Envia a mensagem do chat e devolve a resposta da IA aos poucos (uma linha JSON
// por evento), para o tecnico ver o texto sendo escrito em vez de esperar tudo.
// Eventos: text (pedaco do texto), tools (consultas em andamento), ping
// (conexao viva), done e error.
const PING_INTERVAL_MS = 10_000;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  }

  const { id: diagnosticId } = await params;
  const formData = await request.formData();
  const message = String(formData.get("message") ?? "").trim();
  const deep = formData.get("deep") === "1";
  const files = formData
    .getAll("photos")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (!message && files.length === 0) {
    return NextResponse.json({ error: "Escreva uma mensagem ou anexe uma foto." }, { status: 400 });
  }

  const supabase = await createClient();
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: Record<string, unknown>) => {
        if (!closed) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      };
      const ping = setInterval(() => send({ type: "ping" }), PING_INTERVAL_MS);

      try {
        await postDiagnosticChatMessage(supabase, user.id, diagnosticId, message, files, {
          deep,
          onProgress: (event) => send(event),
        });
        try {
          revalidatePath(`/diagnosticos/${diagnosticId}`);
        } catch {
          // A tela chama router.refresh() de qualquer forma.
        }
        send({ type: "done" });
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Falha ao enviar mensagem no chat.",
        });
      } finally {
        clearInterval(ping);
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
