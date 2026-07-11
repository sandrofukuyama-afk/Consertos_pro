# Supabase - Fase 1

Esta pasta contem a primeira entrega estrutural do backend do ConsertosPro.

## O que ja existe

- `config.toml`
  Configuracao base do projeto Supabase local.
- `migrations/20260711223340_initial_schema.sql`
  Migration inicial com schema, enums, indices, RLS, buckets e sincronizacao de `auth.users`.
- `seed.sql`
  Seeds basicas do MVP para categorias, fabricantes, sintomas, tipos de placa, testes e tags.

## Buckets previstos

- `technical-documents`
  PDFs, boardviews, firmwares, BIOS e documentos de referencia.
- `diagnostic-attachments`
  Fotos, capturas, relatorios e evidencias do diagnostico.

## Como aplicar quando o ambiente estiver pronto

### Local

Requer Docker e Supabase CLI.

```bash
npx supabase start
npx supabase db reset
```

### Projeto remoto

Requer link com o projeto e senha do banco remoto.

```bash
npx supabase link --project-ref znsjsfyodlsomtpcwwhn
npx supabase db push
```

## Limitacoes atuais

- A migration ainda nao foi executada neste ambiente porque nao ha Docker local nem senha do banco remoto disponiveis.
- As politicas RLS estao em modo interno, privilegiando uso por usuarios autenticados da equipe.
- A camada do app ainda usa mocks; a troca para dados reais fica na proxima etapa.

## Proxima etapa recomendada

1. Aplicar migration e seeds no projeto Supabase.
2. Validar `auth.users` -> `public.users`.
3. Criar services reais para diagnosticos, catalogo e documentos.
4. Substituir `mock-data.ts` por consultas reais.
