# Plano Completo do Projeto

## Nome Provisorio

AI Repair Engineer

## Objetivo do Projeto

Construir um aplicativo interno de diagnostico tecnico assistido por IA para manutencao de:

- desktops
- notebooks
- televisores
- celulares

O sistema sera usado internamente pela equipe tecnica e tera como foco principal:

- acelerar diagnosticos;
- registrar o raciocinio tecnico;
- evitar repeticao de testes;
- acumular conhecimento real da bancada;
- permitir busca por defeitos, causas e solucoes;
- transformar historico tecnico em memoria consultavel pela IA.

## O que o sistema nao sera

Este projeto nao deve incluir no escopo principal:

- clientes;
- ordem de servico;
- financeiro;
- pagamentos;
- estoque;
- orcamentos;
- controle comercial.

O sistema sera um ambiente tecnico de bancada, nao um ERP.

---

## Visao do Produto

O aplicativo deve funcionar como um engenheiro tecnico digital que apoia o tecnico humano durante a investigacao.

Ele nao deve apenas responder perguntas. Ele deve:

- ler o historico do caso;
- entender sintomas e testes ja executados;
- consultar casos anteriores;
- consultar documentos tecnicos;
- sugerir o proximo teste mais relevante;
- justificar a recomendacao;
- registrar o que funcionou e o que nao funcionou;
- aprender com os casos concluidos.

## Proposta de valor

O diferencial do sistema nao e somente usar IA, mas combinar:

- memoria tecnica da propria oficina;
- historico completo do equipamento atual;
- documentacao tecnica indexada;
- busca semantica;
- consolidacao de causas confirmadas;
- estatisticas reais da bancada.

---

## Principios do Sistema

### 1. A IA nao substitui o tecnico

A decisao final sempre deve ser humana.

### 2. Hipotese nao e causa confirmada

O sistema precisa diferenciar claramente:

- suspeita;
- indicio;
- causa provavel;
- causa confirmada;
- solucao aplicada;
- solucao validada.

### 3. Um teste por vez

A IA deve priorizar o proximo melhor teste, nao uma lista generica de tentativas.

### 4. Nada deve ser perdido

Cada medicao, foto, observacao, hipotese e resposta da IA deve poder ser consultada futuramente.

### 5. O conhecimento da oficina e o ativo principal

O sistema precisa ser desenhado para acumular patrimonio tecnico ao longo dos anos.

### 6. A IA deve consultar evidencia antes de responder

A resposta ideal deve vir depois de analisar:

- cadastro tecnico;
- historico do diagnostico;
- casos semelhantes;
- documentos;
- medicoes e anexos;
- base consolidada de defeitos.

---

## Escopo Funcional

## Modulo 1. Autenticacao e usuarios tecnicos

Responsabilidades:

- login;
- controle basico de acesso;
- perfis tecnicos;
- registro de autor e revisor;
- rastreabilidade de alteracoes.

Entregas esperadas:

- autenticacao integrada ao Supabase Auth;
- perfis de tecnico;
- perfis de revisor tecnico;
- status de usuario.

## Modulo 2. Catalogo tecnico mestre

Responsabilidades:

- categorias de equipamento;
- fabricantes;
- modelos;
- placas;
- componentes;
- documentos tecnicos.

Entregas esperadas:

- estrutura mestre padronizada;
- vinculo entre modelos e placas;
- vinculo entre placas e componentes;
- cadastro de documentos tecnicos;
- preparo para enriquecimento futuro.

## Modulo 3. Diagnosticos em andamento

Responsabilidades:

- abertura de diagnostico;
- identificacao do equipamento;
- registro do relato inicial;
- sintomas;
- placas investigadas;
- historico tecnico do caso.

Entregas esperadas:

- criacao de casos;
- estado do diagnostico;
- resumo atual;
- contexto fisico do aparelho;
- fluxo de acompanhamento.

## Modulo 4. Testes, medicoes e evidencias

Responsabilidades:

- registrar testes executados;
- registrar medicoes detalhadas;
- registrar anexos e fotos;
- preservar sequencia cronologica;
- evitar repeticao de testes.

Entregas esperadas:

- linha do tempo do caso;
- contexto por placa e componente;
- armazenamento de evidencias;
- estrutura pronta para analise da IA.

## Modulo 5. Hipoteses e respostas da IA

Responsabilidades:

- guardar hipoteses abertas;
- registrar respostas da IA;
- guardar justificativas;
- apontar proximo passo sugerido;
- manter historico auditavel da conversa tecnica.

Entregas esperadas:

