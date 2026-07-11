insert into public.equipment_categories (name, slug, description)
values
  ('Desktop', 'desktop', 'Equipamentos desktop de bancada.'),
  ('Notebook', 'notebook', 'Notebooks e ultrabooks.'),
  ('Television', 'television', 'TVs, monitores integrados e smart TVs.'),
  ('Smartphone', 'smartphone', 'Celulares e dispositivos moveis.')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = timezone('utc', now());

insert into public.board_types (name, slug, description)
values
  ('Mainboard', 'mainboard', 'Placa principal do equipamento.'),
  ('Power Supply', 'power_supply', 'Fonte primaria ou fonte secundaria.'),
  ('T-Con', 'tcon', 'Controladora de painel e imagem.'),
  ('Logic Board', 'logic_board', 'Placas logicas complementares.'),
  ('Daughterboard', 'daughterboard', 'Sub-placa secundaria ou modular.')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = timezone('utc', now());

insert into public.manufacturers (name, normalized_name, country)
values
  ('Dell', 'dell', 'United States'),
  ('Lenovo', 'lenovo', 'China'),
  ('Samsung', 'samsung', 'South Korea'),
  ('LG', 'lg', 'South Korea'),
  ('Motorola', 'motorola', 'United States'),
  ('Asus', 'asus', 'Taiwan'),
  ('Apple', 'apple', 'United States')
on conflict (normalized_name) do update
set name = excluded.name,
    country = excluded.country,
    updated_at = timezone('utc', now());

insert into public.symptoms (equipment_category_id, name, slug, description, symptom_group)
select c.id, v.name, v.slug, v.description, v.symptom_group
from public.equipment_categories c
join (
  values
    ('desktop', 'Nao liga', 'nao_liga', 'Equipamento sem energizacao.', 'power'),
    ('desktop', 'Desliga sozinho', 'desliga_sozinho', 'Perde alimentacao apos iniciar.', 'power'),
    ('desktop', 'Sem video', 'sem_video', 'Liga sem apresentar imagem.', 'video'),
    ('notebook', 'Nao liga', 'nao_liga', 'Sem resposta ao botao power.', 'power'),
    ('notebook', 'Liga sem imagem', 'liga_sem_imagem', 'Atividade eletrica sem video.', 'video'),
    ('notebook', 'Nao carrega', 'nao_carrega', 'Bateria sem carga ou sem reconhecimento.', 'charge'),
    ('television', 'Liga com som sem imagem', 'liga_com_som_sem_imagem', 'Audio normal com painel apagado.', 'video'),
    ('television', 'Reinicia', 'reinicia', 'Ciclo de reinicio durante uso.', 'system'),
    ('television', 'Nao liga', 'nao_liga', 'Sem resposta ao comando de ligar.', 'power'),
    ('smartphone', 'Nao liga', 'nao_liga', 'Sem energizacao aparente.', 'power'),
    ('smartphone', 'Nao carrega', 'nao_carrega', 'Falha na linha ou circuito de carga.', 'charge'),
    ('smartphone', 'Aquece excessivamente', 'aquece_excessivamente', 'Aquecimento anormal em repouso ou carga.', 'thermal')
) as v(category_slug, name, slug, description, symptom_group)
  on v.category_slug = c.slug
on conflict (equipment_category_id, slug) do update
set name = excluded.name,
    description = excluded.description,
    symptom_group = excluded.symptom_group,
    updated_at = timezone('utc', now());

insert into public.tests (name, slug, test_group, description, default_unit)
values
  (
    'Medicao de tensao',
    'medicao_tensao',
    'electrical',
    'Leitura de tensao em ponto especifico da placa.',
    'V'
  ),
  (
    'Teste de continuidade',
    'teste_continuidade',
    'electrical',
    'Verifica continuidade eletrica entre dois pontos.',
    'ohm'
  ),
  (
    'Regravacao de BIOS',
    'regravacao_bios',
    'firmware',
    'Regrava firmware ou BIOS para validar corrupcao.',
    null
  ),
  (
    'Substituicao cruzada',
    'substituicao_cruzada',
    'replacement',
    'Troca temporaria por componente ou placa sabidamente funcional.',
    null
  ),
  (
    'Teste com fonte assimetrica',
    'teste_fonte_assimetrica',
    'power',
    'Analisa consumo e comportamento de corrente em bancada.',
    'A'
  )
on conflict (slug) do update
set name = excluded.name,
    test_group = excluded.test_group,
    description = excluded.description,
    default_unit = excluded.default_unit,
    updated_at = timezone('utc', now());

insert into public.tags (name, slug, tag_group, description)
values
  ('Prioridade alta', 'prioridade_alta', 'diagnostic_priority', 'Casos com urgencia operacional.'),
  ('Dano liquido', 'dano_liquido', 'failure_context', 'Presenca de oxidacao ou contato com liquido.'),
  ('Sem imagem', 'sem_imagem', 'symptom_hint', 'Falha recorrente de video ou painel.')
on conflict (slug, tag_group) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = timezone('utc', now());
