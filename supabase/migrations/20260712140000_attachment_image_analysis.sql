alter table public.attachments
  add column ai_image_analysis jsonb,
  add column ai_image_analyzed_at timestamptz;
