# Estrategia de IA

## Objetivo

Definir como a IA deve entrar no projeto de forma util, auditavel e segura, sem substituir o tecnico nem gerar respostas soltas sem contexto.

Este documento descreve a estrategia recomendada para a fase em que a IA for integrada ao sistema.

---

## Papel da IA no produto

A IA deve funcionar como assistente tecnico de diagnostico.

Ela deve:

- analisar o caso atual;
- considerar testes ja executados;
- considerar medicoes registradas;
- consultar casos semelhantes;
- consultar documentos tecnicos;
- sugerir o proximo melhor teste;
- justificar a recomendacao;
- ajudar a organizar o raciocinio tecnico.

Ela nao deve:

- encerrar um caso sozinha;
- transformar hipotese em verdade;
- ignorar historico do caso;
- sugerir troca de componente sem evidencia minima;
- operar como chat generico sem memoria interna.

---

## Ordem de Prioridade do Conhecimento

Quando a IA responder, a prioridade deve ser:

1. historico do diagnostico atual;
2. casos resolvidos da propria oficina;
3. documentos tecnicos relacionados;
4. catalogo tecnico mestre;
5. conhecimento geral do modelo de linguagem.

Essa ordem e importante para reduzir respostas genericas e aumentar valor real para a bancada.

---

## Arquitetura Recomendada da IA

## Etapa 1. Recuperacao de contexto

Antes de chamar o modelo, o sistema deve recuperar:

- resumo do diagnostico;
- sintomas atuais;
- testes realizados;
- medicoes;
- hipoteses abertas;
- placas e componentes envolvidos;
- casos semelhantes;
- trechos de documentos tecnicos.

## Etapa 2. Montagem do contexto estruturado

O contexto enviado ao modelo deve ser organizado em blocos como:

- dados do equipamento;
- relato inicial;
- sintomas;
- testes ja realizados;
- medicoes relevantes;
- casos semelhantes;
- evidencias documentais;
- restricoes de seguranca e de metodo.

## Etapa 3. Geracao da resposta

O modelo deve devolver resposta estruturada contendo:

- resumo do raciocinio;
- hipotese principal;
- grau de confianca;
- proximo teste recomendado;
- o que esse teste valida;
- o que muda dependendo do resultado.

## Etapa 4. Registro da resposta

Toda resposta deve ser salva com:

- modelo utilizado;
- contexto ou versao do prompt;
- texto bruto;
- formato estruturado;
- horario;
- vinculo com o diagnostico.

---

## Formato Ideal da Resposta da IA

A resposta futura da IA deve se aproximar deste formato:

### Resumo tecnico

Explicacao curta do estado atual do caso.

### Hipotese principal

Suspeita mais relevante no momento.

### Evidencias

- o que reforca a hipotese;
- o que ja foi descartado;
- quais medições influenciaram a analise.

### Proximo teste recomendado

- onde medir ou verificar;
- qual comportamento esperado;
- como interpretar o resultado.

### Nivel de confianca

Escala relativa, nunca absoluta.

### Observacao de seguranca

Quando o procedimento tiver risco tecnico.

---

## Estrategia de RAG

O sistema deve usar Retrieval-Augmented Generation.

Isso significa:

- recuperar conhecimento interno antes de responder;
- limitar a resposta ao contexto relevante;
- reduzir alucinacoes;
- priorizar memoria da oficina.

### Fontes de recuperacao

- diagnosticos em andamento;
- casos resolvidos;
- causas confirmadas;
- solucoes aplicadas;
- documentos tecnicos;
- chunks de documentos;
- possivelmente resumos de componentes e placas.

### Tipos de busca

- busca estruturada por campos;
- busca textual;
- busca vetorial por similaridade.

---

## Embeddings

Embeddings devem ser gerados para textos com alto valor de recuperacao, como:

- resumos de diagnosticos;
- casos resolvidos;
- explicacoes tecnicas;
- trechos de documentos;
- descricoes consolidadas de sintomas.

Nao e necessario gerar embedding para tudo.

O criterio deve ser:

- utilidade para busca;
- estabilidade do texto;
- relevancia tecnica.

---

## Regras de Qualidade da IA

### 1. Nao repetir o que ja foi feito

Se o historico mostra que um teste foi executado, a IA nao deve sugeri-lo novamente sem justificativa clara.

### 2. Um teste por vez

A IA deve orientar o processo, nao despejar listas longas de possibilidades.

### 3. Explicar o motivo

Cada proximo passo sugerido precisa dizer:

- por que esse teste foi escolhido;
- o que ele confirma;
- o que ele descarta.

### 4. Separar evidencias de suposicoes

O modelo deve identificar claramente o que veio de:

- medicao real;
- documento tecnico;
- caso semelhante;
- inferencia.

### 5. Exigir validacao humana

Nenhuma resposta da IA deve marcar conhecimento como confirmado sem revisao humana.

---

## Roadmap da IA

## Fase A. Sistema operando sem IA

Primeiro o sistema precisa coletar historico real.

## Fase B. Busca inteligente sem resposta automatica

Mostrar casos semelhantes e documentos relacionados.

## Fase C. IA com recomendacao assistida

Gerar sugestao do proximo teste com base no contexto recuperado.

## Fase D. IA com melhor estrutura de raciocinio

Adicionar hipoteses, contradicoes e fluxo de decisao mais refinado.

## Fase E. IA especializada por dominio

Possivel evolucao futura:

- agente para TV;
- agente para notebook;
- agente para smartphone;
- agente documental;
- agente estatistico.

---

## Riscos da IA

### 1. Resposta generica

Mitigacao:

- sempre usar contexto recuperado;
- nao chamar o modelo sem base interna.

### 2. Confianca excessiva

Mitigacao:

- separar hipotese de confirmacao;
- exigir revisao humana.

### 3. Recomendacao tecnicamente ruim

Mitigacao:

- armazenar feedback do tecnico;
- revisar qualidade das sugestoes;
- ajustar prompt e fontes de recuperacao.

### 4. Custo alto cedo demais

Mitigacao:

- so integrar IA depois do MVP;
- reduzir chamadas desnecessarias;
- usar contexto objetivo.

---

## Metricas Futuras da IA

- taxa de aceitacao do proximo teste sugerido;
- taxa de repeticao indevida de sugestoes;
- tempo medio ate a conclusao do caso;
- qualidade percebida pelo tecnico;
- percentual de sugestoes que levaram a resolucao;
- diferenca entre casos com e sem apoio da IA.

---

## Resultado Esperado

Se essa estrategia for seguida, a IA deixara de ser um chat generico e passara a atuar como um mecanismo de apoio tecnico com memoria, contexto e responsabilidade, realmente util para o ambiente de bancada.
