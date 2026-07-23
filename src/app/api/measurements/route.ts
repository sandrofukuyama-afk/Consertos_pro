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
      diagnosticTestRunId?: string;
      diagnosticBoardId?: string;
      measurementType?: string;
      pointLabel?: string;
      unit?: string;
      measuredValueText?: string;
      expectedValueText?: string;
      measuredValueNumeric?: string;
      toleranceText?: string;
      measurementContext?: string;
      isOutOfRange?: boolean;
    };

    const diagnosticId = String(body.diagnosticId ?? "").trim();
    const diagnosticTestRunId = String(body.diagnosticTestRunId ?? "").trim() || null;
    const diagnosticBoardId = String(body.diagnosticBoardId ?? "").trim() || null;
    const measurementType = String(body.measurementType ?? "").trim();
    const pointLabel = String(body.pointLabel ?? "").trim() || null;
    const unit = String(body.unit ?? "").trim() || null;
    const measuredValueText = String(body.measuredValueText ?? "").trim() || null;
    const expectedValueText = String(body.expectedValueText ?? "").trim() || null;
    const toleranceText = String(body.toleranceText ?? "").trim() || null;
    const measurementContext = String(body.measurementContext ?? "").trim() || null;
    const measuredValueNumericRaw = String(body.measuredValueNumeric ?? "").trim();
    const measuredValueNumeric = measuredValueNumericRaw ? Number(measuredValueNumericRaw) : null;
    const isOutOfRange = Boolean(body.isOutOfRange);

    if (!diagnosticId || !measurementType) {
      return NextResponse.json({ error: "Medição inválida." }, { status: 400 });
    }

    const { data: diagnostic } = await supabase
      .from("diagnostics")
      .select("id")
      .eq("id", diagnosticId)
      .maybeSingle();

    if (!diagnostic) {
      return NextResponse.json(
        { error: "Diagnóstico não encontrado. Atualize a tela e tente novamente." },
        { status: 400 },
      );
    }

    if (diagnosticTestRunId) {
      const { data: testRun } = await supabase
        .from("diagnostic_test_runs")
        .select("id")
        .eq("id", diagnosticTestRunId)
        .eq("diagnostic_id", diagnosticId)
        .maybeSingle();

      if (!testRun) {
        return NextResponse.json(
          { error: "Teste relacionado nao encontrado para este diagnostico." },
          { status: 400 },
        );
      }
    }

    if (diagnosticBoardId) {
      const { data: board } = await supabase
        .from("diagnostic_boards")
        .select("id")
        .eq("id", diagnosticBoardId)
        .eq("diagnostic_id", diagnosticId)
        .maybeSingle();

      if (!board) {
        return NextResponse.json(
          { error: "Placa relacionada nao encontrada para este diagnostico." },
          { status: 400 },
        );
      }
    }

    const { error } = await supabase.from("measurements").insert({
      diagnostic_id: diagnosticId,
      diagnostic_test_run_id: diagnosticTestRunId,
      diagnostic_board_id: diagnosticBoardId,
      measurement_type: measurementType,
      point_label: pointLabel,
      unit,
      measured_value_numeric:
        measuredValueNumeric !== null && !Number.isNaN(measuredValueNumeric)
          ? measuredValueNumeric
          : null,
      measured_value_text: measuredValueText,
      expected_value_text: expectedValueText,
      tolerance_text: toleranceText,
      measurement_context: measurementContext,
      is_out_of_range: isOutOfRange,
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
      { error: error instanceof Error ? error.message : "Falha ao registrar medição." },
      { status: 500 },
    );
  }
}
