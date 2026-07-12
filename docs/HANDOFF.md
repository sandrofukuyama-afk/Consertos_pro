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
- assistente tecnico no detalhe do diagnostico
- recomendacao salva em `ai_responses`
- casos semelhantes e documentos relacionados no detalhe do caso
- vinculo opcional entre recomendacao da IA e teste executado
- feedback estruturado do tecnico para recomendacoes da IA
- metricas iniciais da IA em `/conhecimento`
- heuristica do assistente especializada por categoria
- comparativo de feedback por categoria e testes mais seguidos

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
- `src/lib/services/assistant.ts`
- `src/lib/services/diagnostics.ts`
- `src/lib/services/semantic.ts`
- `src/app/conhecimento/page.tsx`
- `src/app/busca/page.tsx`
- `src/app/diagnosticos/[id]/page.tsx`
- `src/app/actions.ts`
- `supabase/migrations/20260711235319_semantic_search_foundation.sql`
- `supabase/migrations/20260712113000_ai_feedback_metrics.sql`

## Assistente tecnico

Foi implementado:

- geracao de recomendacao estruturada para o diagnostico atual
- persistencia da recomendacao em `ai_responses`
- exibicao de:
  - resumo tecnico
  - hipotese principal
  - evidencias consideradas
  - proximo teste recomendado
  - observacao de seguranca
- recuperacao de:
  - casos semelhantes
  - documentos relacionados
- acao `Usar sugestao no formulario`
- rastreabilidade com `requested_by_ai_response_id` ao registrar teste
- timeline agora inclui eventos de recomendacao da IA
- formulario de feedback para a ultima recomendacao
- persistencia de feedback em `ai_response_feedback`
- metricas simples:
  - total de respostas
  - total de feedbacks
  - sugestoes seguidas
  - helpful / parcial / nao ajudou
- painel em `/conhecimento` com feedback recente da bancada
- especializacao inicial da recomendacao para:
  - desktop
  - notebook
  - television
  - smartphone
- exibicao da estrategia da categoria dentro da recomendacao
- painel em `/conhecimento` com:
  - desempenho por categoria
  - testes sugeridos com maior adocao

## Validacao feita

- `npm run lint` OK
- `npm run build` OK

## Bloqueio atual

O codigo agora depende de duas migrations novas no banco remoto do Supabase:

- semantic search foundation
- ai feedback metrics

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

## Tema escuro (2026-07-12)

A pedido do usuario, o app deixou de ter tema claro e passou a ser inteiramente escuro (sem alternador claro/escuro, um unico visual).

- `src/app/globals.css`: tokens de `:root` invertidos — `--background`/`--background-strong` agora escuros (`#1a1613`/`#120f0d`), `--foreground` virou o creme claro (`#f3efe7`), `--panel` (usado nos heros/sidebar) ganhou tom solido levemente elevado (`#221c17`), `--panel-border` e novos tokens `--card-surface`/`--card-surface-soft` (translucidos claros sobre fundo escuro) substituem o antigo `bg-white/70..85` usado em ~50 lugares.
- Substituicao em massa de `bg-white/70`, `/80`, `/82`, `/85` e `bg-white` solido por `bg-[var(--card-surface)]`/`bg-[var(--card-surface-soft)]` em 15+ arquivos (paginas e componentes). Os `bg-white/5..20` que ficam dentro dos paineis ja escuros (sidebar, hero de login) foram deixados como estavam — continuam corretos.
- Cores de acento (`--accent-teal`, `--accent-amber`) foram reajustadas e validadas com o script `validate_palette.js` da skill de dataviz especificamente contra o novo fundo escuro (`--mode dark`): `--accent-teal` ganhou mais chroma (nao passava no floor de saturacao), `--accent-amber` ficou mais escuro/ocre (a versao clara passava do teto de lightness do modo escuro). `--accent-copper`, `--success` e `--danger` ja passavam sem alteracao.
- Corrigido um texto fixo `#966a1f` (escuro, pensado para fundo claro) em `status-pill.tsx` e `page.tsx` que ficaria ilegivel no fundo escuro — trocado por `var(--accent-amber)`.
- Grid overlay de fundo (linhas sutis) invertido de escuro-sobre-claro para claro-sobre-escuro.
- Nao foi possivel tirar screenshot real (sem navegador neste ambiente) — validar visualmente no proximo teste manual.

