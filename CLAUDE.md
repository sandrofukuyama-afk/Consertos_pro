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
- O laboratório (`/boardview/lab`) lê **.brd (Landrex testlink) e .cad (GenCAD 1.4, texto puro —
  exportado por ferramentas como CAMCAD/Mentor Graphics)**, além de **.pdf**; `src/lib/boardview/parse.ts`
  detecta o formato pelo conteúdo (cabeçalho `$HEADER`/`GENCAD`), não pela extensão, então um `.cad` ou
  `.brd` com qualquer um dos dois conteúdos abre normalmente. GenCAD não traz o contorno da placa pronto
  (só grava componentes/pads/nets/testpins), então o contorno exibido é a caixa delimitadora dos pads,
  não o desenho real da borda. `.bdv/.fz/.tvw/.asc` e BIOS continuam só para download (sem parser).
  Boardview "view_locked" (com senha) não abre.
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
6. ~~Conferir as primeiras conversas com a memória completa~~ — conferido em 16/10: 20 respostas, todas
   `memoryMode: "full"`, nenhum `fallback`; 5 conversas guardadas. Continuar de olho depois de mudar
   ferramentas/instruções (`memoryFallbackReason` diz o motivo se cair no modo de segurança).
7. O bot do Telegram busca só na biblioteca do app. Busca automática em grupos/canais do Telegram exigiria
   um userbot (conta de pessoa, api_id/api_hash) rodando no ZimaOS: não existe ainda; o dono quer.
3. Varrer o resto do `HDD4` (mac_firmware, Memorias_Dados, HD_Antigo, Manutenção_Cursos_Apostilas…)
   atrás de mais esquemas/BIOS.
4. Testar em produção: leitura de foto das doadoras, "Ver na placa" no boardview, comando `peça` no Telegram.
8. Boardview `.cad` (GenCAD) é salvo na biblioteca com `file_format = 'other'` (o enum do banco não tem
   valor `'cad'` ainda — `toDbFileFormat()` em `technical-assets.mjs` faz esse desvio). Todo lugar que
   decide "isso é um boardview" (tela do caso, tela de associação, ferramenta da IA) reconhece esse caso
   pelo **nome do arquivo** via `isBoardviewFileFormat()`, uma função única em `technical-assets.mjs` —
   funciona, mas é um contorno. Se quiser filtrar/reportar arquivos GenCAD separadamente no catálogo, criar
   uma migration `alter type technical_asset_file_format add value 'cad'`, trocar `toDbFileFormat` para
   devolver `'cad'` direto, e então simplificar `isBoardviewFileFormat` para usar `file_format === 'cad'`
   como as demais.

## Registro de mudanças

Mais recente primeiro. Uma linha por entrega, com a data e o que mudou.

- **2026-10-18** — Correção visual: painel "BIOS (gravador)" do caso saindo da largura do painel lateral
  (relato do dono, com foto — rolagem horizontal, caixa "Gravar BIOS" cortada). Causa: o `<select>` de
  "Escolha o arquivo a gravar" (`diagnostic-bios-panel.tsx`) não tinha `w-full`, então crescia pro tamanho
  do texto mais longo das opções (nomes de BIOS da biblioteca) em vez de respeitar a largura do painel.
- **2026-10-18** — Correção: mesmo com o caso MSI Stealth 15M já ligado ao modelo certo do catálogo, a busca
  da tela de associação ainda trazia arquivos de placas de vídeo sem relação (RTX 4060, RTX 3080/3090...).
  Causa real: `searchTechnicalAssets()` (`src/app/api/technical-assets/route.ts`) deixava passar **qualquer**
  arquivo sem placa/modelo/fabricante vinculado (`boardId === null`) quando um filtro de placa estava ativo,
  mesmo sem nenhum texto digitado — então toda a parte da biblioteca ainda sem associação (boa parte dos
  ~1006 arquivos) aparecia em qualquer busca por placa/modelo. Agora esse "deixa passar" só vale quando há
  texto digitado (a pessoa está procurando algo pra associar de propósito); busca só por placa/modelo, sem
  texto, mostra só o que já está de fato ligado a ela.
