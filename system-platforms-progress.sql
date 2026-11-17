-- Run once in Supabase SQL Editor. Adds a separate progress record per course,
-- so system-platforms never overwrites the existing Bit Explorers record.
create table if not exists public.course_progress (
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_slug text not null,
  state jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, course_slug)
);

alter table public.course_progress enable row level security;
revoke all on public.course_progress from anon;
grant select, insert, update, delete on public.course_progress to authenticated;

drop policy if exists course_progress_read_self_or_teacher on public.course_progress;
create policy course_progress_read_self_or_teacher on public.course_progress
  for select to authenticated using (
    student_id = auth.uid()
    or exists (
      select 1 from public.class_members m
      join public.classes c on c.id = m.class_id
      where m.student_id = course_progress.student_id and c.teacher_id = auth.uid()
    )
  );

drop policy if exists course_progress_insert_self on public.course_progress;
create policy course_progress_insert_self on public.course_progress
  for insert to authenticated with check (
    student_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student')
  );

drop policy if exists course_progress_update_self on public.course_progress;
create policy course_progress_update_self on public.course_progress
  for update to authenticated using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student')
  );

drop policy if exists course_progress_delete_self on public.course_progress;
create policy course_progress_delete_self on public.course_progress
  for delete to authenticated using (student_id = auth.uid());

create or replace function public.save_course_progress(
  target_course text, payload jsonb, client_revision bigint, client_updated_at timestamptz
) returns void language plpgsql security definer set search_path = public as $$
begin
  if target_course <> 'system-platforms' then raise exception 'unsupported course'; end if;
  if coalesce((select role from profiles where id = auth.uid()), '') <> 'student' then
    raise exception 'student only';
  end if;
  insert into course_progress(student_id, course_slug, state, revision, updated_at)
  values (auth.uid(), target_course, payload, greatest(client_revision, 1), coalesce(client_updated_at, now()))
  on conflict (student_id, course_slug) do update
    set state = excluded.state, revision = excluded.revision, updated_at = excluded.updated_at
    where excluded.revision >= course_progress.revision;
end;
$$;

create or replace function public.delete_course_progress(target_course text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if target_course <> 'system-platforms' then raise exception 'unsupported course'; end if;
  if coalesce((select role from profiles where id = auth.uid()), '') <> 'student' then
    raise exception 'student only';
  end if;
  delete from course_progress where student_id = auth.uid() and course_slug = target_course;
end;
$$;

create or replace function public.teacher_course_progress(target_class uuid, target_course text)
returns table(student_id uuid, display_name text, state jsonb, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if target_course <> 'system-platforms' then raise exception 'unsupported course'; end if;
  if not public.is_teacher_of(target_class) then raise exception 'teacher only'; end if;
  return query
    select p.id, p.display_name, cp.state, cp.updated_at
    from class_members m
    join profiles p on p.id = m.student_id
    left join course_progress cp on cp.student_id = p.id and cp.course_slug = target_course
    where m.class_id = target_class
    order by p.display_name;
end;
$$;

drop function if exists public.course_class_leaderboard(uuid, text);
create function public.course_class_leaderboard(target_class uuid, target_course text)
returns table(student_id uuid, display_name text, score numeric, progress integer, completed boolean, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if target_course <> 'system-platforms' then raise exception 'unsupported course'; end if;
  if not public.is_teacher_of(target_class) and not exists (
    select 1 from public.class_members mine
    where mine.class_id = target_class and mine.student_id = auth.uid()
  ) then raise exception 'class member only'; end if;
  return query
    select p.id, p.display_name,
      coalesce((cp.state->>'score')::numeric, 0),
      coalesce((cp.state->>'progress')::integer, 0),
      coalesce((cp.state->>'completed')::boolean, false), cp.updated_at
    from class_members m
    join profiles p on p.id = m.student_id
    left join course_progress cp on cp.student_id = p.id and cp.course_slug = target_course
    where m.class_id = target_class
    order by 3 desc, cp.updated_at asc nulls last, p.display_name;
end;
$$;

revoke all on function public.save_course_progress(text,jsonb,bigint,timestamptz),
  public.delete_course_progress(text), public.teacher_course_progress(uuid,text),
  public.course_class_leaderboard(uuid,text) from public, anon;
grant execute on function public.save_course_progress(text,jsonb,bigint,timestamptz),
  public.delete_course_progress(text), public.teacher_course_progress(uuid,text),
  public.course_class_leaderboard(uuid,text) to authenticated;

-- Make PostgREST pick up the RPCs immediately for the course leaderboard.
notify pgrst, 'reload schema';