## Fluxo de recuperacao de senha (2026-07-12)

Diagnosticado via `get_logs` (service auth) que o "Invalid login credentials" reportado pelo usuario NAO era problema de confirmacao de email (o evento `user_signedup` ja tinha acontecido com sucesso antes das tentativas de login) — era senha divergente entre cadastro e login. Como o app nao tinha fluxo de recuperacao, isso travava o usuario sem saida.

Implementado:

- `requestPasswordResetAction` em `src/app/actions.ts`: chama `supabase.auth.resetPasswordForEmail(email, { redirectTo })`, com `redirectTo` derivado dos headers da request (`host` + `x-forwarded-proto`) para funcionar tanto em localhost quanto em producao sem env var extra. Mensagem de retorno e sempre generica ("se o email existir...") para nao vazar quais emails tem conta.
- Nova pagina `src/app/redefinir-senha/page.tsx` (client component): usa `src/lib/supabase/client.ts` (browser client, ja existia mas nao era usado em nenhum lugar). No mount, chama `getSession()` para deixar o SDK detectar a sessao de recuperacao vinda do hash da URL (mesmo mecanismo que ja funcionava na confirmacao de cadastro via GoTrue `/verify`). Formulario de nova senha chama `updateUser({ password })`.
- Link "Esqueceu a senha?" (`<details>` expansivel) adicionado em `src/components/auth-panel.tsx`.

**Acao manual pendente do usuario**: adicionar `https://consertos-pro.vercel.app/**` em Authentication > URL Configuration > Redirect URLs no painel do Supabase, senao o link do email nao redireciona certo em producao. Nao existe tool MCP para configurar isso automaticamente (e config de Auth, nao de banco).

## Problema encontrado no Auth

Ao criar conta apareceu `email rate limit exceeded`.

Isso provavelmente vem do SMTP padrao do Supabase.

Opcoes:

- esperar o limite liberar
- desativar `Confirm email` no painel do Supabase para desenvolvimento
- configurar SMTP proprio

## Proximo passo recomendado

Fase 6 continua:

- ~~cruzar feedback com periodo e tendencia temporal~~ feito: painel `Feedback por semana` em `/conhecimento`
- ~~refinar recomendacao usando sintomas por grupo e resultados anteriores~~ feito:
  - `pickUnperformedTest` pondera pela taxa de sucesso historica (seguida ou helpful) de cada `test_group` (`getHistoricalTestGroupSuccess`)
  - `mainHypothesis`/evidencia/confianca agora usam `getHistoricalSymptomGroupInsights`, que busca em `resolved_cases.final_failure_mode` a causa mais recorrente historicamente para o `symptom_group` do sintoma principal do caso
- ~~mostrar taxa percentual de aceitacao e helpful por categoria~~ feito: `acceptanceRate`/`helpfulRate` em `aiCategoryBreakdown`
- ~~eventualmente trocar a heuristica atual por chamada LLM estruturada~~ feito:
  - `src/lib/ai/assistant-llm.ts` chama `gpt-4o-mini` via Chat Completions com `response_format: json_schema` (strict)
  - a narrativa (resumo tecnico, hipotese, evidencias, proximo teste, meta de validacao, observacao de seguranca) e gerada pelo LLM quando `OPENAI_API_KEY` esta configurada
  - o LLM e obrigado por prompt a recomendar exatamente o teste ja escolhido pela heuristica (`recommendedTestName`), evitando alucinar testes que nao existem no catalogo
  - em caso de falha da chamada (erro de rede, resposta malformada, chave ausente), cai de volta para a narrativa heuristica original sem quebrar o fluxo
  - `ai_responses.model_name` agora reflete o modelo real usado (`gpt-4o-mini` ou `heuristic-v1`), antes usava o nome do provedor de embeddings por engano

Fase 6 concluida. Chave `OPENAI_API_KEY` foi configurada e validada em 2026-07-12 (chamada real de teste retornou 200 tanto para embeddings quanto para chat completions).

Pendente: apos configurar a chave, e necessario clicar em "Sincronizar agora" em `/conhecimento` (login manual no navegador) para reprocessar os embeddings existentes, que foram gerados no modo `hashing-v1` antes da chave estar disponivel — nao foi possivel automatizar esse clique neste ambiente por falta de navegador headless.

## Fase 7 iniciada: estatisticas tecnicas (2026-07-12)

