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
  `diagnostic-agent-tools.ts`); modelo/esforço por `ANTHROPIC_CHAT_MODEL` / `ANTHROPIC_CHAT_EFFORT`
  (padrão `claude-opus-5-5`, `medium` — escolha do dono para reduzir custo).
- **Custo da IA**: cada mensagem do chat é um loop de até 10 voltas que reenvia tudo a cada volta.
  Limites: web_search 3, web_fetch 2 (máx. 4000 tokens por página), instruções fixas em cache de 1 h.
  Histórico enviado à IA: só as **últimas 8 mensagens** (`RECENT_HISTORY_MESSAGES` em
  `src/lib/services/diagnostic-chat.ts`); as anteriores viram um aviso, porque resumo/medições/testes/
  hipóteses do caso já vão no contexto. A tela do chat continua mostrando a conversa inteira.
  `ai_token_logs` separa `cache_read_tokens`/`cache_write_tokens`; `estimated_cost_usd` usa a tabela
  de preços em `src/lib/services/token-logger.ts` (atualizar ao trocar de modelo). Parecer estruturado (`assistant-llm.ts`) também usa Claude;
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
  parecer e histórico. Chat só mostra conversa (pareceres do botão ficam no painel).
- **Biblioteca técnica**: ~1006 arquivos (esquemas, boardviews, BIOS/EC, datasheets; notebooks,
  desktops, placas de vídeo, celular, tablet) importados com catálogo (fabricantes, 194 modelos, 170 placas).
  Script reexecutável `scripts/import-technical-assets.mjs` (usa `tools/library-watcher/src/importer.mjs`).
- **Bot Telegram** `@consertospro_biblioteca_bot` (`/api/telegram/webhook`, só IDs liberados):
  busca e envia arquivos; `peça XXX` procura componente nas doadoras.
  Registrar webhook: `node scripts/telegram-set-webhook.mjs`.
- **Gravador de BIOS**: tabelas `diagnostic_bios_dumps`, `bench_jobs`, `bench_agents`; análise de dump em
  `src/lib/bios/analyze.ts`; API do agente em `/api/bench-agent/*` (token próprio, sem chave do banco);
  agente Windows em `tools/bench-agent` (drivers flashrom/minipro/simulado; lê 2x, backup antes de gravar,
  verifica depois). Testado só com chip simulado.
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

1. Colocar `BENCH_AGENT_TOKEN` na Vercel (mesmo do `.env.local`) e redeploy.
2. Confirmar o modelo do gravador (CH341A / XGecu / RT809H), instalar `tools/bench-agent` no PC da bancada
   e testar com placa de sucata antes de usar em cliente.
3. Descobrir o caminho real do volume `raid` no ZimaOS, ajustar `tools/library-watcher/docker-compose.yml`
   e instalar (App Store → Custom Install).
4. Varrer o resto do `HDD4` (mac_firmware, Memorias_Dados, HD_Antigo, Manutenção_Cursos_Apostilas…)
   atrás de mais esquemas/BIOS.
5. Testar em produção: leitura de foto das doadoras, "Ver na placa" no boardview, comando `peça` no Telegram.
6. Bloquear contas de teste ainda ativas (Codex QA, Codex Temp).

## Registro de mudanças

Mais recente primeiro. Uma linha por entrega, com a data e o que mudou.

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
