# ConsertosPro — contexto para o Claude

> **Regra do dono do projeto:** tudo o que for feito no projeto (funcionalidades, correções, decisões,
> mudanças de infraestrutura, configurações, pendências resolvidas ou novas) **deve ser registrado neste
> arquivo** no mesmo trabalho, antes do commit. Atualize as seções abaixo e o "Registro de mudanças" no fim.
> Nunca grave senhas, tokens ou chaves aqui — só os nomes das variáveis.

App interno de diagnóstico de bancada (notebooks, desktops, placas de vídeo, celulares, TVs)
de uma oficina no Japão. Usado muito pelo **iPhone**. Interface e textos em **português do Brasil**.
Regras de codificação/acentos: ver `AGENTS.md` (rodar `npm run check:encoding` / `npm run lint`).

## Infraestrutura

- **Next.js 16** (App Router, Turbopack) + Tailwind 4, publicado na **Vercel** (projeto `consertos-pro`,
  produção em consertos-pro.vercel.app). Funções na região **icn1 (Seul)** via `vercel.json`,
  ao lado do banco — não mudar sem mover o banco.
- **Supabase** projeto `Consertos_Pro` (`znsjsfyodlsomtpcwwhn`, região ap-northeast-2/Seul), plano Pro.
  Bucket principal `technical-assets` (aceita PDF e octet-stream); fotos em `diagnostic-attachments`.
