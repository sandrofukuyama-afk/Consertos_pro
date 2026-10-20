import { redirect } from "next/navigation";

// O laudo antigo (tecnico demais para o cliente) virou o relatorio de servico.
export default async function LaudoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/diagnosticos/${id}/relatorio`);
}
