-- SafeSpace Production Database Schema V1
-- PostgreSQL 15+ / Supabase with Row Level Security (RLS)

-- Extension requirements
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Safe Supabase Auth compatibility guard (only defined on standalone PostgreSQL without Supabase Auth)
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    create schema auth;
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      raw_user_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );
  end if;
  if not exists (select 1 from pg_proc join pg_namespace on pg_proc.pronamespace = pg_namespace.oid where proname = 'uid' and nspname = 'auth') then
    execute 'create function auth.uid() returns uuid as $uidfn$ select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid; $uidfn$ language sql stable;';
  end if;
end $$;

-- 1. User Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile trigger on auth.users insert
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Assessments
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null check (length(trim(name)) > 0),
  facility_name text default '' not null,
  space_name text default '' not null,
  environment_type text default 'residential' not null,
  notes text default '' not null,
  schema_version integer default 1 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_assessments_user_id on public.assessments(user_id);
create index if not exists idx_assessments_updated_at on public.assessments(updated_at desc);

alter table public.assessments enable row level security;

create policy "Users can select own assessments"
  on public.assessments for select
  using (auth.uid() = user_id);

create policy "Users can insert own assessments"
  on public.assessments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own assessments"
  on public.assessments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own assessments"
  on public.assessments for delete
  using (auth.uid() = user_id);

-- 3. Floorplan Assets (Private Media Reference)
create table if not exists public.floorplan_assets (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid unique references public.assessments(id) on delete cascade not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 52428800),
  image_width integer,
  image_height integer,
  created_at timestamptz default now() not null
);

create index if not exists idx_floorplan_assets_assessment_id on public.floorplan_assets(assessment_id);

alter table public.floorplan_assets enable row level security;

create policy "Users can manage assets of own assessments"
  on public.floorplan_assets for all
  using (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()));

-- 4. Calibrations
create table if not exists public.calibrations (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid unique references public.assessments(id) on delete cascade not null,
  pixels_per_meter double precision not null check (pixels_per_meter > 0),
  raw_distance_px double precision not null check (raw_distance_px > 0),
  reference_distance_m double precision not null check (reference_distance_m > 0),
  created_at timestamptz default now() not null
);

alter table public.calibrations enable row level security;

create policy "Users can manage calibrations of own assessments"
  on public.calibrations for all
  using (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()));

-- 5. Scenes (Boundary, Furniture, Walls, Doors, Windows)
create table if not exists public.scenes (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid unique references public.assessments(id) on delete cascade not null,
  boundary jsonb not null,
  furniture jsonb not null default '[]'::jsonb,
  walls jsonb not null default '[]'::jsonb,
  doors jsonb not null default '[]'::jsonb,
  windows jsonb not null default '[]'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.scenes enable row level security;

create policy "Users can manage scenes of own assessments"
  on public.scenes for all
  using (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()));

-- 6. Mobility Configs
create table if not exists public.mobility_configs (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid unique references public.assessments(id) on delete cascade not null,
  profile text not null default 'manual-wheelchair',
  turning_space_cm integer not null check (turning_space_cm > 0),
  passage_width_cm integer not null check (passage_width_cm > 0),
  walker_width_cm integer not null check (walker_width_cm > 0),
  clearance_tolerance_cm integer not null check (clearance_tolerance_cm >= 0),
  bed_side_access_cm integer not null check (bed_side_access_cm >= 0),
  door_threshold_max_cm double precision not null check (door_threshold_max_cm >= 0),
  reach_range_low_cm integer not null check (reach_range_low_cm >= 0),
  reach_range_high_cm integer not null check (reach_range_high_cm >= 0),
  notes text default '' not null,
  created_at timestamptz default now() not null
);

alter table public.mobility_configs enable row level security;

create policy "Users can manage mobility_configs of own assessments"
  on public.mobility_configs for all
  using (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()));

