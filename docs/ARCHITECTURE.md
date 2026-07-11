# Arquitetura do Projeto

## Objetivo

Definir a arquitetura recomendada para o aplicativo interno de diagnostico tecnico com IA, focado em desktops, notebooks, televisores e celulares.

Este documento descreve a estrutura tecnica do sistema, os blocos principais, as responsabilidades de cada camada e a ordem de evolucao recomendada.

---

## Principios de Arquitetura

- separar conhecimento estrutural de historico operacional;
- desacoplar a IA da interface;
- tratar o banco como memoria tecnica de longo prazo;
- manter rastreabilidade completa;
- priorizar simplicidade no MVP e evolucao segura depois.

---

## Stack Recomendada

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend e plataforma

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Edge Functions

### Busca e recuperacao

- PostgreSQL full text search
- `pgvector`

### IA

- modelo de linguagem para raciocinio tecnico
- embeddings para busca semantica
- RAG para consulta da base interna antes de responder

---

## Visao em Camadas

### 1. Camada de apresentacao

Responsavel por:

- login;
- navegacao;
- cadastro tecnico;
- abertura e acompanhamento de diagnosticos;
- registro de testes e medicoes;
- visualizacao de evidencias;
- consulta de documentos e casos.

### 2. Camada de aplicacao

Responsavel por:

- regras de negocio;
- validacao de fluxo;
- orquestracao de consultas;
- preparacao de contexto;
- consolidacao de resultados para a interface.

### 3. Camada de dados

Responsavel por:

- persistencia relacional;
- controle de integridade;
- consultas operacionais;
- leitura de conhecimento consolidado;
- suporte a auditoria.

### 4. Camada de armazenamento de arquivos

Responsavel por:

- fotos;
- anexos;
- PDFs;
- esquemas;
- boardviews;
- BIOS;
- firmwares.

### 5. Camada de recuperacao semantica

Responsavel por:

- extrair texto;
- gerar chunks;
- criar embeddings;
- buscar contexto semelhante;
- fornecer base para respostas da IA.

### 6. Camada de IA

Responsavel por:

- analisar contexto recuperado;
- sugerir o proximo teste;
- justificar recomendacoes;
- registrar respostas estruturadas;
- nunca substituir validacao humana.

---

## Blocos Funcionais

## Bloco A. Identidade e acesso

Componentes:

- autenticacao;
- usuarios;
- perfis tecnicos;
- status de acesso.

Objetivo:

- garantir que toda acao tecnica tenha autor identificado.

## Bloco B. Catalogo tecnico mestre

Componentes:

- categorias;
- fabricantes;
- modelos;
- placas;
- componentes;
- documentos tecnicos.

Objetivo:

- centralizar conhecimento tecnico relativamente estavel.

## Bloco C. Operacao de diagnostico

Componentes:

- diagnosticos;
- sintomas;
- testes;
- medicoes;
- anexos;
- hipoteses;
- respostas da IA.

Objetivo:

- registrar o trabalho real da bancada com sequencia cronologica.

## Bloco D. Conhecimento consolidado

Componentes:

- casos resolvidos;
- causas confirmadas;
- solucoes aplicadas;
- revisoes humanas.

Objetivo:

- transformar historico em memoria tecnica confiavel.

## Bloco E. Busca e inteligencia

Componentes:

- indexacao textual;
- embeddings;
- busca por similaridade;
- recuperacao de documentos;
- recuperacao de casos semelhantes.

Objetivo:

- dar base real para a IA responder com contexto.

## Bloco F. Auditoria

Componentes:

- historico de alteracoes;
- revisoes;
- trilha de promocao de conhecimento.

Objetivo:

- garantir confiabilidade e governanca tecnica.

---

## Fluxo Tecnico Futuro

1. O tecnico abre um diagnostico.
2. Registra sintomas e dados conhecidos.
3. Informa testes e medicoes.
4. O sistema consulta historico e documentos.
5. O motor de recuperacao monta contexto.
6. A IA responde com o proximo teste recomendado.
7. O tecnico executa e registra o resultado.
8. O caso e consolidado ao final.
9. O conhecimento validado volta para a base consultavel.

---

## Estrategia de Escalabilidade

### Escalabilidade funcional

- comecar com diagnostico e memoria operacional;
- adicionar busca documental;
- adicionar busca semantica;
- adicionar IA guiada;
- adicionar estatisticas e automacoes.

### Escalabilidade de dados

- separar dados mestres de dados operacionais;
- usar indices especificos por tipo de consulta;
- evitar consultas pesadas no fluxo principal;
- prever views e agregacoes futuras.

### Escalabilidade de IA

- nao depender de um unico prompt monolitico;
- manter contexto estruturado;
- permitir troca de modelo no futuro;
- separar recuperacao de contexto da geracao de resposta.

---

## Estrutura de Repositorio Sugerida

```text
docs/
  ARCHITECTURE.md
  MVP_SCOPE.md
  AI_STRATEGY.md
  DATABASE_MODELING.md
  PROJECT_PLAN.md

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
    documents/
    knowledge/
    search/
    ai/
  lib/
  services/
  types/
```

---

## Decisoes Arquiteturais Importantes

### 1. O banco e o centro do sistema

A IA deve ser uma camada consumidora de conhecimento, nao a fonte primaria da verdade.

### 2. O storage nao substitui o banco

Arquivos ficam no Supabase Storage, mas o banco precisa registrar metadados, contexto e vinculos tecnicos.

### 3. Casos resolvidos precisam de revisao

Nem todo caso encerrado deve virar conhecimento forte imediatamente.

### 4. Embeddings sao infraestrutura, nao regra de negocio

Eles devem ser tratados como recurso de busca e nao como substituto do dado estruturado.

### 5. Auditoria nao e opcional

Em um sistema que gera memoria tecnica de alto valor, rastreabilidade e obrigatoria.

---

## Ordem Recomendada de Implementacao

1. schema do banco;
2. autenticacao;
3. catalogo tecnico;
4. diagnosticos;
5. testes e medicoes;
6. anexos e documentos;
7. encerramento de caso;
8. busca textual;
9. embeddings e busca semantica;
10. IA assistente.

---

## Resultado Esperado

Ao seguir essa arquitetura, o projeto deve evoluir de um simples registro tecnico para uma plataforma de memoria operacional, consulta inteligente e assistencia de diagnostico com base em evidencia real da bancada.
