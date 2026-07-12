import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { syncDiagnosticEmbeddingSource } from "@/lib/services/semantic";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const supabase = await createClient();
    const body = (await request.json()) as {
      diagnosticId?: string;
      measurementType?: string;
      pointLabel?: string;
      unit?: string;
      measuredValueText?: string;
      expectedValueText?: string;
      measuredValueNumeric?: string;
    };

    const diagnosticId = String(body.diagnosticId ?? "").trim();
    const measurementType = String(body.measurementType ?? "").trim();
    const pointLabel = String(body.pointLabel ?? "").trim() || null;
    const unit = String(body.unit ?? "").trim() || null;
    const measuredValueText = String(body.measuredValueText ?? "").trim() || null;
    const expectedValueText = String(body.expectedValueText ?? "").trim() || null;
    const measuredValueNumericRaw = String(body.measuredValueNumeric ?? "").trim();
    const measuredValueNumeric = measuredValueNumericRaw ? Number(measuredValueNumericRaw) : null;

    if (!diagnosticId || !measurementType) {
      return NextResponse.json({ error: "Medicao invalida." }, { status: 400 });
    }

    const { error } = await supabase.from("measurements").insert({
      diagnostic_id: diagnosticId,
      measurement_type: measurementType,
      point_label: pointLabel,
      unit,
      measured_value_numeric:
        measuredValueNumeric !== null && !Number.isNaN(measuredValueNumeric)
          ? measuredValueNumeric
          : null,
      measured_value_text: measuredValueText,
      expected_value_text: expectedValueText,
      measured_by_user_id: user.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await syncDiagnosticEmbeddingSource(diagnosticId, supabase);
    revalidatePath(`/diagnosticos/${diagnosticId}`);
    revalidatePath("/");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao registrar medicao." },
      { status: 500 },
    );
  }
}