- **2026-10-18** — Correção: a tela "Associar placa e arquivos técnicos" do caso MSI Stealth 15M A11UEK
  (`bbf8736b`) mostrava esquemas de uma placa de vídeo sem relação (V332) numa busca sem texto nem placa
  selecionada — relato do dono com foto. Causa: o caso nunca ficou ligado ao catálogo (`equipment_model_id`
  vazio), então o filtro de placa da tela não tinha nada pra pré-selecionar. Raiz do problema:
  `atualizar_equipamento_do_caso` (ferramenta da IA) só liga ao catálogo quando o nome do modelo bate
  exato (normalizado) com `equipment_models.model_name` — e esse modelo estava salvo como `"MS 1563"`
  (nome curto baseado no código da placa, forma que a IA nunca usa ao conversar com o técnico), enquanto
  a IA registra o nome comercial (`"Stealth 15M A11UEK"`). Duas correções: (1) catálogo renomeado para o
  nome comercial, como os outros modelos MSI já estão (CYBORG 15, GeForce RTX...); (2) a ferramenta agora
  também tenta achar o modelo pelo **código da placa** (`model_boards`) quando o nome não bate, e preenche
  `manufacturer_id` a partir da placa se ainda não tiver fabricante — mais robusto pra próximos casos com
  nome de catálogo diferente do nome comercial. Os 3 casos já abertos desse notebook continuam sem o
  modelo ligado (dono preferiu não mexer neles agora); a correção vale pra próximas conversas.
- **2026-10-18** — O caso `bbf8736b` (MSI Stealth 15M A11UEK) ainda trazia arquivos de placa sem relação na
  tela de associação mesmo depois da correção acima (ela só vale daqui pra frente). Ligado esse caso ao
  modelo certo do catálogo à mão (`equipment_model_id`); os outros 2 casos arquivados do mesmo notebook
  continuam sem ligação, por enquanto sem necessidade.
- **2026-10-16** — Chat: **resposta pronta se perdia** ao gravar a conversa (relato "erro de resposta pela IA").
  Caso MSI `bbf8736b`, pergunta das tensões do PU28 (BQ24780S) às 06:06 UTC: a IA respondeu (log às 06:07:25,
  2.722 tokens), mas `saveChatThread` falhou e nada foi gravado. Causa mais provável: caractere nulo `\u0000`
  (o Postgres recusa em texto/jsonb) vindo de PDF baixado pela IA (datasheet via web_fetch). Agora a conversa é
  gravada sem `\u0000` (`stripNulDeep`) e, se a gravação completa falhar por qualquer motivo, grava só pergunta
  + texto da resposta e entrega a resposta mesmo assim (`threadSaveIssue` no `structured_response_json`).

- **2026-10-16** — **Causa real** dos casos que "não apareciam" em nenhum aparelho: a lista da tela inicial
  (`getDashboardData` em `dashboard.ts`) só mostrava categorias com "computador/desktop/notebook". Casos abertos
  pelo chat rápido ficam "Não classificado" e sumiam; a TV Maxzen J32SK03 ("Televisão") também. Eram 4 de 6
  ativos escondidos (2 MSI, HP "abra o boaderview", TV). Filtro de categoria removido: entram todos os casos
  ativos/aguardando teste. O contador "Ativos" passa a contar todos. (Antes disso tentei: título dos casos sem
  modelo, atualização ao voltar para o app, linha de versão no menu, barrar conta bloqueada — tudo útil, mas
  não era a causa.)

- **2026-10-16** — Login com **conta bloqueada** agora é barrado com aviso (antes entrava e via tudo vazio). Relato:
  casos abertos num PC não apareciam no celular nem em outros PCs. Banco e site conferidos (mesmo banco: as
  respostas da IA desses casos foram gravadas pela Vercel; versão do celular = atual). Só 1 conta ativa
  (Sandro, gmail); 6 bloqueadas (ex.: "Usuario Teste" tec…@consertospro.com.br e san…@hotmail.com). Com RLS
  `is_active_authenticated_user()`, conta bloqueada não vê perfil nem casos, mas `getCurrentUser()` montava um
  usuário com o e-mail e deixava entrar. Agora `requireCurrentUser()` manda para `/login?error=A conta X está
  bloqueada…`. Essa hipótese **não era a causa** (a correção fica, é o comportamento certo) — ver entrada acima.

