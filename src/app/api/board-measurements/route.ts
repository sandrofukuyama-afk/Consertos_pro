import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const supabase = await createClient();
    const body = (await request.json()) as {
      diagnosticId?: string;
      boardId?: string;
      componentRef?: string;
      measurementPoint?: string;
      expectedValue?: string;
      condition?: string;
      notes?: string;
    };

    const diagnosticId = String(body.diagnosticId ?? "").trim();
    const boardId = String(body.boardId ?? "").trim();
    const componentRef = String(body.componentRef ?? "").trim();
    const measurementPoint = String(body.measurementPoint ?? "").trim();
    const expectedValue = String(body.expectedValue ?? "").trim();
    const condition = String(body.condition ?? "").trim() || "power_off";
    const notes = String(body.notes ?? "").trim() || null;

    if (!boardId || !componentRef || !measurementPoint || !expectedValue) {
      return NextResponse.json(
        { error: "Preencha todos os campos obrigatórios para salvar a medição." },
        { status: 400 },
      );
    }

    const { error } = await supabase.from("board_measurements").insert({
      board_id: boardId,
      component_ref: componentRef,
      measurement_point: measurementPoint,
      expected_value: expectedValue,
      condition,
      notes,
      created_by_user_id: user.id,
    });

    if (error) {
      return NextResponse.json(
        { error: `Falha ao registrar medição de referência: ${error.message}` },
        { status: 400 },
      );
    }

    if (diagnosticId) {
      revalidatePath(`/diagnosticos/${diagnosticId}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao registrar medição de referência.",
      },
      { status: 500 },
    );
  }
}