-- 7. Routes
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid unique references public.assessments(id) on delete cascade not null,
  name text not null default 'Primary Route',
  checkpoints jsonb not null default '[]'::jsonb,
  path_points jsonb not null default '[]'::jsonb,
  length_meters double precision not null default 0,
  min_clearance_cm double precision not null default 0,
  clearance_status text not null default 'unverified',
  is_passable boolean not null default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.routes enable row level security;

create policy "Users can manage routes of own assessments"
  on public.routes for all
  using (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()));

-- 8. Spatial Evaluations
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid unique references public.assessments(id) on delete cascade not null,
  score integer not null check (score >= 0 and score <= 100),
  status text not null,
  route_accessibility text not null,
  clearance_status text not null,
  turning_space_compliance text not null,
  critical_issues_count integer not null default 0 check (critical_issues_count >= 0),
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz default now() not null
);

alter table public.evaluations enable row level security;

create policy "Users can manage evaluations of own assessments"
  on public.evaluations for all
  using (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()));

-- 9. Layout Optimizations
create table if not exists public.optimizations (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.assessments(id) on delete cascade not null,
  status text not null default 'generated',
  candidates jsonb not null default '[]'::jsonb,
  selected_candidate_id text,
  applied_at timestamptz,
  reverted_at timestamptz,
  snapshot_before_apply jsonb,
  created_at timestamptz default now() not null
);

create index if not exists idx_optimizations_assessment_id on public.optimizations(assessment_id);

alter table public.optimizations enable row level security;

create policy "Users can manage optimizations of own assessments"
  on public.optimizations for all
  using (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()));

-- 10. AI Analyses (Audit log for floorplan interpretations & explanations)
create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.assessments(id) on delete cascade not null,
  type text not null check (type in ('interpretation', 'explanation')),
  model_name text not null,
  input_hash text not null,
  raw_response jsonb not null,
  parsed_result jsonb not null,
  user_accepted_changes jsonb default null,
  created_at timestamptz default now() not null
);

create index if not exists idx_ai_analyses_assessment_id on public.ai_analyses(assessment_id);

alter table public.ai_analyses enable row level security;

create policy "Users can manage ai_analyses of own assessments"
  on public.ai_analyses for all
  using (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()));

