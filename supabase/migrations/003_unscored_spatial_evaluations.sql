-- 003: Remove fabricated score requirement from deterministic spatial evaluations.
-- A 2D clearance engine does not produce a validated clinical 0–100 fall-risk score.
begin;
alter table public.evaluations alter column score drop not null;
comment on column public.evaluations.score is
  'Nullable legacy column. Do not populate without a separately validated and explicitly defined scoring model.';
commit;
