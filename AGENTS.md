# AGENTS.md

## Regras de codificacao e texto

- Todos os textos visiveis ao usuario devem ser salvos em UTF-8.
- Textos em portugues devem manter acentos corretos e nunca podem ser convertidos para mojibake.
- Antes de finalizar qualquer alteracao, revise o diff procurando sequencias quebradas de codificacao.
- E proibido commitar sequencias como `Ã`, `Â`, `â€` ou `�` em textos do app. <!-- encoding-check-ignore -->
- Sempre execute `npm run check:encoding` antes de concluir mudancas que alterem textos visiveis.

## Escopo da validacao automatica

- O check de codificacao varre apenas arquivos de codigo e texto do projeto.
- O check ignora `node_modules`, `.next`, `work/`, logs, arquivos binarios e arquivos tecnicos como `.brd`, `.bdv` e `.pdf`.
- Assets de terceiros vendorizados, como bundles minificados em `public/pdfjs/`, ficam fora da verificacao para evitar falso positivo.
