-- Optional one-time reset before starting the new course with clean classes and records.
-- Removes class memberships, classes, student progress, and teacher comments.
-- Keeps Supabase Auth accounts and profiles so teachers can still sign in.
-- Run only in the intended project after confirming its data is only trial data.
begin;
delete from public.teacher_comments;
delete from public.progress;
delete from public.class_members;
delete from public.classes;
commit;
