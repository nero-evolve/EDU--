-- Run once in Supabase SQL Editor.
-- Removes selected students from one class roster only. Accounts and progress remain.
create or replace function public.remove_students_from_class(
  target_class uuid,
  target_students uuid[]
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_count integer;
begin
  if not is_teacher_of(target_class) then
    raise exception 'teacher only';
  end if;
  if target_students is null or cardinality(target_students) = 0 then
    raise exception 'select at least one student';
  end if;

  delete from public.class_members
  where class_id = target_class
    and student_id = any(target_students);
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

revoke all on function public.remove_students_from_class(uuid, uuid[]) from public, anon;
grant execute on function public.remove_students_from_class(uuid, uuid[]) to authenticated;
