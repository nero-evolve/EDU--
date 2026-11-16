-- Run once in Supabase SQL Editor to enable the teaching materials portal.
-- Students can list and download published student resources only.
-- Teachers can upload, edit, download, publish, and delete resources.

create table if not exists public.teaching_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  grade smallint not null check (grade in (7, 8, 9)),
  subject text not null check (length(trim(subject)) between 1 and 60),
  unit text not null default '',
  resource_type text not null default 'lesson'
    check (resource_type in ('worksheet','lesson','slides','video','image','other')),
  description text not null default '',
  audience text not null default 'student' check (audience in ('student','teacher')),
  is_published boolean not null default true,
  storage_bucket text not null check (storage_bucket in ('learning-materials','teacher-materials')),
  check ((audience = 'student' and is_published = true and storage_bucket = 'learning-materials') or (storage_bucket = 'teacher-materials' and (audience = 'teacher' or is_published = false))),
  storage_path text not null,
  original_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teaching_materials_student_browse
  on public.teaching_materials (grade, subject, title)
  where audience = 'student' and is_published = true;

alter table public.teaching_materials enable row level security;
grant select on public.teaching_materials to anon, authenticated;
grant insert, update, delete on public.teaching_materials to authenticated;

drop policy if exists teaching_materials_student_read on public.teaching_materials;
create policy teaching_materials_student_read
  on public.teaching_materials for select to anon, authenticated
  using (audience = 'student' and is_published = true);

drop policy if exists teaching_materials_teacher_read on public.teaching_materials;
create policy teaching_materials_teacher_read
  on public.teaching_materials for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));

drop policy if exists teaching_materials_teacher_insert on public.teaching_materials;
create policy teaching_materials_teacher_insert
  on public.teaching_materials for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));

drop policy if exists teaching_materials_teacher_update on public.teaching_materials;
create policy teaching_materials_teacher_update
  on public.teaching_materials for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'))
  with check (created_by = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));

drop policy if exists teaching_materials_teacher_delete on public.teaching_materials;
create policy teaching_materials_teacher_delete
  on public.teaching_materials for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('learning-materials', 'learning-materials', true, 52428800,
   array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','text/csv','image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/wav','audio/mp4','video/mp4','video/webm','application/zip','application/x-zip-compressed']),
  ('teacher-materials', 'teacher-materials', false, 52428800,
   array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','text/csv','image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/wav','audio/mp4','video/mp4','video/webm','application/zip','application/x-zip-compressed'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists teaching_materials_teacher_upload on storage.objects;
create policy teaching_materials_teacher_upload
  on storage.objects for insert to authenticated
  with check (bucket_id in ('learning-materials','teacher-materials') and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));

drop policy if exists teaching_materials_teacher_update_files on storage.objects;
create policy teaching_materials_teacher_update_files
  on storage.objects for update to authenticated
  using (bucket_id in ('learning-materials','teacher-materials') and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'))
  with check (bucket_id in ('learning-materials','teacher-materials') and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));

drop policy if exists teaching_materials_teacher_delete_files on storage.objects;
create policy teaching_materials_teacher_delete_files
  on storage.objects for delete to authenticated
  using (bucket_id in ('learning-materials','teacher-materials') and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));

drop policy if exists teaching_materials_teacher_read_private_files on storage.objects;
create policy teaching_materials_teacher_read_private_files
  on storage.objects for select to authenticated
  using (bucket_id = 'teacher-materials' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));