- respostas estruturadas;
- trilha de sugestoes;
- separacao entre analise e confirmacao;
- base para orquestracao futura de agentes.

## Modulo 6. Casos resolvidos e conhecimento consolidado

Responsabilidades:

- transformar diagnosticos encerrados em conhecimento reutilizavel;
- registrar causas confirmadas;
- registrar solucoes aplicadas;
- classificar casos como confirmados, provaveis ou nao resolvidos.

Entregas esperadas:

- memoria tecnica confiavel;
- separacao entre conhecimento forte e fraco;
- base para recomendacoes futuras.

## Modulo 7. Biblioteca tecnica

Responsabilidades:

- armazenar PDFs, esquemas, boardviews, BIOS, firmwares, notas tecnicas e mapas de tensao;
- indexar conteudo textual;
- relacionar documentos a modelos, placas e componentes.

Entregas esperadas:

- metadados de documentos;
- indexacao por chunks;
- preparo para embeddings e RAG.

## Modulo 8. Busca inteligente

Responsabilidades:

- busca textual;
- busca por modelo, placa, componente e sintoma;
- busca semantica com `pgvector`;
- busca em documentos tecnicos;
- busca em casos resolvidos.

Entregas esperadas:

- retorno de casos semelhantes;
- retorno de hipoteses relacionadas;
- recuperacao de trechos de documentos;
- ranking por relevancia.

## Modulo 9. Auditoria e revisao

Responsabilidades:

- historico de alteracoes;
- revisao humana;
- promocao controlada de conhecimento;
- rastreabilidade.

Entregas esperadas:

- trilha de alteracoes;
- revisao de casos criticos;
- confiabilidade da memoria futura da IA.

## Modulo 10. Estatisticas tecnicas

Responsabilidades:

- medir defeitos recorrentes;
- medir componentes mais falhos;
- medir tempo medio de resolucao;
- medir frequencia por modelo e placa.

Entregas esperadas:

- dashboards internos no futuro;
- base para inteligencia operacional;
- estatisticas reais da oficina.

---

## Arquitetura Recomendada

## Frontend

Tecnologia recomendada:

- Next.js
- React
- TypeScript
- Tailwind CSS

Motivos:

- boa produtividade;
- excelente integracao com fluxos modernos;
- facilidade para evoluir a interface;
- bom suporte a autenticacao e SSR quando necessario.

## Backend

Tecnologia recomendada:

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Edge Functions para rotinas especificas

Motivos:

- reduz custo inicial de infraestrutura;
- acelera o MVP;
- oferece autenticacao, banco e storage integrados;
- combina bem com RAG e indexacao futura.

## Busca semantica

Tecnologia recomendada:

- `pgvector`

Uso previsto:

- embeddings de casos resolvidos;
- embeddings de resumos de diagnostico;
- embeddings de respostas e contextos;
- embeddings de chunks de documentos tecnicos.

## IA

Abordagem recomendada:

- IA nao acoplada diretamente ao chat bruto;
- motor de contexto antes da chamada ao modelo;
- resposta sempre baseada em recuperacao interna.

Camadas futuras:

- recuperacao do diagnostico atual;
- recuperacao de casos semelhantes;
- recuperacao de documentacao tecnica;
- agregacao de contexto;
- chamada ao modelo;
- registro auditavel da resposta.

---

## Estrategia de Dados

O projeto deve operar com quatro camadas de dados:

### 1. Catalogo tecnico mestre

Guarda:

- fabricantes;
- modelos;
- placas;
- componentes;
- documentos tecnicos;
- relacionamentos tecnicos permanentes.

### 2. Operacao de diagnostico

Guarda:

- diagnosticos;
- sintomas;
- testes;
- medicoes;
- hipoteses;
- respostas da IA;
- anexos.

### 3. Conhecimento consolidado

Guarda:

- casos resolvidos;
- causas confirmadas;
- solucoes aplicadas;
- revisoes humanas.

### 4. Infraestrutura de busca e auditoria

Guarda:

- chunks de documentos;
- fontes textuais para embeddings;
- vetores;
- historico de alteracoes.

---

## Fluxo Principal do Produto

1. O tecnico cria um novo diagnostico.
2. Informa categoria, marca, modelo e dados conhecidos.
3. Registra sintomas iniciais e contexto do aparelho.
4. Registra placas investigadas.
5. Anexa fotos, observacoes e testes ja realizados.
6. O sistema organiza o contexto do caso.
7. Futuramente, a IA consulta historico, casos e documentos.
8. A IA sugere o proximo teste com justificativa.
9. O tecnico executa e registra o resultado.
10. O ciclo se repete ate haver conclusao.
11. O caso e encerrado como confirmado, provavel ou nao resolvido.
12. A causa e a solucao passam a integrar a memoria consultavel.