- **2026-10-16** — Título do caso na lista: `equipment_label` agora vem **antes** do nome do catálogo (o caso MSI
  ficava "MS 1563", nome curto do catálogo, em vez de "MSI Stealth 15M A11UEK (MS-1563)"). Primeiro uso da
  ferramenta de equipamento: a IA registrou "MSI GS65 Stealth" (chute; o técnico disse "Stealth 15M") —
  descrição da ferramenta reforçada (usar as palavras do técnico, não acrescentar série/nome comercial; na
  dúvida só o código da placa) e o rótulo do caso `0f89e59e` corrigido à mão. Há 3 casos do mesmo MSI
  (`bbf8736b`, `f1ea50e2` arquivado, `0f89e59e`): o técnico abriu um novo pelo chat rápido em vez de continuar.

- **2026-10-16** — IA registra o equipamento do caso: ferramenta `atualizar_equipamento_do_caso` (fabricante/modelo/
  placa) grava `equipment_label` (vira o título na lista) e liga `manufacturer_id`/`equipment_model_id` só se já
  existirem no catálogo com o mesmo nome normalizado — **não cria entradas no catálogo**. Instrução no prompt:
  usar quando o caso não tem modelo e o técnico disser, ou ler com certeza na foto; nunca chutar.
  Mudar ferramentas/prompt invalida o raciocínio salvo das conversas guardadas: o chat agora manda
  `thinking.block_binding.prefix_mismatch_behavior: "drop_block"` (beta `thinking-binding-controls-2026-08-01`),
  que descarta só o raciocínio antigo em vez de dar 400. Modo de segurança fica sem essa opção (mínimo possível).

- **2026-10-16** — Casos novos abertos no PC não apareciam no app instalado no iPhone (relato do dono). O banco tinha
  os casos (MSI MS-1563 de 16/10, HP 15s de 15/10) e a lista (`getDashboardData`) não filtra por usuário nem usa
  cache. (1) `RefreshOnReturn` (`src/components/refresh-on-return.tsx`, montado no `AppShell`, menos em
  `/boardview`): `router.refresh()` ao voltar para o app (visibilitychange/focus/pageshow, no máx. 1x a cada
  10 s) e a cada 60 s na tela inicial. (2) Menu do celular → "Sistema" mostra **endereço e versão**
  (`window.location.host` + `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`) para comparar o app do celular com o PC. O
  dono diz que o "Forçar Atualização" (recarrega tudo) também não trazia os casos: suspeita de o app ter sido
  instalado de outro endereço — **confirmar com a linha de versão**.
  **Causa real (confirmada):** o celular estava na versão certa (3756035) e os casos estavam na lista, mas casos
  abertos pelo chat rápido não têm modelo e apareciam como **"Equipamento sem modelo"** — iguais entre si, o
  dono não os reconhecia. `getDashboardData()` agora usa o começo do relato (48 caracteres) como título
  quando não há modelo/rótulo/série/fabricante.

- **2026-10-16** — Cores iguais no boardview e no esquema (pedido do dono): **magenta = selecionado**, **dourado =
  relacionado**. No esquema (`schematic-pdf-viewer.tsx`) o selecionado era azul-claro e as outras ocorrências
  rosa — parecido demais com o magenta do boardview. Agora: selecionado magenta com etiqueta "Selecionado",
  outras ocorrências dourado, página atual na lista de ocorrências magenta. Seleção no boardview → esquema abre
  a 1ª página com o nome e rola até ele (componente/pino → ref do componente; test point/net → nome da net).

- **2026-10-16** — Boardview: **toque mais preciso nos pinos** (relato do dono: no C4706 não conseguia escolher o
  outro pino). `findNearestBoardviewSelection()` comparava só distância, e o centro de peça pequena (entre os
  2 pinos) ganhava; agora a prioridade é pino > test point > componente (toque dentro da caixa, a menor
  vence). Área de toque em pixels de tela (12 px mouse, 20 px dedo; antes mínimo fixo de 45 mil, maior que o
  passo de um 0402). Pinos desenhados crescem com o zoom (até 14 px). Conferido na 0P5D (C4706, pinos a
  17,7 mil). Teste novo em `lab.test.mts`.

