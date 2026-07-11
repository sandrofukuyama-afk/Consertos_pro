# Escopo do MVP

## Objetivo

Definir o menor conjunto de funcionalidades capaz de colocar o sistema em uso real na bancada, com foco em captura de conhecimento tecnico e organizacao de diagnosticos.

O MVP nao precisa ter toda a inteligencia pronta. Ele precisa criar a base correta para a inteligencia futura.

---

## Meta do MVP

Permitir que o tecnico:

- abra um diagnostico;
- identifique o equipamento;
- registre sintomas;
- registre testes e medicoes;
- anexe evidencias;
- encerre o caso;
- salve causa e solucao;
- construa historico reutilizavel.

---

## O que entra no MVP

## 1. Acesso e usuarios

- login com Supabase Auth;
- usuarios tecnicos;
- perfis basicos;
- identificacao de autor das alteracoes.

## 2. Catalogo tecnico minimo

- categorias de equipamento;
- fabricantes;
- modelos;
- tipos de placa;
- placas;
- componentes;
- relacao entre modelo e placa;
- relacao entre placa e componente.

## 3. Diagnosticos

- criar diagnostico;
- editar diagnostico;
- status do diagnostico;
- resumo atual;
- tecnico responsavel;
- categoria, marca e modelo;
- observacoes iniciais;
- contexto fisico do aparelho.

## 4. Sintomas

- associar sintomas ao diagnostico;
- marcar sintoma principal;
- registrar origem do sintoma;
- permitir sintomas padronizados.

## 5. Testes realizados

- registrar tipo de teste;
- registrar ordem do teste;
- registrar procedimento;
- registrar resultado;
- vincular ao tecnico.

## 6. Medicoes

- registrar tensao, corrente, resistencia, temperatura ou outra leitura;
- informar ponto medido;
- informar unidade;
- informar valor medido;
- opcionalmente informar valor esperado;
- vincular a placa ou componente quando possivel.

## 7. Anexos e evidencias

- upload de fotos;
- upload de PDFs de apoio do caso;
- metadados basicos;
- vinculacao ao diagnostico.

## 8. Hipoteses manuais

- registrar suspeitas tecnicas;
- mudar estado da hipotese;
- diferenciar hipotese descartada de mantida.

## 9. Encerramento do caso

- marcar como confirmado, provavel ou nao resolvido;
- registrar resumo tecnico;
- registrar causa confirmada;
- registrar solucao aplicada;
- registrar se a solucao foi efetiva.

## 10. Biblioteca tecnica basica

- cadastrar documentos tecnicos;
- associar a fabricante, modelo, placa ou componente;
- guardar apenas metadados e arquivo nesta fase.

---

## O que fica fora do MVP

- chat completo com IA;
- resposta automatica com base em RAG;
- embeddings;
- busca semantica;
- leitura automatica de esquemas;
- visao computacional;
- dashboards estatisticos completos;
- agentes especializados;
- anotacao visual de placa;
- automacao de diagnostico passo a passo;
- permissoes granulares complexas.

---

## Criticos do MVP

Estas capacidades sao essenciais para o MVP valer a pena:

- registrar dados com rapidez;
- manter historico cronologico;
- separar diagnostico em andamento de conhecimento validado;
- permitir consulta futura do caso;
- evitar perda de informacao tecnica importante.

---

## Regras do MVP

### Regras operacionais

- todo diagnostico deve ter um relato inicial;
- todo teste deve ter autor;
- toda medicao deve pertencer a um diagnostico;
- todo encerramento deve indicar o estado final do caso;
- causa confirmada e solucao aplicada devem poder existir separadamente.

### Regras de qualidade

- nao tratar hipotese como solucao;
- nao depender da IA para operar;
- nao exigir campos demais na abertura do caso;
- permitir refinamento progressivo dos dados.

---

## Fluxo minimo do MVP

1. Fazer login.
2. Criar diagnostico.
3. Escolher categoria e fabricante.
4. Informar modelo se conhecido.
5. Registrar sintomas.
6. Registrar testes feitos.
7. Registrar medicoes.
8. Anexar evidencias.
9. Atualizar resumo do caso.
10. Encerrar como confirmado, provavel ou nao resolvido.
11. Registrar causa e solucao.

---

## Resultado esperado do MVP

Ao final do MVP, a oficina deve conseguir:

- usar o sistema no dia a dia;
- construir um historico tecnico reutilizavel;
- registrar conhecimento sem depender de memoria informal;
- preparar a base ideal para a proxima fase com IA e busca inteligente.