---

## Roadmap por Fases

## Fase 0. Planejamento e definicao

Objetivo:

- consolidar visao, arquitetura e modelagem.

Entregas:

- plano do projeto;
- modelagem logica do banco;
- diagrama conceitual;
- definicao do escopo do MVP.

Status atual:

- em andamento com boa base ja definida.

## Fase 1. Estrutura de dados

Objetivo:

- transformar a modelagem em implementacao real no Supabase.

Entregas:

- SQL inicial do schema;
- enums;
- chaves estrangeiras;
- indices iniciais;
- buckets de storage;
- seeds basicas de catalogo.

Resultado esperado:

- banco pronto para receber o MVP.

## Fase 2. Fundacao do backend

Objetivo:

- disponibilizar a base de acesso aos dados.

Entregas:

- projeto app inicial;
- configuracao Supabase;
- camada de acesso;
- politicas basicas de seguranca;
- services para diagnosticos e catalogo.

Resultado esperado:

- sistema apto a criar e consultar casos.

## Fase 3. MVP operacional sem IA forte

Objetivo:

- permitir uso real da bancada antes da automacao inteligente completa.

Entregas:

- login;
- cadastro tecnico mestre;
- criacao de diagnostico;
- registro de sintomas;
- registro de testes;
- registro de medicoes;
- anexos;
- encerramento de caso;
- classificacao do resultado.

Resultado esperado:

- comecar a alimentar a memoria do sistema.

## Fase 4. Biblioteca tecnica e indexacao

Objetivo:

- integrar documentos e preparar o terreno para RAG.

Entregas:

- upload de documentos;
- vinculacao a modelos, placas e componentes;
- extracao de texto;
- chunking;
- indexacao inicial.

Resultado esperado:

- busca tecnica documental pronta para uso futuro.

## Fase 5. Busca semantica e casos semelhantes

Objetivo:

- permitir recuperacao inteligente do conhecimento acumulado.

Entregas:

- geracao de embeddings;
- indexacao vetorial;
- busca por similaridade;
- ranking de casos;
- busca em documentos tecnicos.

Resultado esperado:

- motor de contexto funcional.

## Fase 6. IA assistente de diagnostico

Objetivo:

- incorporar a IA ao fluxo tecnico.

Entregas:

- geracao de respostas tecnicas;
- sugestao do proximo teste;
- justificativa da recomendacao;
- registro das respostas;
- separacao entre hipotese e confirmacao.

Resultado esperado:

- assistente tecnico realmente util na bancada.

## Fase 7. Aprendizado operacional e estatisticas

Objetivo:

- transformar o historico em inteligencia da oficina.

Entregas:

- estatisticas por fabricante e modelo;
- componentes recorrentes;
- tempo medio de resolucao;
- frequencia de causas;
- qualidade de recomendacoes futuras.

Resultado esperado:

- sistema mais preciso ao longo do tempo.

## Fase 8. Evolucoes avancadas

Possibilidades:

- agentes especializados;
- analise de imagem de placa;
- anotacao visual de componentes;
- fluxos guiados por tipo de equipamento;
- dashboards tecnicos;
- recomendacoes preventivas;
- arvore dinamica de investigacao.

---

## MVP Recomendado

O MVP deve ser pequeno o suficiente para ficar de pe rapidamente e forte o suficiente para comecar a acumular conhecimento util.

### O que entra no MVP

- autenticacao basica;
- usuarios tecnicos;
- fabricantes;
- categorias;
- modelos;
- placas;
- componentes;
- documentos tecnicos com metadados;
- criacao de diagnosticos;
- sintomas;
- testes executados;
- medicoes;
- anexos;
- hipoteses manuais;
- encerramento de caso;
- causas confirmadas;
- solucoes aplicadas;
- classificacao do caso.

### O que nao precisa entrar no MVP

- chat sofisticado com IA;
- analise de imagem;
- dashboard estatistico completo;
- motor multiagente;
- automacao de fluxo complexo;
- permisos granulares avancados;
- recomendacoes automaticas baseadas em aprendizado estatistico profundo.

---

## Ordem Recomendada de Execucao

1. Validar o plano e a modelagem.
2. Gerar o SQL inicial do banco.
3. Criar o projeto base com integracao Supabase.
4. Implementar autenticacao e usuarios.
5. Implementar catalogo tecnico mestre.
6. Implementar modulo de diagnosticos.
7. Implementar testes, medicoes e anexos.
8. Implementar encerramento e conhecimento consolidado.
9. Implementar upload e catalogacao de documentos.
10. Implementar busca textual.
11. Implementar embeddings e busca semantica.
12. Integrar a IA ao fluxo tecnico.
13. Evoluir estatisticas e recursos avancados.

