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

// A rota do chat pode rodar ate 800 s; passado isso, uma pergunta sem resposta
// nao esta mais sendo processada e pode ser respondida de novo.
const CHAT_TURN_MAX_RUNTIME_MS = 830_000;

/**
 * "Tentar de novo" reenvia o mesmo client_message_id. Se a pergunta ja foi
 * gravada na tentativa anterior, reaproveita em vez de duplicar.
 */
async function findPreviousChatTurn(
  supabase: SupabaseClient,
  diagnosticId: string,
  clientMessageId: string,
) {
  const { data: userTurn } = await supabase
    .from("ai_responses")
    .select("id, created_at")
    .eq("diagnostic_id", diagnosticId)
    .eq("response_role", "user")
    .eq("structured_response_json->>clientMessageId", clientMessageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!userTurn) {
    return null;
  }

  const { data: reply } = await supabase
    .from("ai_responses")
    .select("id")
    .eq("diagnostic_id", diagnosticId)
    .eq("response_role", "assistant")
    .gt("created_at", userTurn.created_at)
    .limit(1)
    .maybeSingle();

  return {
    id: userTurn.id as string,
    answered: Boolean(reply),
    inProgress: Date.now() - new Date(userTurn.created_at).getTime() < CHAT_TURN_MAX_RUNTIME_MS,
  };
}

async function loadSavedChatPhotos(
  supabase: SupabaseClient,
  userResponseId: string,
): Promise<SavedChatPhoto[]> {
  const { data: rows } = await supabase
    .from("attachments")
    .select("id, storage_path, mime_type")
    .eq("chat_ai_response_id", userResponseId);

  const photos = await Promise.all(
    (rows ?? []).map(async (row) => {
      const { data: blob } = await supabase.storage
        .from("diagnostic-attachments")
        .download(row.storage_path);

      if (!blob) {
        return null;
      }

      return {
        id: row.id as string,
        mimeType: (row.mime_type as string | null) ?? "image/jpeg",
        base64: Buffer.from(await blob.arrayBuffer()).toString("base64"),
        storagePath: row.storage_path as string,
      };
    }),
  );

  return photos.filter((photo): photo is SavedChatPhoto => photo !== null);
}

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
  options: {
    deep?: boolean;
    clientMessageId?: string;
    onProgress?: (event: ClaudeChatProgressEvent) => void;
  } = {},
) {
  const previousTurn = options.clientMessageId
    ? await findPreviousChatTurn(supabase, diagnosticId, options.clientMessageId)
    : null;

  if (previousTurn?.answered) {
    // A resposta chegou a ser gravada; a tela so precisa recarregar.
    return { closedCase: false };
  }

  if (previousTurn?.inProgress) {
    throw new Error(
      "A IA ainda está respondendo esta mensagem. Aguarde um pouco e atualize a página.",
    );
  }

  // No reenvio, as fotos ja foram guardadas e ligadas a pergunta original.
  const newAttachments: SavedChatPhoto[] = previousTurn
    ? await loadSavedChatPhotos(supabase, previousTurn.id)
    : [];

  for (const file of previousTurn ? [] : files) {
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

  const { wroteToCase, closedCase } = await sendDiagnosticChatMessage(
    diagnosticId,
    message,
    newAttachments.map(({ id, mimeType, base64 }) => ({ id, mimeType, base64 })),
    userId,
    { ...options, existingUserResponseId: previousTurn?.id },
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
  const photos = previousTurn
    ? []
    : newAttachments.filter((attachment) => attachment.mimeType.startsWith("image/"));
  if (photos.length) {
    try {
      after(() => analyzeChatPhotos(supabase, photos));
    } catch {
      // Fora do ciclo de um pedido (nao deveria acontecer): roda solto.
      void analyzeChatPhotos(supabase, photos);
    }
  }

  // A IA encerrou o caso: a tela pede o parecer tecnico num pedido separado
  // (aqui nao cabe: a resposta longa ja pode ter gasto boa parte do tempo da funcao).
  return { closedCase };
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
