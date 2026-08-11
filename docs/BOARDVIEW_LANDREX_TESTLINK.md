# Boardview Landrex/Testlink

Este documento descreve o módulo TypeScript reutilizável criado para leitura local de arquivos `.brd` no variant Landrex/Testlink identificado no projeto.

## Objetivo

Fornecer uma camada isolada de parsing que:

- receba os bytes de um `.brd`
- detecte e decodifique o variant binário Landrex/Testlink
- retorne uma estrutura normalizada com:
  - metadados
  - contorno da placa
  - componentes
  - pads/pinos
  - nets
  - test points

Não faz parte deste módulo:

- interface
- upload
- persistência no Supabase
- uso de arquivos proprietários como fixture de teste

## Arquivos

- `src/types/boardview.ts`
- `src/lib/boardview/landrex-testlink.ts`
- `src/lib/boardview/landrex-testlink.test.mts`

## Referência de licença

O formato foi estudado com apoio do projeto OpenBoardView, cuja licença é MIT:

- <https://github.com/OpenBoardView/OpenBoardView>
- <https://github.com/OpenBoardView/OpenBoardView/blob/master/LICENSE>

O módulo do ConsertosPro foi implementado do zero. Nenhum código do OpenBoardView foi copiado.

## Variant suportado

O parser suporta o variant detectado no arquivo real analisado:

- cabeçalho codificado: `23 E2 63 28`

Quando esse cabeçalho está presente, cada byte diferente de `0x00`, `0x0A` e `0x0D` passa por uma transformação reversível antes do parsing textual.

## Estrutura lógica lida

Após a decodificação, o parser processa estes blocos:

- `var_data:`
- `Format:`
- `Parts:` ou `Pins1:`
- `Pins:` ou `Pins2:`
- `Nails:`

## Estrutura normalizada retornada

`parseLandrexTestlinkBoardview(bytes)` retorna:

- `metadata`
- `contour`
- `components`
- `padPins`
- `nets`
- `testPoints`

### Metadados

Incluem:

- formato e variant
- contagens declaradas pelo arquivo
- contagens realmente lidas
- bounds
- largura e altura em `mil` e `mm`

### Componentes

Cada componente inclui:

- `ref`
- `partIndex`
- `rawType`
- `mountingSide`
- `kind`
- `firstPinIndex`
- `lastPinIndex`
- `pinCount`

### Pads/pinos

Cada pad/pino inclui:

- referência do componente
- ordinal dentro do componente
- probe
- net
- lado
- coordenadas em `mil` e `mm`

### Nets

Cada net agrega:

- nome
- quantidade de pads/pinos
- quantidade de test points
- probes associados

## Testes

Os testes usam uma fixture sintética, sem conteúdo proprietário, com o mesmo esquema de codificação do variant analisado.

Isso garante:

- validação da decodificação
- validação do parsing por blocos
- validação da normalização dos dados

## Validação local com arquivo real

Além dos testes sintéticos, o módulo pode ser validado localmente contra um `.brd` real fora do repositório, passando seus bytes para `parseLandrexTestlinkBoardview`.

O arquivo real analisado nao deve ser incluído no Git nem enviado ao GitHub.