---

## Estrutura Sugerida do Repositorio

Exemplo de organizacao:

```text
app/
docs/
supabase/
  migrations/
  seeds/
src/
  app/
  components/
  features/
    auth/
    catalog/
    diagnostics/
    measurements/
    documents/
    knowledge/
    search/
    ai/
  lib/
  services/
  types/
```

Sugestao para `docs/`:

- `PROJECT_PLAN.md`
- `DATABASE_MODELING.md`
- `ARCHITECTURE.md`
- `MVP_SCOPE.md`
- `AI_STRATEGY.md`

---

## Requisitos Nao Funcionais

### Seguranca

- autenticacao obrigatoria;
- rastreabilidade de alteracoes;
- separacao minima por usuario;
- controle de acesso a documentos internos.

### Confiabilidade

- nenhuma resposta da IA deve apagar historico;
- dados tecnicos precisam ser auditaveis;
- arquivos devem ter referencia consistente no storage.

### Performance

- consultas de diagnostico devem ser rapidas;
- recuperacao de casos semelhantes deve ser eficiente;
- indexacao vetorial precisa escalar gradualmente.

### Evolucao

- schema preparado para crescimento;
- separacao clara entre dados mestres e operacionais;
- baixo acoplamento entre IA e banco.

---

## Riscos do Projeto

### 1. Escopo grande demais cedo demais

Mitigacao:

- manter MVP enxuto;
- priorizar entrada de dados reais antes de recursos complexos.

### 2. Banco mal modelado

Mitigacao:

- validar modelagem antes do SQL;
- preservar separacao entre catalogo, operacao e conhecimento consolidado.

### 3. IA sem contexto suficiente

Mitigacao:

- implantar primeiro coleta de dados;
- so depois integrar recomendacao automatica.

### 4. Baixa padronizacao de dados

Mitigacao:

- criar catalogos controlados;
- usar tags, sintomas e testes padronizados;
- exigir revisao em conhecimento promovido.

### 5. Sobrecarga operacional para o tecnico

Mitigacao:

- manter telas futuras objetivas;
- permitir preenchimento progressivo;
- priorizar velocidade de registro.

---

## Criterios de Sucesso

O projeto sera bem-sucedido se conseguir:

- registrar diagnosticos de forma pratica;
- preservar historico tecnico detalhado;
- recuperar casos semelhantes com qualidade;
- separar hipotese de causa confirmada;
- reaproveitar conhecimento da propria oficina;
- reduzir retrabalho;
- melhorar o tempo medio de diagnostico ao longo do uso.

---

## Entregas Documentais Recomendadas

Antes do desenvolvimento completo, e ideal manter estes documentos:

- plano geral do projeto;
- modelagem do banco;
- arquitetura tecnica;
- escopo do MVP;
- estrategia da IA;
- backlog priorizado;
- padroes de nomenclatura.

---

## Backlog Inicial Priorizado

### Prioridade alta

- finalizar modelagem do banco;
- gerar schema SQL inicial;
- criar buckets e convencoes de storage;
- implementar autenticacao;
- implementar catalogo tecnico;
- implementar diagnosticos;
- implementar testes e medicoes;
- implementar anexos;
- implementar encerramento de caso.

### Prioridade media

- upload e indexacao de documentos;
- busca textual por casos;
- busca por componentes;
- tags e filtros;
- revisao tecnica de conhecimento.

### Prioridade futura

- embeddings;
- RAG;
- chat tecnico com IA;
- estatisticas;
- fluxos guiados;
- visao computacional.

---

## Proxima Etapa Recomendada

A proxima etapa ideal e transformar a modelagem ja criada em:

1. schema SQL inicial para Supabase/PostgreSQL;
2. enums e constraints;
3. estrutura de migracoes;
4. seeds basicas de categorias, tipos de placa e tipos de teste.

## Resumo Executivo

Este projeto deve nascer como uma plataforma tecnica de memoria e diagnostico, e nao como um simples chat com IA.

O caminho mais seguro e:

1. consolidar o banco;
2. colocar o MVP operacional de pe;
3. alimentar dados reais;
4. so depois introduzir IA com contexto forte;
5. evoluir para busca semantica, estatisticas e automacoes avancadas.

Se essa ordem for respeitada, o sistema tende a ficar muito mais util, confiavel e valioso com o tempo.