-- Storage Bucket Configuration (if storage schema exists)
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'floorplans',
      'floorplans',
      false,
      52428800,
      array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
    )
    on conflict (id) do update set
      public = false,
      file_size_limit = 52428800,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

    -- Storage RLS Policies
    drop policy if exists "Authenticated users can select own floorplan storage" on storage.objects;
    create policy "Authenticated users can select own floorplan storage"
      on storage.objects for select
      using (bucket_id = 'floorplans' and (storage.foldername(name))[1] = auth.uid()::text);

    drop policy if exists "Authenticated users can insert own floorplan storage" on storage.objects;
    create policy "Authenticated users can insert own floorplan storage"
      on storage.objects for insert
      with check (bucket_id = 'floorplans' and (storage.foldername(name))[1] = auth.uid()::text);

    drop policy if exists "Authenticated users can delete own floorplan storage" on storage.objects;
    create policy "Authenticated users can delete own floorplan storage"
      on storage.objects for delete
      using (bucket_id = 'floorplans' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

-- 11. Transactional RPC Functions for Complete Write Atomicity

-- Atomic save of complete assessment state bundle (metadata + scene + calibration + mobility + route)
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
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_owner uuid;
begin
  -- 1. Check assessment existence and enforce ownership
  select user_id into v_owner from public.assessments where id = p_assessment_id;
  if v_owner is null then
    return jsonb_build_object('success', false, 'error', 'Assessment not found');
  end if;
  if p_user_id is not null and v_owner <> p_user_id then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  -- 2. Update assessment record
  update public.assessments
  set name = p_name,
      facility_name = coalesce(p_facility, ''),
      space_name = coalesce(p_space, ''),
      environment_type = coalesce(p_environment, 'residential'),
      notes = coalesce(p_notes, ''),
      updated_at = now()
  where id = p_assessment_id;

  -- 3. Upsert scene
  insert into public.scenes (assessment_id, boundary, furniture, updated_at)
  values (p_assessment_id, coalesce(p_boundary, '[]'::jsonb), coalesce(p_furniture, '[]'::jsonb), now())
  on conflict (assessment_id) do update set
    boundary = excluded.boundary,
    furniture = excluded.furniture,
    updated_at = now();

  -- 4. Upsert calibration if provided
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

  -- 5. Upsert mobility config if provided
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

  -- 6. Upsert route checkpoints if provided
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

-- Atomic layout alternative application
create or replace function public.apply_layout_candidate(
  p_assessment_id uuid,
  p_candidate_id text,
  p_expected_fingerprint text,
  p_new_furniture jsonb,
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_owner uuid;
  v_opt_id uuid;
  v_current_furniture jsonb;
  v_opt_candidates jsonb;
  v_found boolean := false;
  v_cand jsonb;
begin
  -- 1. Verify assessment and ownership
  select user_id into v_owner from public.assessments where id = p_assessment_id;
  if v_owner is null then
    return jsonb_build_object('success', false, 'error', 'Assessment not found');
  end if;
  if p_user_id is not null and v_owner <> p_user_id then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  -- 2. Fetch current scene furniture
  select furniture into v_current_furniture from public.scenes where assessment_id = p_assessment_id;
  if v_current_furniture is null then
    return jsonb_build_object('success', false, 'error', 'Assessment scene not found');
  end if;

  -- 3. Fetch latest optimization
  select id, candidates into v_opt_id, v_opt_candidates
  from public.optimizations
  where assessment_id = p_assessment_id
  order by created_at desc
  limit 1;

  if v_opt_id is null then
    return jsonb_build_object('success', false, 'error', 'No optimization alternatives found for this assessment');
  end if;

  -- 4. Verify candidate exists in candidates array
  for v_cand in select * from jsonb_array_elements(v_opt_candidates)
  loop
    if v_cand->>'id' = p_candidate_id then
      v_found := true;
      exit;
    end if;
  end loop;

  if not v_found then
    return jsonb_build_object('success', false, 'error', 'Candidate ' || p_candidate_id || ' not found in alternatives');
  end if;

  -- 5. Atomically update optimizations and scene
  update public.optimizations
  set selected_candidate_id = p_candidate_id,
      snapshot_before_apply = v_current_furniture,
      applied_at = now()
  where id = v_opt_id;

  update public.scenes
  set furniture = p_new_furniture,
      updated_at = now()
  where assessment_id = p_assessment_id;

  update public.assessments
  set updated_at = now()
  where id = p_assessment_id;

  return jsonb_build_object('success', true);
exception
  when others then
    return jsonb_build_object('success', false, 'error', SQLERRM);
end;
$$;

-- Atomic layout alternative revert
create or replace function public.revert_layout_candidate(
  p_assessment_id uuid,
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_owner uuid;
  v_opt_id uuid;
  v_snapshot jsonb;
begin
  -- 1. Verify assessment and ownership
  select user_id into v_owner from public.assessments where id = p_assessment_id;
  if v_owner is null then
    return jsonb_build_object('success', false, 'error', 'Assessment not found');
  end if;
  if p_user_id is not null and v_owner <> p_user_id then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  -- 2. Fetch latest applied optimization
  select id, snapshot_before_apply into v_opt_id, v_snapshot
  from public.optimizations
  where assessment_id = p_assessment_id
    and applied_at is not null
    and snapshot_before_apply is not null
  order by applied_at desc
  limit 1;

  if v_opt_id is null or v_snapshot is null then
    return jsonb_build_object('success', false, 'error', 'No applied layout candidate available to revert');
  end if;

  -- 3. Restore baseline furniture and record revert in single transaction
  update public.scenes
  set furniture = v_snapshot,
      updated_at = now()
  where assessment_id = p_assessment_id;

  update public.optimizations
  set reverted_at = now(),
      selected_candidate_id = null
  where id = v_opt_id;

  update public.assessments
  set updated_at = now()
  where id = p_assessment_id;

  return jsonb_build_object('success', true);
exception
  when others then
    return jsonb_build_object('success', false, 'error', SQLERRM);
end;
$$;