- Push na `main` publica direto em produção.
- Segredos só no `.env.local` de cada PC (não vai pro git) e nas variáveis da Vercel:
  `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (só na Vercel), `TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ALLOWED_USER_IDS`, `BENCH_AGENT_TOKEN`. Ver `.env.example`.

## Decisões e cuidados importantes

- **Arquivos grandes nunca passam pelas funções da Vercel** (limite ~4,5 MB): uploads usam link
  assinado do Storage (`createSignedUploadUrl` + `uploadToSignedUrl`/PUT) e downloads/leituras
  redirecionam para `createSignedUrl` (ex.: `/api/technical-assets/[id]/content`, `/api/bios-dumps/[id]/download`).
- **PDF no servidor**: usar `extractPdfText` de `src/lib/pdf-text.ts` (carrega `pdf-parse/worker`
  antes do `pdf-parse`; sem isso dá "DOMMatrix is not defined" em produção).
- **IA**: chat do diagnóstico = agente Claude com ferramentas (`src/lib/ai/assistant-llm-claude.ts`,
  `diagnostic-agent-tools.ts`). Dia a dia em **Sonnet 5.5** (`ANTHROPIC_CHAT_MODEL`); botão
  **"🧠 Pensar mais"** do chat (vale para uma mensagem) e o parecer técnico usam **Opus 5.5**
  (`ANTHROPIC_CHAT_DEEP_MODEL`). Esforço `medium` (`ANTHROPIC_CHAT_EFFORT`). Escolha do dono para reduzir custo.
- **Envio do chat**: o composer (`diagnostic-chat-composer.tsx`) faz `fetch` em `POST /api/diagnosticos/[id]/chat`,
  que devolve a resposta **aos poucos** (NDJSON: `text`, `tools`, `ping` a cada 10 s, `done`/`error`); no fim a tela
  faz `router.refresh()`. Sem sinal por 45 s (90 s no primeiro) → aviso "Tentar de novo" sem perder o texto.
  Fotos são reduzidas no celular (`src/lib/client/shrink-photo.ts`, 1600 px JPEG) por causa do limite ~4,5 MB;
  análise da foto (gpt-4o-mini) roda com `after()` depois da resposta. Lógica comum em
  `src/lib/services/diagnostic-chat-post.ts`. Erros da Anthropic em português (`toFriendlyClaudeError`).
- **Memória do chat**: a conversa completa de cada caso (mensagens, consultas da IA com resultados, raciocínio,
  blocos de compactação) fica em `diagnostic_chat_threads.messages` e é reenviada inteira a cada mensagem.
  **Só cresce, nunca editar mensagens antigas** (quebra o cache e o raciocínio salvo; contas novas levam 400).
  As instruções fixas no `system` nunca mudam; o estado do caso vai como mensagem `role: "system"` depois da
  pergunta, só quando muda (`case_brief_hash`). Cache de 1 h na última mensagem do técnico; compactação
  automática da API a partir de 100 mil tokens. Fotos vão pela Files API (file_id). Casos antigos ganham a
  conversa montada uma vez a partir do texto de `ai_responses`. Se a API recusar o pedido (400) antes de qualquer
  ação, o chat responde em **modo de segurança** (histórico em texto) e marca `memoryMode: "fallback"` na resposta.
- **Custo da IA**: cada mensagem do chat é um loop de até **10 voltas**.
  Limites: web_search 3, web_fetch 2 (máx. 4000 tokens por página), instruções fixas em cache de 1 h.
  Ferramentas devolvem pouco: net com até 30 componentes/10 test points, busca no esquema 8 páginas,
  página do esquema 8000 caracteres, valores de referência 60 (constantes no topo de `diagnostic-agent-tools.ts`).
  A tela do caso mostra só a última troca; a conversa inteira fica em `/diagnosticos/[id]/historico`.
  `ai_token_logs` separa `cache_read_tokens`/`cache_write_tokens`; `estimated_cost_usd` usa a tabela
  de preços em `src/lib/services/token-logger.ts` (atualizar ao trocar de modelo); cache de 5 min = 1,25x, de 1 h = 2x. Parecer estruturado (`assistant-llm.ts`) também usa Claude;
  OpenAI só como reserva sem chave Anthropic.
- **Busca da biblioteca é por palavras em qualquer ordem**, no nome do arquivo e em
  `metadata.display_name` (nunca na descrição, que guarda o caminho de origem com "Bios").
  Mesma lógica na IA, na Biblioteca, em `/busca`, no painel do caso e no bot (`technical-library-search.ts`).
- Supabase devolve no máximo 1000 linhas por consulta: paginar com `.range()`.
- O laboratório (`/boardview/lab`) só lê **.brd (Landrex testlink) e .pdf**; .bdv/.fz/.cad/.tvw/.asc e
  BIOS ficam só para download. Boardview "view_locked" (com senha) não abre.
- Mobile/iPhone: campos com 16px (evita zoom), `viewport-fit=cover` + safe areas, composer do chat
  fixo acima da barra inferior. Painel lateral do caso tem ~360px: formulários ali em **uma coluna**.

## O que existe (out/2026)

- **Tela do caso** (`src/components/diagnostic-bench-workspace.tsx`): chat no centro; painel lateral
  recolhível com hipóteses, medições, placa/boardview/esquema, **BIOS (gravador)**, dados, formulários,
  parecer e histórico. Chat só mostra conversa (pareceres do botão ficam no painel) e só a **última troca**;
  botão "📜 Ver conversa anterior (N)" abre `/diagnosticos/[id]/historico` (conversa inteira com busca).
  Bolha de mensagem compartilhada: `src/components/chat-message-bubble.tsx`.
- **Biblioteca técnica**: ~1006 arquivos (esquemas, boardviews, BIOS/EC, datasheets; notebooks,
  desktops, placas de vídeo, celular, tablet) importados com catálogo (fabricantes, 194 modelos, 170 placas).
  Em `/catalogo-tecnico` (aba Modelos) dá para ver o que cada modelo tem e filtrar por esquema/boardview/BIOS.
  Família/Revisão dos modelos importados ficam vazias (o nome do arquivo não traz isso).
  Script reexecutável `scripts/import-technical-assets.mjs` (usa `tools/library-watcher/src/importer.mjs`).
- **Bot Telegram** `@consertospro_biblioteca_bot` (`/api/telegram/webhook`, só IDs liberados):
  busca e envia arquivos; `peça XXX` procura componente nas doadoras.
  Registrar webhook: `node scripts/telegram-set-webhook.mjs`.
- **Gravador de BIOS**: tabelas `diagnostic_bios_dumps`, `bench_jobs`, `bench_agents`; análise de dump em
  `src/lib/bios/analyze.ts`; API do agente em `/api/bench-agent/*` (token próprio, sem chave do banco);
  agente Windows em `tools/bench-agent` (drivers ezp2023/flashrom/minipro/simulado; lê 2x, backup antes de gravar,
  verifica depois). Gravador da oficina: **EZP2023+** — sem linha de comando, então o driver `ezp2023` é
  **assistido** (o app diz o passo; o técnico lê/grava no programa do EZP e salva o .bin em `EZP_PASTA\1-Leituras`).
  Testado só com chip simulado.
- **Placas doadoras** (`/doadoras`): foto → etiqueta D-0001…, IA lê código da placa e marcações,
  esquemas da placa indexados por página (`schematic_page_texts`, trigram); busca acha a referência
  (ex.: AON7506 → PQ708) via `src/lib/donors/locate.ts` (bom em Compal/Quanta; MSI/Apple às vezes só a página).
- **Vigia de pasta** (`tools/library-watcher`, Docker para o ZimaOS): pasta "Enviar para o ConsertosPro"
  → classifica (regras em `src/rules.mjs` + IA opcional), envia, move para Enviados/Erros, avisa no Telegram.

## Servidor da oficina

- Servidor **ZimaOS** em 172.30.0.1; o volume compartilhado `raid` é um **RAID externo montado no ZimaOS**
  (no PC aparece como `Y:\Servidor\HDD4`; "HDD4" é só nome de pasta).
- `HDD4\Biblioteca Técnica\<Categoria>\<Fabricante>\<Modelo (Placa)>\{Esquemas,Boardviews,BIOS}` + `_indice.csv`.
- `HDD4\_Antigas (revisar e apagar)` = pastas originais (sobras/cópias). `HDD4\ConsertosPro-watcher` = vigia + `.env`.
- Houve erro de leitura de E/S num zip grande (4 arquivos perdidos): verificar saúde do RAID.

## Pendências

1. Agente instalado e online no PC da bancada ("Bancada 1", `DRIVER=ezp2023`). Falta testar ler/gravar com
   placa de sucata antes de usar em cliente (e atualizar o PC para a v1.1.1).
2. Vigia de pasta **ainda não roda** (em 15/10 as pastas Enviar/Enviados/Erros estavam vazias e nunca usadas).
   `.env` em `HDD4\ConsertosPro-watcher` está pronto (DRY_RUN=0). Falta: descobrir o caminho real do volume
   `raid` no ZimaOS: é `/DATA/raid` (app Arquivos mostra ZimaOS-HD/raid; compose já ajustado). Falta instalar
   (App Store → Custom Install).
   O servidor responde em 172.30.0.1 e em 192.168.0.32 (`W:` no PC). Arquivos vão em
   `HDD4\Enviar para o ConsertosPro`, **não** em `ConsertosPro-watcher\src` (pasta do código).
6. Conferir as primeiras conversas com a memória completa: `ai_responses.structured_response_json->>'memoryMode'`
   deve ser `full`; se aparecer `fallback`, ler `memoryFallbackReason` e corrigir o pedido.
7. O bot do Telegram busca só na biblioteca do app. Busca automática em grupos/canais do Telegram exigiria
   um userbot (conta de pessoa, api_id/api_hash) rodando no ZimaOS: não existe ainda; o dono quer.
3. Varrer o resto do `HDD4` (mac_firmware, Memorias_Dados, HD_Antigo, Manutenção_Cursos_Apostilas…)
   atrás de mais esquemas/BIOS.
4. Testar em produção: leitura de foto das doadoras, "Ver na placa" no boardview, comando `peça` no Telegram.
5. Bloquear contas de teste ainda ativas (Codex QA, Codex Temp).

## Registro de mudanças

Mais recente primeiro. Uma linha por entrega, com a data e o que mudou.

- **2026-10-15** — Chat com **memória completa** (tabela `diagnostic_chat_threads`), como no Claude Code: antes só
  iam as últimas 8 mensagens em texto e a IA repetia perguntas e consultas (técnico reclamou no caso da bateria).
  Até 10 voltas, compactação a partir de 100 mil tokens, modo de segurança se a API recusar.
- **2026-10-15** — Biblioteca: esquema Quanta 0P5D (HP 15-dy/15s-fq, placa DA0P5DMB8C0) e BIOS
  `0p5dBAD.bin` (estrutura íntegra, mas nome original diz BAD: importada com aviso "não grave sem conferir").

- **2026-10-15** — Chat: se o celular desconecta, a IA termina e grava a resposta (`after()` na rota); "Tentar de
  novo" reaproveita a pergunta já gravada (`client_message_id`) em vez de duplicar; texto depois de `pause_turn`
  não se perde. Pasta `work/` e logs `.next-start-*` fora do git (tinha sessão Supabase salva, já revogada).
- **2026-10-15** — Chat mais rápido: resposta aparece enquanto a IA escreve (rota com streaming), análise da foto
  depois da resposta (+~6 s antes), fotos reduzidas no celular, tempo-limite com "Tentar de novo".
  Medido em 15/10: IA (Sonnet 5.5) leva 6–18 s; uma pergunta ficou presa no iPhone e nunca chegou ao servidor.
- **2026-10-15** — Erros da Anthropic no chat em português (créditos acabaram / chave recusada / sobrecarga).
- **2026-10-12** — Agente de bancada v1.1.1: driver `ezp2023` assistido (gravador **EZP2023+** confirmado),
  checagem de tamanho pelo backup antes de gravar; token com espaço/quebra de linha aceito e 401 com o motivo.
  Agente instalado e online no PC do EZP2023+; `BENCH_AGENT_TOKEN` configurado na Vercel.
- **2026-10-14** — Catálogo › Modelos no celular: cartões em vez da tabela (tabela só a partir de `md`).
- **2026-10-14** — Catálogo técnico › Modelos: colunas Placa e Arquivos (lista e baixa cada arquivo) e filtros
  "Com esquema / Com boardview / Com BIOS / Sem arquivo" (`getModelAssetIndex` em `catalog.ts`).
- **2026-10-14** — Painel do caso: medições com ponto em cima e valor embaixo, quebrando linha (textos longos vazavam do card).
- **2026-10-14** — Custo: chat em Sonnet 5.5 + botão "🧠 Pensar mais" (Opus 5.5); máx. 6 voltas; ferramentas
  devolvem menos; registro de custo conta o cache de 1 h a 2x. Antes: média US$ 0,27/mensagem (Opus 5.5).
- **2026-10-14** — Chat do caso mostra só a última troca; conversa inteira com busca em `/diagnosticos/[id]/historico`.
- **2026-10-14** — Chat envia à IA só as últimas 8 mensagens (caso Fujitsu tinha 57, ~17 mil tokens por envio).
  Medição com Opus 5.5 antes desta mudança: US$ 0,18–0,39 por mensagem (média 0,26).
- **2026-10-13** — Redução de custo da IA: chat em Opus 5.5 esforço médio (era Opus 5 alto), máx. 10 voltas,
  web limitada, cache de 1 h; registro de custo separa cache e usa preços corretos.
- **2026-10-12** — Regra: todo trabalho no projeto passa a ser registrado neste `CLAUDE.md`.
- **2026-10-12** — `CLAUDE.md` criado com o contexto do projeto.
- **2026-10-12** — Painel "Placa, boardview e esquema" do caso: filtros em uma coluna (estavam sobrepostos).
- **2026-10-12** — Placas doadoras (`/doadoras`) + comando `peça` no Telegram; laboratório carrega arquivos por link do Storage.
- **2026-10-12** — Seção "BIOS (gravador)" no caso + agente de bancada (`tools/bench-agent`).
- **2026-10-12** — Vigia de pasta para o ZimaOS (`tools/library-watcher`); `HDD4\Biblioteca Técnica` organizada.
- **2026-10-11** — Busca por palavras em `/busca`, Biblioteca, IA e painel do caso; bot do Telegram de arquivos.
- **2026-10-11** — Importação de ~1000 esquemas/boardviews/BIOS para a biblioteca; Biblioteca mostra tudo + filtro BIOS.
- **2026-10-11** — Login mais rápido (funções em Seul), service worker só com arquivos estáticos, iPhone ajustado.
- **2026-10-11** — Parecer técnico com Claude; PDF do esquema corrigido (DOMMatrix); diagnóstico pelo chat e menu simplificado.
