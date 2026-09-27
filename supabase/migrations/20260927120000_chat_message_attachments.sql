-- Links a photo/attachment sent inside the diagnostic chat to the specific
-- chat turn (ai_responses row, response_role = 'user') it was sent with, so
-- the chat UI can render "this photo was attached to this message".
alter table public.attachments
  add column if not exists chat_ai_response_id uuid references public.ai_responses (id) on delete set null;

create index if not exists attachments_chat_ai_response_id_idx
  on public.attachments (chat_ai_response_id);