- **2026-10-16** — Boardview: **linhas de ligação** (pedido do dono). Tocou num pino/test point → linhas retas
  dele até cada ponto da mesma net; tocou num componente → linhas de cada pino dele. Os arquivos não trazem as
  trilhas de cobre (o `.cad` da 0P5D tem só vias em `$ROUTES`, nenhum segmento), então é "para onde vai", não o
  caminho físico. Linha tracejada = ponto ligado no outro lado (com filtro de lado ativo). Terra, "UNCONNECTED"/NC
  e nets com mais de 80 pontos ficam sem linha; máx. 400 linhas. Cartão do toque lista "Ligado a N
  componentes". `getSelectionConnections()` em `lab.ts` (testado), desenho em `boardview-canvas.tsx`.
  Conferido na 0P5D: TP-672 (+3VPCU) → 48 ligações; PU1001 → 32 componentes. Não testado visualmente.

- **2026-10-16** — Boardview: avisos não tapam mais a pinagem (relato do dono). Cada toque abria sozinho o
  "Drawer técnico" (no iPhone ~94% da largura, cobria a placa) — agora só abre pelo botão **"Detalhes"** (novo
  no cartão do toque, ou o da barra). O cartão do toque saiu de perto do ponto tocado e fica no **canto
  inferior esquerdo** do boardview (com "Detalhes" e "Fechar"). `selectEntry()` em `boardview-lab.tsx` não
  chama mais `setDetailsOpen(true)`; prop `onOpenDetails` no `boardview-canvas.tsx`.
  Obs.: `lab-focus.test.mts` já falhava antes (import sem extensão `./lab` não resolve no `node --test`).

- **2026-10-16** — Boardview: item encontrado na busca (ou tocado) fica em **destaque magenta** por cima de tudo
  (pedido do dono): caixa preenchida no componente, anel duplo, marcas de mira e etiqueta com o nome
  (`TP-672 • +3VPCU`, `PU1001`, `PU1001 pino 3`). Antes o selecionado era roxo fino e um test point buscado
  ficava amarelo igual aos vizinhos da mesma net. Magenta não é usado em mais nada (`FOUND_COLOR` /
  `getFoundMarker()` em `boardview-canvas.tsx`). Net inteira continua em dourado. Cores do boardview: componente
  topo = ponto verde, fundo = azul; pads verde-água; test points quadrado vermelho vazado; ligados à seleção =
  dourado/amarelo. Não testado visualmente (só lint/tsc).

- **2026-10-16** — Laboratório: a busca agora acha **test points** (relato do dono: "tp-672", citado pela IA, dava
  "Nenhum resultado"). Os test points não têm nome no arquivo (GenCAD grava `TESTPIN Probe_ …`), então o app
  numera `TP-1, TP-2…` (`gencad.ts` e `landrex-testlink.ts`) — e a busca (`searchBoardviewLabModel` em `lab.ts`)
  só procurava componentes e nets. Aceita "tp-672", "TP672", "tp 672" (só quando o texto parece TP, para não
  poluir busca de net), respeita o filtro de lado e centraliza a placa no ponto. Conferido no arquivo real da
  0P5D: TP-672 = +3VPCU (top), TP-141 = REGN6V (bottom). A ferramenta `detalhar_net` da IA agora avisa que
  `TP-n` é numeração do app (não aparece no esquema; lá se procura pela net). Teste novo em `lab.test.mts`.

- **2026-10-16** — Tela do caso: boardview e esquema abrem o laboratório **em outra aba** (pedido do dono, para
  ver chat e placa ao mesmo tempo). Todos os links do caso para `/boardview/lab` usam a aba nomeada
  `laboratorio-<id do caso>` (`labTabTarget()` em `diagnostic-bench-workspace.tsx`), então cliques seguintes
  (outro componente, outra página do esquema) reaproveitam a mesma aba em vez de abrir várias. Ideias
  seguintes conversadas: chat dentro do laboratório (gaveta no iPhone) e componentes/nets clicáveis nas
  respostas da IA.

