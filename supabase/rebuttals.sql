-- Run in Supabase SQL Editor
create table if not exists public.rebuttals (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reason_index smallint not null check (reason_index in (1, 2, 3)),
  nickname text not null,
  claim text not null,
  reason1 text not null,
  reason2 text not null,
  reason3 text not null,
  created_at timestamptz not null default now(),
  unique (post_id, reason_index, nickname)
);

create index if not exists rebuttals_post_id_idx on public.rebuttals (post_id);

-- MVP: posts/topics と同様、anon から insert/select 可能にする
-- （既存テーブルの RLS 方針に合わせて調整すること）
alter table public.rebuttals enable row level security;

create policy "Allow anon select rebuttals"
  on public.rebuttals for select
  to anon, authenticated
  using (true);

create policy "Allow anon insert rebuttals"
  on public.rebuttals for insert
  to anon, authenticated
  with check (true);
