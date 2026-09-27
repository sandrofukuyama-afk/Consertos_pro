## Landrex/Testlink `.brd` PoC

PoC isolada para leitura local de arquivos boardview `.brd` no variant analisado.

Escopo desta PoC:
- ler um arquivo `.brd` local
- decodificar o variant binário Landrex/Testlink encontrado
- extrair contagens de componentes, pinos/pads, nails/test points e nets
- estimar dimensões da placa a partir do bloco `Format`
- mostrar algumas referências de exemplo

Fora de escopo:
- interface do ConsertosPro
- banco de dados
- upload
- commit/push do boardview

### Referência de formato e licença

Esta PoC foi implementada do zero, mas foi orientada pela estrutura pública do projeto OpenBoardView:

- Repositório: `https://github.com/OpenBoardView/OpenBoardView`
- Licença do OpenBoardView: MIT

Nenhum código foi copiado para esta PoC; apenas a ideia geral da estrutura de blocos e da necessidade de decodificação do arquivo foi usada como referência técnica.
