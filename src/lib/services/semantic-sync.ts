import { after } from "next/server";
import { syncDiagnosticEmbeddingSource } from "@/lib/services/semantic";
import { createClient } from "@/lib/supabase/server";

export function queueDiagnosticSemanticSync(diagnosticId: string) {
  after(async () => {
    try {
      const supabase = await createClient();
      await syncDiagnosticEmbeddingSource(diagnosticId, supabase);
    } catch (error) {
      console.error("Falha ao sincronizar embedding do diagnostico", {
        diagnosticId,
        error,
      });
    }
  });
}
