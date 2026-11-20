-- Skye · Fase 2: evidencias de aprendizaje sin datos personales sensibles.
-- Cada fila registra un momento del proceso: inicio, práctica o resolución.

create table if not exists public.learning_evidence (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  exercise_id text not null check (char_length(exercise_id) between 1 and 80),
  module_id text not null check (char_length(module_id) between 1 and 80),
  skill text not null check (char_length(skill) between 1 and 120),
  status text not null check (status in ('iniciado', 'practicando', 'resuelto')),
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 999),
  hints_used integer not null default 0 check (hints_used >= 0 and hints_used <= 999),
  stars_earned integer not null default 0 check (stars_earned >= 0 and stars_earned <= 20),
  response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists learning_evidence_student_created_idx
  on public.learning_evidence(student_id, created_at desc);
create index if not exists learning_evidence_group_created_idx
  on public.learning_evidence(group_id, created_at desc);
create index if not exists learning_evidence_exercise_idx
  on public.learning_evidence(student_id, exercise_id);

alter table public.learning_evidence enable row level security;
revoke all on public.learning_evidence from anon;
revoke all on public.learning_evidence from authenticated;
grant select on public.learning_evidence to authenticated;

-- El grupo y el estudiante se toman de la sesión, no del navegador.
create or replace function public.record_learning_evidence(
  p_exercise_id text,
  p_module_id text,
  p_skill text,
  p_status text,
  p_attempts integer default 0,
  p_hints_used integer default 0,
  p_stars_earned integer default 0,
  p_response jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  student_group uuid;
  evidence_id uuid;
begin
  select group_id into student_group
  from public.profiles
  where id = auth.uid() and role = 'estudiante';

  if auth.uid() is null or student_group is null then
    raise exception 'Solo un perfil de estudiante puede registrar evidencias';
  end if;

  if coalesce(char_length(trim(p_exercise_id)), 0) not between 1 and 80
    or coalesce(char_length(trim(p_module_id)), 0) not between 1 and 80
    or coalesce(char_length(trim(p_skill)), 0) not between 1 and 120
    or p_status not in ('iniciado', 'practicando', 'resuelto')
    or coalesce(p_attempts, -1) not between 0 and 999
    or coalesce(p_hints_used, -1) not between 0 and 999
    or coalesce(p_stars_earned, -1) not between 0 and 20
    or (p_response is not null and jsonb_typeof(p_response) not in ('object', 'array', 'string', 'number', 'boolean', 'null')) then
    raise exception 'La evidencia no tiene un formato válido';
  end if;

  insert into public.learning_evidence (
    student_id, group_id, exercise_id, module_id, skill, status,
    attempts, hints_used, stars_earned, response
  ) values (
    auth.uid(), student_group, trim(p_exercise_id), trim(p_module_id), trim(p_skill), p_status,
    p_attempts, p_hints_used, p_stars_earned, p_response
  ) returning id into evidence_id;

  return evidence_id;
end;
$$;

revoke all on function public.record_learning_evidence(text, text, text, text, integer, integer, integer, jsonb) from public;
grant execute on function public.record_learning_evidence(text, text, text, text, integer, integer, integer, jsonb) to authenticated;

drop policy if exists "students read own learning evidence" on public.learning_evidence;
create policy "students read own learning evidence" on public.learning_evidence
for select to authenticated
using (student_id = (select auth.uid()));

drop policy if exists "teachers read learning evidence from own groups" on public.learning_evidence;
create policy "teachers read learning evidence from own groups" on public.learning_evidence
for select to authenticated
using (exists (
  select 1 from public.groups
  where groups.id = learning_evidence.group_id
    and groups.teacher_id = (select auth.uid())
));
