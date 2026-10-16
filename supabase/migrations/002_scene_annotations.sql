-- 002: Persist authored structural walls and clearly unverified hazard notes atomically.
-- Additive schema migration. Existing assessments receive [] by default.
-- Does not affect production unless explicitly applied through migration tooling.
begin;
alter table public.scenes
  add column if not exists hazards jsonb not null default '[]'::jsonb;

-- Replace the old function signature instead of leaving a potentially ambiguous
-- PostgREST overload. The new two parameters have defaults for older callers.
drop function if exists public.save_assessment_bundle(uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb);

create or replace function public.save_assessment_bundle(
  p_assessment_id uuid,
  p_name text,
  p_facility text default '',
  p_space text default '',
  p_environment text default 'residential',
  p_notes text default '',
  p_boundary jsonb default '[]'::jsonb,
  p_furniture jsonb default '[]'::jsonb,
  p_calibration jsonb default null,
  p_mobility jsonb default null,
  p_route jsonb default null,
  p_walls jsonb default '[]'::jsonb,
  p_hazards jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_owner uuid;
begin
  -- 1. Enforce verified non-null database identity
  if v_auth_uid is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized: missing authenticated database identity');
  end if;

  -- 2. Lock assessment row for update and enforce exact ownership
  select user_id into v_owner
  from public.assessments
  where id = p_assessment_id
  for update;

  if v_owner is null then
    return jsonb_build_object('success', false, 'error', 'Assessment not found');
  end if;

  if v_owner <> v_auth_uid then
    return jsonb_build_object('success', false, 'error', 'Unauthorized: access denied to foreign assessment');
  end if;

  -- 3. Update assessment record
  update public.assessments
  set name = p_name,
      facility_name = coalesce(p_facility, ''),
      space_name = coalesce(p_space, ''),
      environment_type = coalesce(p_environment, 'residential'),
      notes = coalesce(p_notes, ''),
      updated_at = now()
  where id = p_assessment_id;

  -- 4. Atomic scene upsert (user-authored walls and observations included).
  if jsonb_typeof(coalesce(p_walls, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_hazards, '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('success', false, 'error', 'Malformed scene annotations');
  end if;
  insert into public.scenes (assessment_id, boundary, furniture, walls, hazards, updated_at)
  values (p_assessment_id, coalesce(p_boundary, '[]'::jsonb),
          coalesce(p_furniture, '[]'::jsonb), coalesce(p_walls, '[]'::jsonb),
          coalesce(p_hazards, '[]'::jsonb), now())
  on conflict (assessment_id) do update set
    boundary = excluded.boundary,
    furniture = excluded.furniture,
    walls = excluded.walls,
    hazards = excluded.hazards,
    updated_at = now();

  -- 5. Upsert calibration if provided
  if p_calibration is not null and (p_calibration->>'pixels_per_meter') is not null then
    insert into public.calibrations (
      assessment_id,
      pixels_per_meter,
      raw_distance_px,
      reference_distance_m
    )
    values (
      p_assessment_id,
      (p_calibration->>'pixels_per_meter')::double precision,
      (p_calibration->>'raw_distance_px')::double precision,
      (p_calibration->>'reference_distance_m')::double precision
    )
    on conflict (assessment_id) do update set
      pixels_per_meter = excluded.pixels_per_meter,
      raw_distance_px = excluded.raw_distance_px,
      reference_distance_m = excluded.reference_distance_m;
  end if;

  -- 6. Upsert mobility config if provided
  if p_mobility is not null and (p_mobility->>'turning_space_cm') is not null then
    insert into public.mobility_configs (
      assessment_id,
      profile,
      turning_space_cm,
      passage_width_cm,
      walker_width_cm,
      clearance_tolerance_cm,
      bed_side_access_cm,
      door_threshold_max_cm,
      reach_range_low_cm,
      reach_range_high_cm,
      notes
    )
    values (
      p_assessment_id,
      coalesce(p_mobility->>'profile', 'manual-wheelchair'),
      (p_mobility->>'turning_space_cm')::integer,
      (p_mobility->>'passage_width_cm')::integer,
      (p_mobility->>'walker_width_cm')::integer,
      coalesce((p_mobility->>'clearance_tolerance_cm')::integer, 0),
      coalesce((p_mobility->>'bed_side_access_cm')::integer, 0),
      coalesce((p_mobility->>'door_threshold_max_cm')::double precision, 0),
      coalesce((p_mobility->>'reach_range_low_cm')::integer, 0),
      coalesce((p_mobility->>'reach_range_high_cm')::integer, 0),
      coalesce(p_mobility->>'notes', '')
    )
    on conflict (assessment_id) do update set
      profile = excluded.profile,
      turning_space_cm = excluded.turning_space_cm,
      passage_width_cm = excluded.passage_width_cm,
      walker_width_cm = excluded.walker_width_cm,
      clearance_tolerance_cm = excluded.clearance_tolerance_cm,
      bed_side_access_cm = excluded.bed_side_access_cm,
      door_threshold_max_cm = excluded.door_threshold_max_cm,
      reach_range_low_cm = excluded.reach_range_low_cm,
      reach_range_high_cm = excluded.reach_range_high_cm,
      notes = excluded.notes;
  end if;

  -- 7. Upsert route checkpoints if provided
  if p_route is not null and (p_route->'checkpoints') is not null then
    insert into public.routes (
      assessment_id,
      name,
      checkpoints,
      updated_at
    )
    values (
      p_assessment_id,
      coalesce(p_route->>'name', 'Primary Route'),
      coalesce(p_route->'checkpoints', '[]'::jsonb),
      now()
    )
    on conflict (assessment_id) do update set
      name = excluded.name,
      checkpoints = excluded.checkpoints,
      updated_at = now();
  end if;

  return jsonb_build_object('success', true);
exception
  when others then
    return jsonb_build_object('success', false, 'error', SQLERRM);
end;
$$;

revoke execute on function public.save_assessment_bundle(uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_assessment_bundle(uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  to authenticated, service_role;
commit;
