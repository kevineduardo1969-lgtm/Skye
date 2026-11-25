-- Skye · Fase 6.1: retos propios de docentes por grupo.

create table if not exists public.teacher_challenges (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 100),
  status text not null default 'draft' check (status in ('draft', 'published')),
  module_id text not null check (char_length(trim(module_id)) between 1 and 80),
  skill text not null check (char_length(trim(skill)) between 2 and 120),
  difficulty text not null check (difficulty in ('inicio', 'práctica', 'desafío')),
  interaction_type text not null check (interaction_type in ('multiple-choice', 'numeric', 'multi-select', 'order')),
  prompt text not null check (char_length(trim(prompt)) between 5 and 600),
  options jsonb not null default '[]'::jsonb,
  answer jsonb not null,
  data jsonb not null default '{}'::jsonb,
  hint text not null check (char_length(trim(hint)) between 3 and 400),
  explanation text not null check (char_length(trim(explanation)) between 3 and 600),
  stars integer not null default 3 check (stars between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_challenge_options_array check (jsonb_typeof(options) = 'array'),
  constraint teacher_challenge_answer_valid check (jsonb_typeof(answer) in ('string', 'array', 'number')),
  constraint teacher_challenge_data_object check (jsonb_typeof(data) = 'object')
);

create index if not exists teacher_challenges_teacher_idx on public.teacher_challenges(teacher_id, created_at desc);
create index if not exists teacher_challenges_group_status_idx on public.teacher_challenges(group_id, status);

alter table public.teacher_challenges enable row level security;
revoke all on public.teacher_challenges from anon;
revoke all on public.teacher_challenges from authenticated;
grant select, insert, update, delete on public.teacher_challenges to authenticated;

create or replace function public.touch_teacher_challenge()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists teacher_challenges_updated_at on public.teacher_challenges;
create trigger teacher_challenges_updated_at
before update on public.teacher_challenges
for each row execute function public.touch_teacher_challenge();

drop policy if exists "teachers manage own challenges" on public.teacher_challenges;
create policy "teachers manage own challenges" on public.teacher_challenges
for all to authenticated
using (
  teacher_id = (select auth.uid())
  and (select public.is_teacher())
  and exists (
    select 1 from public.groups
    where groups.id = teacher_challenges.group_id
      and groups.teacher_id = (select auth.uid())
  )
)
with check (
  teacher_id = (select auth.uid())
  and (select public.is_teacher())
  and exists (
    select 1 from public.groups
    where groups.id = teacher_challenges.group_id
      and groups.teacher_id = (select auth.uid())
  )
);

drop policy if exists "students read published group challenges" on public.teacher_challenges;
create policy "students read published group challenges" on public.teacher_challenges
for select to authenticated
using (
  status = 'published'
  and exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'estudiante'
      and profiles.group_id = teacher_challenges.group_id
  )
);