Conforme `PROJECT_PLAN.md` (Modulo 10 / Fase 7 do roadmap), apos concluir a Fase 6 o proximo passo e transformar o historico em inteligencia operacional. Entregue:

- `src/lib/services/statistics.ts`: `getWorkshopStatistics()` agrega `resolved_cases` + `confirmed_causes` para calcular:
  - total de casos resolvidos e tempo medio de resolucao geral;
  - distribuicao por `case_status` (confirmado, provavel, nao resolvido);
  - casos e tempo medio por fabricante e por modelo;
  - componentes recorrentes em causas confirmadas (via `confirmed_causes.board_component_id` -> `board_components` -> `components`);
  - frequencia de `cause_type` (curto-circuito, solda fria, falha termica, etc.).
- Nova pagina `/estatisticas` (`src/app/estatisticas/page.tsx`), com item de navegacao adicionado em `src/lib/mock-data.ts`.
- Build e lint validados; pagina nova aparece nas rotas geradas.

Ainda faltam da Fase 7 (Modulo 10): cruzar isso com a qualidade das recomendacoes da IA ao longo do tempo (parcialmente coberto pela tendencia semanal em `/conhecimento`).

### Atualizacao: graficos em `/estatisticas`

- Novo componente `src/components/stat-bar-chart.tsx`: `StatBarChart` (barras horizontais ranqueadas, hue unico) e `StatusDistributionBar` (barra empilhada + legenda para confirmado/provavel/nao resolvido).
- Paleta reaproveitada dos tokens ja existentes em `globals.css` (`--accent-teal`, `--accent-copper`, `--success`, `--accent-amber`, `--danger`) — validada com o script `validate_palette.js` da skill de dataviz (o trio success/amber/danger usado junto passa em todos os checks; o WARN de contraste do amber e mitigado porque cada segmento sempre tem rotulo de texto visivel, nunca so cor).
- Cada barra e sempre acompanhada de rotulo e valor em texto (o proprio card list ja funciona como "tabela" equivalente).
- Nao foi possivel tirar screenshot real (sem navegador neste ambiente) — validar visualmente no proximo teste manual.

## Fase 8 iniciada: analise de imagem de placa (2026-07-12)

Primeiro item do roadmap "Evolucoes avancadas" implementado: analise de imagem por IA nos anexos do diagnostico.

- Migration `20260712140000_attachment_image_analysis.sql` (aplicada no remoto com aprovacao explicita do usuario): adiciona `ai_image_analysis jsonb` e `ai_image_analyzed_at timestamptz` em `public.attachments`.
- `src/lib/ai/image-analysis.ts`: `analyzeBoardImage(imageUrl)` chama `gpt-4o-mini` (multimodal) via Chat Completions com `response_format: json_schema`, retornando `observations`, `suspectedIssues`, `confidence` e `recommendation`. Testado com imagem sintetica antes de integrar — a IA corretamente recusou especular sobre uma imagem sem conteudo util, sem alucinar.
- Nova action `analyzeAttachmentImageAction` em `src/app/actions.ts`: gera signed URL do storage, chama a analise, salva o resultado no anexo.
- UI em `src/app/diagnosticos/[id]/page.tsx`: anexos do tipo imagem ganham botao "Analisar imagem com IA"; o resultado fica exibido permanentemente no card do anexo apos a primeira analise.
- Prompt deliberadamente conservador: a IA descreve so o que e visivelmente observavel (queima, corrosao, capacitor estufado, solda fria, trilha rompida etc.) e nunca afirma um diagnostico definitivo — sempre "proximo passo objetivo".

Build e lint validados. Nao foi possivel testar com uma foto real de placa neste ambiente (sem navegador para fazer upload) — validar no proximo teste manual subindo uma foto real e clicando em "Analisar imagem com IA".

### Atualizacao: recomendacoes preventivas

- `getPreventiveInsightForModel(equipmentModelId, excludeDiagnosticId, client?)` em `src/lib/services/statistics.ts`: olha o historico de `confirmed_causes` de outros diagnosticos do mesmo `equipment_model_id`, agrupa por `cause_type` e, secundariamente, por componente mais associado. So retorna um insight se a causa mais frequente aparecer em pelo menos 2 casos anteriores (evita ruido com 1 caso isolado).
- `CAUSE_TYPE_LABELS` foi extraido para `statistics.ts` (exportado) e reaproveitado em `/estatisticas`, removendo duplicacao.
- `getDiagnosticDetail` em `diagnostics.ts` agora seleciona `equipment_model_id` e busca o insight em paralelo com o resto do detalhe.
- Novo banner amarelo "Recomendacao preventiva" no topo de `/diagnosticos/[id]` quando ha um padrao historico relevante para o modelo do equipamento atual.

