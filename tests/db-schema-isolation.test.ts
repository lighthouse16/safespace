import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";

function getDbContainer(): string | null {
  for (const name of ["supabase_db_hack4sdg", "safespace-test-db"]) {
    try {
      execSync(`docker exec ${name} pg_isready -U postgres`, { stdio: "ignore" });
      return name;
    } catch {}
  }
  return null;
}

const dbContainer = getDbContainer();
const dbAvailable = dbContainer !== null;

function runSql(sql: string): string {
  if (!dbContainer) throw new Error("Database container unavailable");
  try {
    return execSync(`docker exec -i ${dbContainer} psql -v ON_ERROR_STOP=1 -U postgres -t -A -q`, {
      input: sql,
      encoding: "utf-8",
    }).trim();
  } catch (err: unknown) {
    const stderr = err && typeof err === "object" && "stderr" in err ? String(err.stderr) : "";
    const message = err instanceof Error ? stderr || err.message : String(err);
    throw new Error(message);
  }
}


test("DB Schema: auth.users insert triggers profile creation", (t) => {
  if (!dbAvailable) {
    t.skip("Requires running safespace-test-db container");
    return;
  }
  const userId = "11111111-1111-1111-1111-111111111111";
  runSql(`DELETE FROM auth.users WHERE id = '${userId}';`);
  runSql(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('${userId}', 'alice@example.com', '{"full_name":"Alice Therapist"}');`);

  const profile = runSql(`SELECT email || ':' || full_name FROM public.profiles WHERE id = '${userId}';`);
  assert.equal(profile, "alice@example.com:Alice Therapist");
});

test("DB Schema: check constraint rejects empty assessment name", (t) => {
  if (!dbAvailable) {
    t.skip("Requires running safespace-test-db container");
    return;
  }
  const userId = "11111111-1111-1111-1111-111111111111";
  assert.throws(
    () => {
      runSql(`INSERT INTO public.assessments (user_id, name) VALUES ('${userId}', '   ');`);
    },
    /check constraint/i
  );
});

test("DB Schema: child records cascade on assessment deletion", (t) => {
  if (!dbAvailable) {
    t.skip("Requires running safespace-test-db container");
    return;
  }
  const userId = "11111111-1111-1111-1111-111111111111";
  const assessmentId = "22222222-2222-2222-2222-222222222222";

  // Cleanup
  runSql(`DELETE FROM public.assessments WHERE id = '${assessmentId}';`);

  // Insert assessment
  runSql(`INSERT INTO public.assessments (id, user_id, name) VALUES ('${assessmentId}', '${userId}', 'Test Suite Clinic');`);

  // Insert children (scenes, calibrations, mobility_configs, routes)
  runSql(`INSERT INTO public.scenes (assessment_id, boundary) VALUES ('${assessmentId}', '[]'::jsonb);`);
  runSql(`INSERT INTO public.calibrations (assessment_id, pixels_per_meter, raw_distance_px, reference_distance_m) VALUES ('${assessmentId}', 100, 100, 1.0);`);
  runSql(`INSERT INTO public.mobility_configs (assessment_id, turning_space_cm, passage_width_cm, walker_width_cm, clearance_tolerance_cm, bed_side_access_cm, door_threshold_max_cm, reach_range_low_cm, reach_range_high_cm) VALUES ('${assessmentId}', 150, 85, 85, 0, 0, 0, 0, 0);`);
  runSql(`INSERT INTO public.routes (assessment_id) VALUES ('${assessmentId}');`);

  // Verify children exist
  assert.equal(runSql(`SELECT count(*) FROM public.scenes WHERE assessment_id = '${assessmentId}';`), "1");
  assert.equal(runSql(`SELECT count(*) FROM public.calibrations WHERE assessment_id = '${assessmentId}';`), "1");
  assert.equal(runSql(`SELECT count(*) FROM public.mobility_configs WHERE assessment_id = '${assessmentId}';`), "1");
  assert.equal(runSql(`SELECT count(*) FROM public.routes WHERE assessment_id = '${assessmentId}';`), "1");

  // Delete parent assessment
  runSql(`DELETE FROM public.assessments WHERE id = '${assessmentId}';`);

  // Verify all cascaded
  assert.equal(runSql(`SELECT count(*) FROM public.scenes WHERE assessment_id = '${assessmentId}';`), "0");
  assert.equal(runSql(`SELECT count(*) FROM public.calibrations WHERE assessment_id = '${assessmentId}';`), "0");
  assert.equal(runSql(`SELECT count(*) FROM public.mobility_configs WHERE assessment_id = '${assessmentId}';`), "0");
  assert.equal(runSql(`SELECT count(*) FROM public.routes WHERE assessment_id = '${assessmentId}';`), "0");
});

test("DB Schema: Row Level Security isolates User A assessments from User B", (t) => {
  if (!dbAvailable) {
    t.skip("Requires running safespace-test-db container");
    return;
  }
  const userA = "33333333-3333-3333-3333-333333333333";
  const userB = "44444444-4444-4444-4444-444444444444";
  const assessmentA = "55555555-5555-5555-5555-555555555555";

  runSql(`INSERT INTO auth.users (id, email) VALUES ('${userA}', 'usera@example.com'), ('${userB}', 'userb@example.com') ON CONFLICT DO NOTHING;`);
  runSql(`DELETE FROM public.assessments WHERE id = '${assessmentA}';`);
  runSql(`INSERT INTO public.assessments (id, user_id, name) VALUES ('${assessmentA}', '${userA}', 'Confidential Patient Space');`);

  // Ensure postgres can assume authenticated role
  runSql(`GRANT authenticated TO postgres;`);

  // As User A: can view own assessment
  const countA = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '${userA}';
    SELECT count(*) FROM public.assessments WHERE id = '${assessmentA}';
    RESET ROLE;
  `).split("\n").filter(Boolean).pop();
  assert.equal(countA, "1");

  // As non-superuser User B under RLS:
  const countB = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '${userB}';
    SELECT count(*) FROM public.assessments WHERE id = '${assessmentA}';
    RESET ROLE;
  `).split("\n").filter(Boolean).pop();
  assert.equal(countB, "0", "User B must not see User A's assessment");
});
