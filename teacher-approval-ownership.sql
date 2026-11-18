-- Teacher registration approval and teacher-owned edit permissions.
-- Run after supabase.sql, system-platforms-progress.sql, and teaching-materials.sql.

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_applications (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  institution text not null default '',
  note text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

alter table public.site_admins enable row level security;
alter table public.teacher_applications enable row level security;
revoke all on public.site_admins, public.teacher_applications from anon, authenticated;
grant select on public.teacher_applications to authenticated;

create or replace function public.is_approved_teacher()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher') $$;

create or replace function public.is_site_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.site_admins a where a.user_id=auth.uid()) $$;

revoke all on function public.is_approved_teacher(), public.is_site_admin() from public, anon;
grant execute on function public.is_approved_teacher(), public.is_site_admin() to authenticated;

drop policy if exists teacher_applications_read_self_or_admin on public.teacher_applications;
create policy teacher_applications_read_self_or_admin
  on public.teacher_applications for select to authenticated
  using (user_id=auth.uid() or public.is_site_admin());

create or replace function public.bootstrap_profile()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id,coalesce(new.raw_user_meta_data->>'display_name',''))
  on conflict(id) do nothing;

  if coalesce(new.raw_user_meta_data->>'teacher_application','false')='true' then
    insert into public.teacher_applications(user_id,institution,note)
    values(
      new.id,
      left(trim(coalesce(new.raw_user_meta_data->>'institution','')),120),
      left(trim(coalesce(new.raw_user_meta_data->>'application_note','')),1000)
    ) on conflict(user_id) do nothing;
  end if;
  return new;
end $$;

create or replace function public.teacher_application_status()
returns text language sql stable security definer set search_path=public
as $$ select coalesce((select a.status from public.teacher_applications a where a.user_id=auth.uid()),'none') $$;

create or replace function public.admin_teacher_applications()
returns table(user_id uuid,display_name text,email text,institution text,note text,status text,submitted_at timestamptz,email_confirmed boolean)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.is_site_admin() then raise exception 'admin only'; end if;
  return query
    select a.user_id,p.display_name,u.email,a.institution,a.note,a.status,a.submitted_at,(u.email_confirmed_at is not null)
    from public.teacher_applications a
    join public.profiles p on p.id=a.user_id
    join auth.users u on u.id=a.user_id
    order by (a.status='pending') desc,a.submitted_at desc;
end $$;

create or replace function public.review_teacher_application(target_user uuid,approve boolean)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_site_admin() then raise exception 'admin only'; end if;
  update public.teacher_applications
    set status=case when approve then 'approved' else 'rejected' end,
        reviewed_at=now(),reviewed_by=auth.uid()
    where user_id=target_user and status='pending';
  if not found then raise exception 'pending application not found'; end if;
  update public.profiles set role=case when approve then 'teacher' else 'student' end where id=target_user;
end $$;

revoke all on function public.teacher_application_status(),public.admin_teacher_applications(),public.review_teacher_application(uuid,boolean) from public,anon;
grant execute on function public.teacher_application_status(),public.admin_teacher_applications(),public.review_teacher_application(uuid,boolean) to authenticated;

-- One-time setup: replace the address with the existing Supabase login email
-- for the site owner, then run this insert. Do not make this callable by users.
with owner as (
  select u.id from auth.users u where lower(u.email)=lower('REPLACE_WITH_SITE_OWNER_LOGIN_EMAIL')
), promote_owner as (
  update public.profiles p set role='teacher' from owner o where p.id=o.id
  returning p.id
)
insert into public.site_admins(user_id)
select id from promote_owner
on conflict(user_id) do nothing;

-- Approved teachers can see all classes through a safe RPC (without invitation codes).
drop policy if exists class_read_member on public.classes;
create policy class_read_member on public.classes for select to authenticated
  using (teacher_id=auth.uid() or exists(
    select 1 from public.class_members m where m.class_id=classes.id and m.student_id=auth.uid()
  ));

drop policy if exists member_read_self_or_teacher on public.class_members;
create policy member_read_self_or_teacher on public.class_members for select to authenticated
  using (student_id=auth.uid() or public.is_teacher_of(class_id));

create or replace function public.teacher_visible_classes()
returns table(id uuid,name text,class_code text,teacher_id uuid,created_at timestamptz)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.is_approved_teacher() then raise exception 'approved teacher only'; end if;
  return query select c.id,c.name,c.class_code,c.teacher_id,c.created_at from public.classes c order by c.created_at;