### Atualizacao: fluxos guiados por tipo de equipamento

- `src/lib/domain/guided-flows.ts`: checklist estatico (sem IA, deterministico) de 4-5 passos ordenados por categoria (desktop, notebook, television, smartphone), cada passo com `testGroup` associado.
- `getDiagnosticDetail` agora calcula quais grupos de teste ja tem pelo menos um teste nao-pendente executado no caso, e marca cada passo do fluxo como concluido ou pendente.
- Substituido o aside estatico ("Continue alimentando o caso", texto de preenchimento generico) por uma lista numerada com check visual (✓ verde quando concluido, riscado) no detalhe do diagnostico.
- Deliberadamente sem IA: e um guia de bancada fixo por categoria, nao uma recomendacao gerada — util como checklist inicial mesmo sem chamar o assistente.

Itens restantes do roadmap "Evolucoes avancadas" (nao iniciados, sao possibilidades abertas, nao escopo fechado): agentes especializados, anotacao visual de componentes na propria imagem, arvore dinamica de investigacao.

## Incidente 2026-07-12: producao na Vercel fora do ar

Sintomas em `consertos-pro.vercel.app`:

1. `Error: Supabase environment variables are missing.` — a Vercel nunca teve `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configuradas (o `.env.local` e local por design, nunca vai para o Git). Resolvido pelo usuario direto no painel da Vercel (Settings > Environment Variables) + redeploy.
2. Apos o redeploy, novo erro derrubou `/login` inteiro: `ReferenceError: DOMMatrix is not defined`. Causa raiz: `src/lib/services/document-indexing.ts` importava `pdf-parse` no topo do arquivo; como `src/components/auth-panel.tsx` (usado em `/login`) importa `signInAction`/`signUpAction` de `src/app/actions.ts`, e esse arquivo `"use server"` importa `semantic.ts` -> `document-indexing.ts` -> `pdf-parse`, o Next empacotava toda essa cadeia no mesmo chunk de servidor de `/login`. O `pdf-parse` tem `exports` ambiguo no `package.json` e o Turbopack resolvia a condicao `browser` (que referencia `DOMMatrix`, API que so existe em navegador) em vez de `node`/`require`.

Correcao (commit a seguir):
   - `pdf-parse` agora e importado via `await import("pdf-parse")` dentro de `extractTechnicalDocumentText`, so quando um PDF de fato precisa ser processado.
   - `next.config.ts` ganhou `serverExternalPackages: ["pdf-parse"]`, forcando o Node a resolver o pacote nativamente em runtime (condicao `require`) em vez do Turbopack escolher a build errada.
   - Confirmado apos o build: nenhum chunk SSR de producao referencia mais `DOMMatrix`.

Licao para o futuro: dependencias pesadas usadas por uma unica feature (parsing de PDF, OCR, etc.) devem sempre ser importadas dinamicamente dentro da funcao que as usa, nunca no topo de um servico compartilhado — especialmente se esse servico e importado (direta ou indiretamente) por um arquivo `"use server"` referenciado por componentes usados em rotas nao relacionadas, como a de login.

## Observacao importante

O repositório estava limpo no momento deste handoff. Tudo relevante ate aqui ja foi enviado para o GitHub.

## Atualizacao 2026-07-12 (continuacao)

- Migration `ai_feedback_metrics` aplicada no projeto remoto Supabase (`Consertos_Pro`, id `znsjsfyodlsomtpcwwhn`) via MCP.
- `.env.local` criado localmente (nao versionado) para rodar `npm run dev`.
- Commit `5977b83` com a feature de assistente tecnico enviado para `main`.
- Fase 6 avancou: tendencia semanal de feedback, taxas percentuais por categoria, e recomendacao de teste agora pondera por sucesso historico do grupo.
- Nao foi possivel validar visualmente no navegador neste ambiente (sem `chromium-cli`/navegador headless disponivel) — validar manualmente em `/conhecimento` apos login.
