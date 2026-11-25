-- Skye · Fase 6.5: materiales privados de docentes para futuros borradores con IA.
-- El bucket es privado. Los archivos se guardan bajo: <auth.uid>/<archivo>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'teacher-materials',
  'teacher-materials',
  false,
  5242880,
  array[
    'text/plain',
    'text/csv',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "teachers upload own private materials" on storage.objects;
create policy "teachers upload own private materials"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'teacher-materials'
  and (select public.is_teacher())
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "teachers read own private materials" on storage.objects;
create policy "teachers read own private materials"
on storage.objects for select to authenticated
using (
  bucket_id = 'teacher-materials'
  and (select public.is_teacher())
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "teachers update own private materials" on storage.objects;
create policy "teachers update own private materials"
on storage.objects for update to authenticated
using (
  bucket_id = 'teacher-materials'
  and (select public.is_teacher())
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'teacher-materials'
  and (select public.is_teacher())
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "teachers delete own private materials" on storage.objects;
create policy "teachers delete own private materials"
on storage.objects for delete to authenticated
using (
  bucket_id = 'teacher-materials'
  and (select public.is_teacher())
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

