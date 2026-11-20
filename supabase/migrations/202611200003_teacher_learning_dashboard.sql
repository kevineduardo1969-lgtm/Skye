-- Skye · Fase 4: consulta docente de evidencias por grupo.
-- Esta función devuelve únicamente apodo y código de estudiantes de grupos propios.
-- No expone correos, nombres completos ni otros datos privados.

create or replace function public.get_teacher_student_roster(p_group_id uuid default null)
returns table (
  student_id uuid,
  group_id uuid,
  group_name text,
  nickname text,
  student_code text,
  claimed_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    profile.id as student_id,
    classroom.id as group_id,
    classroom.name as group_name,
    profile.nickname,
    access_code.code as student_code,
    access_code.claimed_at
  from public.groups classroom
  join public.student_codes access_code on access_code.group_id = classroom.id
  join public.profiles profile
    on profile.id = access_code.claimed_by
    and profile.role = 'estudiante'
  where classroom.teacher_id = auth.uid()
    and (p_group_id is null or classroom.id = p_group_id)
  order by classroom.name, profile.nickname;
$$;

revoke all on function public.get_teacher_student_roster(uuid) from public;
grant execute on function public.get_teacher_student_roster(uuid) to authenticated;

-- La política existente "teachers read learning evidence from own groups" mantiene
-- la consulta de evidencias restringida a los grupos del docente autenticado.
