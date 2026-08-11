alter table public.technical_assets
add column if not exists board_id uuid references public.boards (id) on delete set null,
add column if not exists equipment_model_id uuid references public.equipment_models (id) on delete set null;

create index if not exists idx_technical_assets_board_id
on public.technical_assets (board_id);

create index if not exists idx_technical_assets_equipment_model_id
on public.technical_assets (equipment_model_id);

with ranked_links as (
  select
    technical_asset_id,
    board_id,
    equipment_model_id,
    row_number() over (
      partition by technical_asset_id
      order by created_at asc, id asc
    ) as row_number
  from public.technical_asset_links
)
update public.technical_assets as technical_assets
set
  board_id = ranked_links.board_id,
  equipment_model_id = ranked_links.equipment_model_id
from ranked_links
where ranked_links.technical_asset_id = technical_assets.id
  and ranked_links.row_number = 1
  and technical_assets.board_id is null
  and technical_assets.equipment_model_id is null;
