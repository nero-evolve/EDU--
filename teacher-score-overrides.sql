-- Run this migration in Supabase SQL Editor after the existing supabase.sql is installed.
-- Adds teacher-only score overrides while preserving the automatic checkpoint score.
create table if not exists public.teacher_score_overrides (
 class_id uuid not null references public.classes(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade,
 teacher_id uuid not null default auth.uid() references public.profiles(id),
 score numeric(5,2) not null check (score >= 0 and score <= 100),
 updated_at timestamptz not null default now(),
 primary key (class_id, student_id)
);
alter table public.teacher_score_overrides enable row level security;
revoke all on public.teacher_score_overrides from anon, authenticated;
drop policy if exists teacher_score_override_read on public.teacher_score_overrides;
create policy teacher_score_override_read on public.teacher_score_overrides for select to authenticated using (public.is_teacher_of(class_id));

create or replace function public.set_teacher_score(target_student uuid, target_class uuid, requested_score numeric)
returns void language plpgsql security definer set search_path=public as $$
begin
 if coalesce((select role from profiles where id=auth.uid()),'') <> 'teacher' or not is_teacher_of(target_class) then
  raise exception 'teacher only';
 end if;
 if not exists(select 1 from class_members where class_id=target_class and student_id=target_student) then
  raise exception 'student is not in this class';
 end if;
 if requested_score is null then
  delete from teacher_score_overrides where class_id=target_class and student_id=target_student;
  return;
 end if;
 if requested_score < 0 or requested_score > 100 then raise exception 'score must be from 0 to 100'; end if;
 insert into teacher_score_overrides(class_id,student_id,teacher_id,score,updated_at)
 values(target_class,target_student,auth.uid(),requested_score,now())
 on conflict(class_id,student_id) do update set teacher_id=excluded.teacher_id,score=excluded.score,updated_at=excluded.updated_at;
end;
$$;

drop function if exists public.teacher_class_progress(uuid);
create function public.teacher_class_progress(target_class uuid)
returns table(student_id uuid,display_name text,state jsonb,updated_at timestamptz,teacher_comment text,teacher_score numeric)
language plpgsql stable security definer set search_path=public as $$
begin
 if not is_teacher_of(target_class) then raise exception 'teacher only'; end if;
 return query
 select p.id,p.display_name,g.state,g.updated_at,c.body,o.score
 from class_members m join profiles p on p.id=m.student_id
 left join progress g on g.student_id=p.id
 left join teacher_comments c on c.student_id=p.id and c.class_id=target_class
 left join teacher_score_overrides o on o.student_id=p.id and o.class_id=target_class
 where m.class_id=target_class order by p.display_name;
end;
$$;
revoke all on function public.set_teacher_score(uuid,uuid,numeric),public.teacher_class_progress(uuid) from public,anon;
grant execute on function public.set_teacher_score(uuid,uuid,numeric),public.teacher_class_progress(uuid) to authenticated;
