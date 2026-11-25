-- Skye · Fase 7.2: auditoría mínima de borradores generados por IA.
-- No se guarda el contenido extraído del archivo ni las respuestas de estudiantes.

create table if not exists public.ai_challenge_generations (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  source_path text not null check (char_length(source_path) between 3 and 400),
  source_name text not null check (char_length(source_name) between 1 and 180),
  status text not null default 'processing' check (status in ('processing', 'completed', 'error')),
  proposal_count integer not null default 0 check (proposal_count between 0 and 5),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_challenge_generations_teacher_created_idx
  on public.ai_challenge_generations(teacher_id, created_at desc);

alter table public.ai_challenge_generations enable row level security;
revoke all on public.ai_challenge_generations from anon;
revoke all on public.ai_challenge_generations from authenticated;
grant select on public.ai_challenge_generations to authenticated;

drop policy if exists "teachers read own ai generation metadata" on public.ai_challenge_generations;
create policy "teachers read own ai generation metadata"
on public.ai_challenge_generations for select to authenticated
using (teacher_id = (select auth.uid()) and (select public.is_teacher()));

