create unique index if not exists idx_embedding_sources_unique_scope
on public.embedding_sources (source_type, source_id, content_role);

create index if not exists idx_embeddings_source_id
on public.embeddings (embedding_source_id);

create index if not exists idx_embeddings_vector_cosine
on public.embeddings
using hnsw (vector_value vector_cosine_ops);

create or replace function public.match_embedding_sources(
  query_embedding extensions.vector(1536),
  match_count integer default 8,
  filter_source_types text[] default null,
  filter_content_roles text[] default null
)
returns table (
  embedding_source_id uuid,
  source_type public.embedding_source_type,
  source_id uuid,
  content_role public.embedding_content_role,
  content_text text,
  similarity double precision
)
language sql
stable
as $$
  select
    es.id as embedding_source_id,
    es.source_type,
    es.source_id,
    es.content_role,
    es.content_text,
    greatest(0::double precision, 1 - (e.vector_value <=> query_embedding)) as similarity
  from public.embeddings e
  join public.embedding_sources es
    on es.id = e.embedding_source_id
  where es.is_active = true
    and (
      filter_source_types is null
      or es.source_type::text = any(filter_source_types)
    )
    and (
      filter_content_roles is null
      or es.content_role::text = any(filter_content_roles)
    )
  order by e.vector_value <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_embedding_sources(
  extensions.vector,
  integer,
  text[],
  text[]
) to authenticated, service_role;