end $$;

-- The earlier version has a different return row type; PostgreSQL requires a drop first.
drop function if exists public.teacher_class_progress(uuid);
create function public.teacher_class_progress(target_class uuid)
returns table(student_id uuid,display_name text,state jsonb,updated_at timestamptz,teacher_comment text)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.is_approved_teacher() then raise exception 'approved teacher only'; end if;
  return query
    select p.id,p.display_name,g.state,g.updated_at,c.body
    from public.class_members m
    join public.profiles p on p.id=m.student_id
    left join public.progress g on g.student_id=p.id
    left join public.teacher_comments c on c.student_id=p.id and c.class_id=target_class and c.teacher_id=auth.uid()
    where m.class_id=target_class
    order by p.display_name;
end $$;

create or replace function public.teacher_course_progress(target_class uuid,target_course text)
returns table(student_id uuid,display_name text,state jsonb,updated_at timestamptz)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.is_approved_teacher() then raise exception 'approved teacher only'; end if;
  if target_course not in ('system-platforms') then raise exception 'unsupported course'; end if;
  return query
    select p.id,p.display_name,cp.state,cp.updated_at
    from public.class_members m
    join public.profiles p on p.id=m.student_id
    left join public.course_progress cp on cp.student_id=p.id and cp.course_slug=target_course
    where m.class_id=target_class
    order by p.display_name;
end $$;

-- Resource metadata is readable by approved teachers, but write access belongs to its uploader.
drop policy if exists teaching_materials_teacher_read on public.teaching_materials;
create policy teaching_materials_teacher_read on public.teaching_materials for select to authenticated
  using (public.is_approved_teacher());

drop policy if exists teaching_materials_teacher_insert on public.teaching_materials;
create policy teaching_materials_teacher_insert on public.teaching_materials for insert to authenticated
  with check (created_by=auth.uid() and public.is_approved_teacher());

drop policy if exists teaching_materials_teacher_update on public.teaching_materials;
create policy teaching_materials_teacher_update on public.teaching_materials for update to authenticated
  using (created_by=auth.uid() and public.is_approved_teacher())
  with check (created_by=auth.uid() and public.is_approved_teacher());

drop policy if exists teaching_materials_teacher_delete on public.teaching_materials;
create policy teaching_materials_teacher_delete on public.teaching_materials for delete to authenticated
  using (created_by=auth.uid() and public.is_approved_teacher());

-- Upload paths already use <auth.uid()>/<random filename>; enforce that ownership in Storage too.
drop policy if exists teaching_materials_teacher_upload on storage.objects;
create policy teaching_materials_teacher_upload on storage.objects for insert to authenticated
  with check (
    bucket_id in ('learning-materials','teacher-materials')
    and (storage.foldername(name))[1]=auth.uid()::text
    and public.is_approved_teacher()
  );

drop policy if exists teaching_materials_teacher_update_files on storage.objects;
create policy teaching_materials_teacher_update_files on storage.objects for update to authenticated
  using (
    bucket_id in ('learning-materials','teacher-materials')
    and (storage.foldername(name))[1]=auth.uid()::text
    and public.is_approved_teacher()
  )
  with check (
    bucket_id in ('learning-materials','teacher-materials')
    and (storage.foldername(name))[1]=auth.uid()::text
    and public.is_approved_teacher()
  );

drop policy if exists teaching_materials_teacher_delete_files on storage.objects;
create policy teaching_materials_teacher_delete_files on storage.objects for delete to authenticated
  using (
    bucket_id in ('learning-materials','teacher-materials')
    and (storage.foldername(name))[1]=auth.uid()::text
    and public.is_approved_teacher()
  );

drop policy if exists teaching_materials_teacher_read_private_files on storage.objects;
create policy teaching_materials_teacher_read_private_files on storage.objects for select to authenticated
  using (bucket_id='teacher-materials' and public.is_approved_teacher());

revoke all on function public.teacher_visible_classes(),public.teacher_class_progress(uuid),public.teacher_course_progress(uuid,text) from public,anon;
grant execute on function public.teacher_visible_classes(),public.teacher_class_progress(uuid),public.teacher_course_progress(uuid,text) to authenticated;
