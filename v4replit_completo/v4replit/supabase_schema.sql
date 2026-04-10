-- ============================================================
-- V4 Company · Financeiro CAF · Schema Supabase
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Tabela principal de chamados
create table if not exists chamados (
  id               bigserial primary key,
  ticket_id        text not null,
  titulo           text,
  descricao        text,
  etiqueta         text,
  unidade          text,
  usuario_afetado  text,
  especialista     text,
  acoes            text,
  categoria        text,
  subcategoria     text,
  prioridade       text,
  status_interno   text default 'nao_iniciado',
  criado_em        timestamptz,
  entrou_financeiro timestamptz,
  dias_na_fila     numeric,
  upload_date      date not null,
  created_at       timestamptz default now()
);

-- Índices para performance
create index if not exists idx_chamados_ticket_id    on chamados(ticket_id);
create index if not exists idx_chamados_upload_date  on chamados(upload_date);
create index if not exists idx_chamados_categoria    on chamados(categoria);
create index if not exists idx_chamados_prioridade   on chamados(prioridade);

-- Tabela de snapshots diários (foto do dia)
create table if not exists snapshots (
  id               bigserial primary key,
  upload_date      date not null unique,
  total_chamados   int,
  p1_urgentes      int,
  fora_sla         int,
  dentro_sla       int,
  pct_fora_sla     numeric,
  media_dias       numeric,
  max_dias         numeric,
  total_reembolso  int,
  total_repasse    int,
  total_nf_antecipada int,
  total_emissao_nf int,
  total_cancelamento_nf int,
  total_ajuste_nf  int,
  total_finance    int,
  total_reembolso_cliente int,
  total_analise_manual int,
  created_at       timestamptz default now()
);

-- Tabela de histórico de mudanças por ticket
create table if not exists historico_chamados (
  id               bigserial primary key,
  ticket_id        text not null,
  upload_date      date not null,
  dias_na_fila     numeric,
  categoria        text,
  prioridade       text,
  status_interno   text,
  especialista     text,
  acoes            text,
  created_at       timestamptz default now()
);

create index if not exists idx_historico_ticket_id   on historico_chamados(ticket_id);
create index if not exists idx_historico_upload_date on historico_chamados(upload_date);

-- View: comparativo último vs penúltimo upload
create or replace view comparativo_dias as
select
  a.upload_date as hoje,
  b.upload_date as ontem,
  a.total_chamados as total_hoje,
  b.total_chamados as total_ontem,
  (a.total_chamados - b.total_chamados) as variacao_total,
  a.fora_sla as fora_sla_hoje,
  b.fora_sla as fora_sla_ontem,
  (a.fora_sla - b.fora_sla) as variacao_sla,
  a.p1_urgentes as p1_hoje,
  b.p1_urgentes as p1_ontem,
  (a.p1_urgentes - b.p1_urgentes) as variacao_p1
from snapshots a
join snapshots b on b.upload_date = (
  select max(upload_date) from snapshots where upload_date < a.upload_date
)
where a.upload_date = (select max(upload_date) from snapshots);

-- Habilitar RLS (Row Level Security) — acesso público por enquanto
alter table chamados          enable row level security;
alter table snapshots         enable row level security;
alter table historico_chamados enable row level security;

create policy "Allow all" on chamados          for all using (true) with check (true);
create policy "Allow all" on snapshots         for all using (true) with check (true);
create policy "Allow all" on historico_chamados for all using (true) with check (true);
