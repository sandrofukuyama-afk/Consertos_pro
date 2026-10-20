-- Relatorio de servico para o cliente (gerado pela IA a partir do caso e
-- revisado pelo tecnico antes de enviar). Formato em src/lib/customer-report.ts.
alter table public.diagnostics
  add column if not exists customer_report jsonb;
