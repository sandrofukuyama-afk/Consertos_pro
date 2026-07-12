insert into public.equipment_categories (name, slug, description)
values
  ('Desktop', 'desktop', 'Equipamentos desktop de bancada.'),
  ('Notebook', 'notebook', 'Notebooks e ultrabooks.'),
  ('Televisão', 'television', 'TVs, monitores integrados e smart TVs.'),
  ('Smartphone', 'smartphone', 'Celulares e dispositivos móveis.')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = timezone('utc', now());

insert into public.board_types (name, slug, description)
values
  ('Mainboard', 'mainboard', 'Placa principal do equipamento.'),
  ('Power Supply', 'power_supply', 'Fonte primária ou fonte secundária.'),
  ('T-Con', 'tcon', 'Controladora de painel e imagem.'),
  ('Logic Board', 'logic_board', 'Placas lógicas complementares.'),
  ('Daughterboard', 'daughterboard', 'Sub-placa secundária ou modular.')
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
    ('desktop', 'Não liga', 'nao_liga', 'Equipamento sem energização.', 'power'),
    ('desktop', 'Desliga sozinho', 'desliga_sozinho', 'Perde alimentação após iniciar.', 'power'),
    ('desktop', 'Sem vídeo', 'sem_video', 'Liga sem apresentar imagem.', 'video'),
    ('notebook', 'Não liga', 'nao_liga', 'Sem resposta ao botão power.', 'power'),
    ('notebook', 'Liga sem imagem', 'liga_sem_imagem', 'Atividade elétrica sem vídeo.', 'video'),
    ('notebook', 'Não carrega', 'nao_carrega', 'Bateria sem carga ou sem reconhecimento.', 'charge'),
    ('television', 'Liga com som sem imagem', 'liga_com_som_sem_imagem', 'Áudio normal com painel apagado.', 'video'),
    ('television', 'Reinicia', 'reinicia', 'Ciclo de reinício durante uso.', 'system'),
    ('television', 'Não liga', 'nao_liga', 'Sem resposta ao comando de ligar.', 'power'),
    ('smartphone', 'Não liga', 'nao_liga', 'Sem energização aparente.', 'power'),
    ('smartphone', 'Não carrega', 'nao_carrega', 'Falha na linha ou circuito de carga.', 'charge'),
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
    'Medição de tensão',
    'medicao_tensao',
    'electrical',
    'Leitura de tensão em ponto específico da placa.',
    'V'
  ),
  (
    'Teste de continuidade',
    'teste_continuidade',
    'electrical',
    'Verifica continuidade elétrica entre dois pontos.',
    'ohm'
  ),
  (
    'Regravação de BIOS',
    'regravacao_bios',
    'firmware',
    'Regrava firmware ou BIOS para validar corrupção.',
    null
  ),
  (
    'Substituição cruzada',
    'substituicao_cruzada',
    'replacement',
    'Troca temporária por componente ou placa sabidamente funcional.',
    null
  ),
  (
    'Teste com fonte assimétrica',
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
  ('Prioridade alta', 'prioridade_alta', 'diagnostic_priority', 'Casos com urgência operacional.'),
  ('Dano líquido', 'dano_liquido', 'failure_context', 'Presença de oxidação ou contato com líquido.'),
  ('Sem imagem', 'sem_imagem', 'symptom_hint', 'Falha recorrente de vídeo ou painel.')
on conflict (slug, tag_group) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = timezone('utc', now());
