"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { readDonorPhotos, type DonorPhotoReading } from "@/lib/ai/donor-photo";
import { requireCurrentUser } from "@/lib/auth";
import { indexDonorBoard, matchBoardCode } from "@/lib/services/donor-boards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PHOTO_BUCKET = "diagnostic-attachments";

/** Links para o navegador enviar as fotos direto ao Storage. */
export async function createDonorPhotoUploadUrlsAction(count: number) {
  await requireCurrentUser();
  const supabase = createSupabaseAdminClient();
  const uploads = [];
  for (let index = 0; index < Math.min(Math.max(count, 1), 4); index += 1) {
    const path = `doadoras/${randomUUID()}.jpg`;
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "Falha ao preparar o envio da foto.");
    uploads.push({ path, token: data.token });
  }
  return uploads;
}

function titleFrom(reading: DonorPhotoReading | null, boardCode: string) {
  return [reading?.fabricante, reading?.modelo, boardCode].filter(Boolean).join(" ") || null;
}

async function applyBoardCode(donorId: string, boardCode: string) {
  const supabase = createSupabaseAdminClient();
  const { boardId, modelId } = await matchBoardCode(supabase, boardCode);
  await supabase
    .from("donor_boards")
    .update({ board_code_text: boardCode || null, board_id: boardId, equipment_model_id: modelId, index_status: "pendente" })
    .eq("id", donorId);
  return indexDonorBoard(supabase, donorId);
}

export async function createDonorBoardAction(input: { photoPaths: string[]; boardCode: string; notes: string }) {
  const user = await requireCurrentUser();
  const supabase = createSupabaseAdminClient();
  const photoPaths = input.photoPaths.filter((path) => path.startsWith("doadoras/"));

  const { data: donor, error } = await supabase
    .from("donor_boards")
    .insert({ photo_paths: photoPaths, notes: input.notes.trim() || null, created_by_user_id: user.id })
    .select("id, code")
    .single();
  if (error || !donor) throw new Error(error?.message ?? "Falha ao cadastrar.");

  // Le as fotos com a IA (codigo da placa e marcacoes dos componentes).
  let reading: DonorPhotoReading | null = null;
  try {
    const images = [];
    for (const path of photoPaths) {
      const file = await supabase.storage.from(PHOTO_BUCKET).download(path);
      if (file.data) {
        images.push({ base64: Buffer.from(await file.data.arrayBuffer()).toString("base64"), mediaType: "image/jpeg" as const });
      }
    }
    reading = await readDonorPhotos(images);
  } catch (readError) {
    console.error("[doadoras] leitura da foto falhou", readError);
  }

  const boardCode = input.boardCode.trim() || reading?.codigo_placa?.trim() || "";
  const markings = [boardCode, ...(reading?.marcacoes ?? [])].filter(Boolean);
  await supabase
    .from("donor_boards")
    .update({ title: titleFrom(reading, boardCode), ai_markings: markings.join("\n") || null })
    .eq("id", donor.id);
  if (markings.length) {
    await supabase.from("donor_board_index").insert({ donor_board_id: donor.id, source: "foto", content: markings.join("\n") });
  }

  const index = await applyBoardCode(donor.id, boardCode);
  revalidatePath("/doadoras");

  return {
    code: donor.code as string,
    title: titleFrom(reading, boardCode),
    boardCode,
    markings: reading?.marcacoes ?? [],
    indexStatus: index.status,
  };
}

export async function updateDonorBoardCodeAction(formData: FormData) {
  await requireCurrentUser();
  const donorId = String(formData.get("donor_id") ?? "");
  const boardCode = String(formData.get("board_code") ?? "").trim();
  await applyBoardCode(donorId, boardCode);
  revalidatePath("/doadoras");
}

export async function deleteDonorBoardAction(formData: FormData) {
  await requireCurrentUser();
  const supabase = createSupabaseAdminClient();
  const donorId = String(formData.get("donor_id") ?? "");
  const { data: donor } = await supabase.from("donor_boards").select("photo_paths").eq("id", donorId).single();
  const paths = (donor?.photo_paths as string[] | null) ?? [];
  if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
  await supabase.from("donor_boards").delete().eq("id", donorId);
  revalidatePath("/doadoras");
}
