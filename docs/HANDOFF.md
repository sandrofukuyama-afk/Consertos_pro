# Handoff ConsertosPro

Data: 2026-07-12

## Repositorio

- GitHub: `https://github.com/sandrofukuyama-afk/Consertos_pro.git`
- Branch principal: `main`

## Ultimos commits importantes

- `cee1fdf` Add semantic search foundation
- `3dd74be` Add search and document indexing workflow
- `61c3ac6` Add technical library uploads and unified diagnostic timeline
- `b047fd9` Add attachments hypotheses and case closure workflow
- `ca5f4cc` Add diagnostic detail workflow with symptoms tests and measurements

## Estado atual

O app ja tem:

- login e cadastro com Supabase Auth
- dashboard operacional
- criacao de diagnosticos
- detalhe de diagnostico
- sintomas, testes e medicoes
- hipoteses
- anexos
- encerramento de caso
- biblioteca tecnica com upload
- busca textual
- base de busca semantica
- pagina de conhecimento consolidado

## Busca semantica

Foi implementado:

- migration `supabase/migrations/20260711235319_semantic_search_foundation.sql`
- embeddings com fallback local `hashing-v1`
- suporte opcional a `OPENAI_API_KEY`
- sincronizacao semantica em:
  - diagnosticos
  - casos resolvidos
  - documentos tecnicos
- tela `/conhecimento` com botao `Sincronizar agora`
- `/busca` com resultados textuais e semanticos

## Arquivos centrais desta fase

- `src/lib/ai/embeddings.ts`
- `src/lib/services/semantic.ts`
- `src/lib/services/search.ts`
- `src/app/conhecimento/page.tsx`
- `src/app/busca/page.tsx`
- `src/app/actions.ts`
- `supabase/migrations/20260711235319_semantic_search_foundation.sql`

## Validacao feita

- `npm run lint` OK
- `npm run build` OK

## Bloqueio atual

O codigo esta pronto, mas a migration semantica ainda precisa ser confirmada no banco remoto do Supabase.

Comandos esperados no terminal do projeto:

```powershell
$env:SUPABASE_DB_PASSWORD="SUA_SENHA_DO_BANCO"
npx supabase db push
```

Depois:

```powershell
npm run dev
```

E no navegador:

- entrar no sistema
- abrir `/conhecimento`
- clicar em `Sincronizar agora`

## Problema encontrado no Auth

Ao criar conta apareceu `email rate limit exceeded`.

Isso provavelmente vem do SMTP padrao do Supabase.

Opcoes:

- esperar o limite liberar
- desativar `Confirm email` no painel do Supabase para desenvolvimento
- configurar SMTP proprio

## Proximo passo recomendado

Fase 6:

- assistente tecnico de diagnostico
- sugestao do proximo teste
- justificativa baseada no diagnostico atual
- consulta a casos semelhantes
- consulta a documentos relacionados

## Observacao importante

O repositório estava limpo no momento deste handoff. Tudo relevante ate aqui ja foi enviado para o GitHub.