- **2026-10-16** — Correção visual: no "Registro rápido da bancada" (painel do caso), os campos
  "Tipo de medição"/"Ponto medido" e "Valor medido"/"Unidade"/"Valor esperado"/"Tolerância" saíam do
  bloco do card (relato do dono, com foto). Mesma causa das correções visuais anteriores: `md:grid-cols-2`
  é breakpoint de **viewport**, não do container, e esse formulário roda dentro do painel lateral do caso
  (~360px) — então num monitor largo ele tentava 2 colunas e os campos vazavam da borda. `measurement-form.tsx`
  (3 grids) agora sempre em uma coluna, como os outros formulários desse painel.
- **2026-10-16** — Excluídas as duas contas de técnico de teste ainda ativas (Codex QA, Codex Temp) que o
  dono viu em "Técnicos da oficina" — perfil (`technician_profiles`), linha em `users` e login
  (Supabase Auth) de cada uma. Feito por script avulso com a chave de serviço (não ficou no repositório),
  mesma checagem do botão "Excluir" do app (sem diagnóstico atribuído antes de apagar). Resolve a
  pendência "bloquear contas de teste ainda ativas".
- **2026-10-16** — Correção: botão "Abrir no laboratório" não aparecia nos cards de `/biblioteca` para um
  boardview `.cad` (GenCAD) já associado (relato do dono, com foto do card faltando o botão). Mesma causa
  das correções anteriores de hoje: `getTechnicalLibraryItems()` e `buildTechnicalAssetItem()`
  (`diagnostics.ts`) ainda checavam `file_format === "brd"/"bdv"` direto, sem o fallback `'other'` + `.cad`
  (pendência 8). Depois de corrigir, varri o resto do código atrás do mesmo padrão em vez de esperar o
  próximo relato, e achei mais 4 ocorrências: preferência de boardview do caso e ordenação da tela de
  associação (`actions.ts`, 3 pontos), parecer técnico estruturado (`assistant.ts`), busca de peça nas
  doadoras (`donor-boards.ts`, precisou trazer `original_filename` na consulta) e busca geral em `/busca`
  (`search.ts`). Todos agora usam a função compartilhada `isBoardviewFileFormat()` (ver pendência 8).
