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
   - **CH341A** → `flashrom` para Windows + driver do CH341 (Zadig → WinUSB).
   - **XGecu T48/T56/TL866II** → `minipro` para Windows.
4. Copie `bench-agent.env.example` para `bench-agent.env` e preencha:
   `BENCH_AGENT_TOKEN` (o mesmo da Vercel), `DRIVER` e o caminho do programa.
5. Dê dois cliques em `iniciar-agente.bat`. O caso no app passa a mostrar
   "Agente da bancada online".

Para testar sem gravador: `DRIVER=simulado` e `SIM_CHIP_FILE=C:\teste\chip.bin`
(qualquer BIOS de 4/8/16 MB faz o papel do chip).

## No app (Vercel)

Variável de ambiente `BENCH_AGENT_TOKEN` com um valor aleatório longo (64
caracteres hexadecimais), o mesmo do `bench-agent.env`.
