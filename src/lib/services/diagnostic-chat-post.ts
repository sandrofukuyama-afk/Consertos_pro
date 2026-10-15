import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { analyzeBoardImage } from "@/lib/ai/image-analysis";
import type { ClaudeChatProgressEvent } from "@/lib/ai/assistant-llm-claude";
import { sendDiagnosticChatMessage } from "@/lib/services/diagnostic-chat";
import { queueDiagnosticSemanticSync } from "@/lib/services/semantic-sync";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type SavedChatPhoto = {
  id: string;
  mimeType: string;
  base64: string;
  storagePath: string;
};

/**
 * Envia uma mensagem do tecnico ao chat do caso: guarda as fotos, roda a IA e
 * grava a resposta. Usado pela action do formulario e pela rota com streaming.
 */
export async function postDiagnosticChatMessage(
  supabase: SupabaseClient,
  userId: string,
  diagnosticId: string,
  message: string,
  files: File[],
  options: { deep?: boolean; onProgress?: (event: ClaudeChatProgressEvent) => void } = {},
) {
  const newAttachments: SavedChatPhoto[] = [];

  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${diagnosticId}/${Date.now()}-${safeName}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";

    const { error: uploadError } = await supabase.storage
      .from("diagnostic-attachments")
      .upload(storagePath, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: inserted, error: attachmentError } = await supabase
      .from("attachments")
      .insert({
        diagnostic_id: diagnosticId,
        attachment_type: "photo",
        title: file.name || "Foto enviada no chat",
        storage_path: storagePath,
        mime_type: mimeType,
        file_size_bytes: file.size,
        uploaded_by_user_id: userId,
      })
      .select("id")
      .single();

    if (attachmentError || !inserted) {
      throw attachmentError ?? new Error("Falha ao registrar o anexo do chat.");
    }

    newAttachments.push({
      id: inserted.id as string,
      mimeType,
      base64: bytes.toString("base64"),
      storagePath,
    });
  }

  const { wroteToCase } = await sendDiagnosticChatMessage(
    diagnosticId,
    message,
    newAttachments.map(({ id, mimeType, base64 }) => ({ id, mimeType, base64 })),
    userId,
    options,
  );

  // O agente pode ter gravado medicoes, hipoteses ou o resumo do caso.
  if (wroteToCase) {
    void queueDiagnosticSemanticSync(diagnosticId);
    try {
      revalidatePath("/");
    } catch {
      // So atualiza a lista de casos; nao pode derrubar a resposta ja salva.
    }
  }

  // Analise estruturada da foto (OpenAI) depois que a resposta ja foi entregue:
  // so enriquece o anexo para as proximas mensagens, nao precisa segurar a tela.
  const photos = newAttachments.filter((attachment) => attachment.mimeType.startsWith("image/"));
  if (photos.length) {
    try {
      after(() => analyzeChatPhotos(supabase, photos));
    } catch {
      // Fora do ciclo de um pedido (nao deveria acontecer): roda solto.
      void analyzeChatPhotos(supabase, photos);
    }
  }
}

async function analyzeChatPhotos(supabase: SupabaseClient, photos: SavedChatPhoto[]) {
  await Promise.allSettled(
    photos.map(async (attachment) => {
      const { data: signed } = await supabase.storage
        .from("diagnostic-attachments")
        .createSignedUrl(attachment.storagePath, 300);

      if (!signed?.signedUrl) {
        return;
      }

      const analysis = await analyzeBoardImage(signed.signedUrl);

      if (!analysis) {
        return;
      }

      await supabase
        .from("attachments")
        .update({
          ai_image_analysis: analysis,
          ai_image_analyzed_at: new Date().toISOString(),
        })
        .eq("id", attachment.id);
    }),
  );
}