- **2026-10-16** — Correção visual: nos cards de busca de arquivo técnico (tela "Associar placa e arquivos
  técnicos"), o texto de botões como "Excluir" quebrava letra por letra numa coluna fina. Causa: o card usava
  `lg:flex-row` para pôr texto e botões lado a lado — um breakpoint de **viewport**, não do container; esse
  componente roda dentro do painel lateral do caso (~360px), então num monitor largo o layout tentava ficar
  horizontal mesmo espremido no painel estreito. Texto e botões agora sempre empilhados, com
  `whitespace-nowrap` nos botões. Não testado visualmente no navegador (só lint/build).
- **2026-10-16** — Correção: mesmo com o `.cad` associado com sucesso ao caso, o botão "Abrir boardview" da
  tela principal do diagnóstico não aparecia — 4º lugar com a mesma checagem `"brd"`/`"bdv"` copiada
  (`diagnostic-bench-workspace.tsx`), igual aos dois já corrigidos hoje (IA, tela de associação). Em vez de
  corrigir mais um ponto solto, extraí `isBoardviewFileFormat()` para `technical-assets.mjs` (já
  compartilhado client/server) e fiz os 3 lugares (tela do caso, `toAssetKind()` na IA,
  `isBoardviewFormat()` na tela de associação) delegarem pra essa função única, em vez de cada um
  reimplementar a mesma checagem — essa duplicação foi exatamente o que causou o bug "meio corrigido" duas
  vezes seguidas no mesmo dia.
- **2026-10-16** — Correção: na tela "Associar placa e arquivos técnicos", o card de um boardview `.cad`
  aparecia como "OTHER" e só tinha o botão "Excluir" — sem "Usar como boardview". Dava pra achar o arquivo
  na busca mas nunca associá-lo de fato (o formulário "tinha sucesso" sem enviar nenhum `asset_id`). Causa:
  `isBoardviewFormat()` e `formatAssetTypeLabel()`, específicas desse componente, só reconheciam
  `file_format` literal `'cad'` — nunca ganharam o fallback `'other'` + nome terminado em `.cad` que já
  existia em `toAssetKind()` (IA) e `getTechnicalAssetTypeLabel()` (Biblioteca). Corrigido nas duas funções
  e num 2º ponto que chamava `getTechnicalAssetTypeLabel()` sem o nome do arquivo.
- **2026-10-16** — Correção: "Associar placa e arquivos técnicos" buscando só por Placa/Modelo (sem digitar
  nada no campo de texto) não achava arquivos mais antigos daquela placa, mesmo já associados. Causa: sem
  texto/formato, `searchTechnicalAssets()` em `src/app/api/technical-assets/route.ts` só pedia os 240
  arquivos mais recentes da biblioteca antes do filtro de placa/modelo rodar no cliente. Agora qualquer
  filtro ativo (texto, formato, placa ou modelo) usa o teto de 1000 linhas que o Supabase permite por
  consulta. Reproduzido ao vivo: busca por placa DA0P5DMB8C0 sem texto não achava o boardview `.cad` dela.
- **2026-10-15** — Correção: `detalhar_componente` (ferramenta da IA) recusava referências exatas como
  PU1001/PU1101 com "nao encontrado" mesmo quando o componente existia (o fallback de busca aproximada
  listava o proprio componente como "parecido", o que entregou o bug). Causa: `describeComponent()` em
  `diagnostic-agent-tools.ts` maiusculizava a referência e buscava em `model.componentsByRef`, que é
  indexado em minúsculas — maiúsculo nunca batia com minúsculo. Afetava qualquer boardview (.brd ou .cad),
  não só GenCAD; passou despercebido porque o fallback de busca aproximada escondia o erro. Confirmado ao
  vivo no caso da placa DA0P5DMB8C0 antes e depois da correção.
- **2026-10-15** — Correção: a IA do chat ainda recusava o boardview `.cad` (GenCAD) recem-suportado com
  "arquivo tecnico nao encontrado ou nao e boardview/esquema". Causa: `toAssetKind()` em
  `assistant-technical-context.ts` decidia se um arquivo e boardview olhando só o `file_format` gravado no
  banco (`'brd'`/`'bdv'`), e o `.cad` fica salvo como `'other'` (pendencia 8). Agora reconhece pelo nome do
  arquivo quando o formato gravado e `'other'` e termina em `.cad`, sem precisar de migration. Corrigido nos
  3 lugares que chamavam essa funcao (resumo do asset, selecao do boardview preferido do caso, ativacao
  manual pela ferramenta do agente). Teste novo (`toAssetKindForTest`) cobre o arquivo real da biblioteca e
  confirma que formatos genuinamente nao suportados (.fz etc., tambem salvos como `'other'`) continuam
  caindo em "so para download", sem tentar abrir algo que o parser nao entende.
- **2026-10-15** — Laboratório boardview passa a ler **.cad (GenCAD 1.4)**, não só .brd: arquivo real da
  biblioteca ("Quanta 0P5 DA0P5DMB8C0 Rev C (BDV)(CAD).cad", 1732 componentes/6416 pads/759 testpins/1124
  nets) testado e parseando certo. Novo `src/lib/boardview/gencad.ts` (parser nativo, resolve posição de
  pino por componente+rotação+espelhamento) e `src/lib/boardview/parse.ts` (detecta o formato pelo
  conteúdo, não pela extensão — assim um `.cad` com conteúdo Landrex ou um `.brd` com conteúdo GenCAD
  abrem do jeito certo). GenCAD não grava o contorno da placa pronto, então o contorno vira a caixa
  delimitadora dos pads (não é a borda real). IA (`assistant-technical-context.ts`) também usa o novo
  dispatcher, então o chat já consegue ler boardview GenCAD. Upload de `.cad` pela tela (antes só .brd/.bdv/
  .pdf) grava com `file_format = 'other'` no banco (enum não tem `'cad'` — ver pendência 8).
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
