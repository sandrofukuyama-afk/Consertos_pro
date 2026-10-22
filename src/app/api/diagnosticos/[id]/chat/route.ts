import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { postDiagnosticChatMessage } from "@/lib/services/diagnostic-chat-post";
import { createClient } from "@/lib/supabase/server";

// "Claude forte" investiga com ate 25 voltas e pode levar varios minutos (Vercel
// Pro com Fluid compute aceita ate 800 s).
export const maxDuration = 800;

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
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Envio inválido. Tente de novo." }, { status: 400 });
  }
  const message = String(formData.get("message") ?? "").trim();
  const deep = formData.get("deep") === "1";
  const clientMessageId = String(formData.get("client_message_id") ?? "").trim() || undefined;
  const files = formData
    .getAll("photos")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (!message && files.length === 0) {
    return NextResponse.json({ error: "Escreva uma mensagem ou anexe uma foto." }, { status: 400 });
  }

  const supabase = await createClient();
  const encoder = new TextEncoder();

  // Se o celular desconectar (tela bloqueada, internet caiu), a IA continua
  // trabalhando e grava a resposta no caso; so paramos de escrever na conexao.
  // Atribuido no start() do stream; o "as" evita o TS estreitar para null.
  let controller = null as ReadableStreamDefaultController<Uint8Array> | null;
  let closed = false;
  const send = (event: Record<string, unknown>) => {
    if (closed || !controller) {
      return;
    }
    try {
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    } catch {
      closed = true;
    }
  };

  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
    cancel() {
      closed = true;
    },
  });

  const job = (async () => {
    const ping = setInterval(() => send({ type: "ping" }), PING_INTERVAL_MS);

    try {
      const result = await postDiagnosticChatMessage(supabase, user.id, diagnosticId, message, files, {
        deep,
        clientMessageId,
        onProgress: (event) => send(event),
      });
      try {
        revalidatePath(`/diagnosticos/${diagnosticId}`);
      } catch {
        // A tela chama router.refresh() de qualquer forma.
      }
      send({ type: "done", closedCase: result.closedCase });
    } catch (error) {
      send({
        type: "error",
        message: error instanceof Error ? error.message : "Falha ao enviar mensagem no chat.",
      });
    } finally {
      clearInterval(ping);
      if (!closed) {
        closed = true;
        try {
          controller?.close();
        } catch {
          // Conexao ja encerrada pelo cliente.
        }
      }
    }
  })();

  // Mantem a funcao viva ate a resposta ser gravada, mesmo sem ninguem lendo.
  after(() => job);

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
