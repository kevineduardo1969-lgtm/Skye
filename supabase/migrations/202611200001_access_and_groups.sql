-- Skye · Fase 1: acceso seguro, grupos y códigos sin datos personales de menores.
-- Ejecuta este archivo en Supabase SQL Editor o con Supabase CLI.

create extension if not exists pgcrypto;

do $$ begin
  create type public.skye_role as enum ('estudiante', 'docente');
exception when duplicate_object then null;
end $$;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 60),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.skye_role not null,
  nickname text check (nickname is null or char_length(trim(nickname)) between 2 and 18),
  group_id uuid references public.groups(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_profile_requires_nickname check (
    (role = 'docente' and nickname is null and group_id is null)
    or (role = 'estudiante' and nickname is not null and group_id is not null)
  )
);

create table if not exists public.student_codes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9-]{6,12}$'),
  claimed_by uuid unique references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists groups_teacher_id_idx on public.groups(teacher_id);
create index if not exists profiles_group_id_idx on public.profiles(group_id);
create index if not exists student_codes_group_id_idx on public.student_codes(group_id);

alter table public.groups enable row level security;
alter table public.profiles enable row level security;
alter table public.student_codes enable row level security;

revoke all on public.groups, public.profiles, public.student_codes from anon;
revoke all on public.groups, public.profiles, public.student_codes from authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.student_codes to authenticated;

-- Esta función evita políticas recursivas: no se expone como lectura libre de perfiles.
create or replace function public.is_teacher()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'docente'
  );
$$;

create or replace function public.bootstrap_teacher_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Solo una cuenta docente puede crear este perfil';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid() and role = 'estudiante') then
    raise exception 'Esta sesión ya está asociada a un perfil de estudiante';
  end if;

  insert into public.profiles (id, role)
  values (auth.uid(), 'docente')
  on conflict (id) do nothing;
end;
$$;

create or replace function public.claim_student_profile(p_code text, p_nickname text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_group uuid;
  code_owner uuid;
  existing_group uuid;
  normalized_code text := upper(trim(p_code));
  normalized_nickname text := trim(p_nickname);
begin
  if auth.uid() is null or not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'El acceso de estudiante requiere una sesión de estudiante';
  end if;

  if normalized_code !~ '^[A-Z0-9-]{6,12}$' or char_length(normalized_nickname) not between 2 and 18 or normalized_nickname ~* '@|https?://|www\\.' then
    raise exception 'Datos de acceso no válidos';
  end if;

  select group_id, claimed_by into selected_group, code_owner
  from public.student_codes where code = normalized_code;

  if selected_group is null or (code_owner is not null and code_owner <> auth.uid()) then
    raise exception 'Código no disponible';
  end if;

  select group_id into existing_group from public.profiles where id = auth.uid();
  if existing_group is not null and existing_group <> selected_group then
    raise exception 'Esta sesión ya tiene un código asignado';
  end if;

  update public.student_codes
  set claimed_by = auth.uid(), claimed_at = coalesce(claimed_at, now())
  where code = normalized_code and (claimed_by is null or claimed_by = auth.uid());

  insert into public.profiles (id, role, nickname, group_id)
  values (auth.uid(), 'estudiante', normalized_nickname, selected_group)
  on conflict (id) do update
    set nickname = excluded.nickname, updated_at = now()
    where public.profiles.role = 'estudiante';
end;
$$;

revoke all on function public.is_teacher() from public;
revoke all on function public.bootstrap_teacher_profile() from public;
revoke all on function public.claim_student_profile(text, text) from public;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.bootstrap_teacher_profile() to authenticated;
grant execute on function public.claim_student_profile(text, text) to authenticated;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles
for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "teachers manage their groups" on public.groups;
create policy "teachers manage their groups" on public.groups
for all to authenticated
using ((select public.is_teacher()) and teacher_id = (select auth.uid()))
with check ((select public.is_teacher()) and teacher_id = (select auth.uid()));

drop policy if exists "students read assigned group" on public.groups;
create policy "students read assigned group" on public.groups
for select to authenticated
using (id = (select group_id from public.profiles where id = (select auth.uid())));

drop policy if exists "teachers manage codes in own groups" on public.student_codes;
create policy "teachers manage codes in own groups" on public.student_codes
for all to authenticated
using (exists (select 1 from public.groups where groups.id = student_codes.group_id and groups.teacher_id = (select auth.uid())))
with check (exists (select 1 from public.groups where groups.id = student_codes.group_id and groups.teacher_id = (select auth.uid())));
