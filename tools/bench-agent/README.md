# Agente de bancada (gravador de BIOS)

Programa que roda no PC da bancada, ligado ao gravador USB, e executa os pedidos
**Ler BIOS** e **Gravar BIOS** feitos na seção "BIOS (gravador)" de cada caso.

- Toda leitura é feita **duas vezes** e só é aceita se as duas forem iguais.
- Toda gravação: **backup do chip → gravar → ler de novo e comparar**. O backup
  vai para o caso antes de qualquer gravação.
- Gravação só acontece depois da confirmação no app, e é recusada se o tamanho
  do arquivo não bater com o do chip.
- O agente não tem a chave do banco: fala só com a API do app, com um token próprio.

## Instalação (Windows 10/11)

1. Instale o **Node.js 22 LTS** (nodejs.org).
2. Copie esta pasta (`tools/bench-agent`) para o PC da bancada, ex.: `C:\ConsertosPro-agente`.
3. Instale o software do gravador:
   - **EZP2023+** (o gravador da oficina) → programa original do EZP2023 + driver USB.
     Ele não tem linha de comando, então o agente funciona em **modo assistido** (ver abaixo).
   - **CH341A** → `flashrom` para Windows + driver do CH341 (Zadig → WinUSB).
   - **XGecu T48/T56/TL866II** → `minipro` para Windows.
4. Copie `bench-agent.env.example` para `bench-agent.env` e preencha:
   `BENCH_AGENT_TOKEN` (o mesmo da Vercel), `DRIVER` e o caminho do programa.
5. Dê dois cliques em `iniciar-agente.bat`. O caso no app passa a mostrar
   "Agente da bancada online".

## EZP2023+ (modo assistido)

No `bench-agent.env`: `DRIVER=ezp2023` e `EZP_PASTA=C:\ConsertosPro-EZP` (criada sozinha com
`1-Leituras`, `2-Para gravar` e `3-Processados`). O app mostra no caso, passo a passo, o que fazer
(o console da bancada também mostra e apita):

- **Ler BIOS**: no programa do EZP2023, escolha o chip, clique em **Ler (Read)** e salve o `.bin`
  em `1-Leituras`. Faça isso **duas vezes** (o agente só aceita se as duas leituras forem iguais).
- **Gravar BIOS**: primeiro duas leituras de backup (como acima). Depois o agente coloca
  `GRAVAR-….bin` em `2-Para gravar`: abra esse arquivo no EZP2023, clique em **Auto**
  (apagar + gravar + verificar) e então leia o chip mais duas vezes, salvando em `1-Leituras`.
  O agente compara com o arquivo pedido e envia backup e verificação para o caso.
- Se o tamanho do backup não bater com o do arquivo, nada é colocado para gravar.
- Cada passo espera até `EZP_ESPERA_MIN` minutos (padrão 20); depois o pedido falha e é só pedir de novo.
- Arquivos usados vão para `3-Processados` (pode apagar de vez em quando).

Para testar sem gravador: `DRIVER=simulado` e `SIM_CHIP_FILE=C:\teste\chip.bin`
(qualquer BIOS de 4/8/16 MB faz o papel do chip).

## No app (Vercel)

Variável de ambiente `BENCH_AGENT_TOKEN` com um valor aleatório longo (64
caracteres hexadecimais), o mesmo do `bench-agent.env`.
