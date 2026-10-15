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

test("RPC Security: anonymous/public role is denied execution on sensitive RPCs", (t) => {
  if (!dbAvailable) {
    t.skip("Database container unavailable");
    return;
  }

  // 1. save_assessment_bundle
  assert.throws(
    () => {
      runSql(`
        SET ROLE anon;
        SELECT public.save_assessment_bundle(
          '11111111-1111-1111-1111-111111111111'::uuid,
          'Malicious Injected Name'
        );
        RESET ROLE;
      `);
    },
    /permission denied for function save_assessment_bundle/i,
    "anon role must be rejected with permission denied"
  );

  // 2. apply_layout_candidate
  assert.throws(
    () => {
      runSql(`
        SET ROLE anon;
        SELECT public.apply_layout_candidate(
          '11111111-1111-1111-1111-111111111111'::uuid,
          'cand-1'
        );
        RESET ROLE;
      `);
    },
    /permission denied for function apply_layout_candidate/i,
    "anon role must be rejected with permission denied"
  );

  // 3. revert_layout_candidate
  assert.throws(
    () => {
      runSql(`
        SET ROLE anon;
        SELECT public.revert_layout_candidate(
          '11111111-1111-1111-1111-111111111111'::uuid
        );
        RESET ROLE;
      `);
    },
    /permission denied for function revert_layout_candidate/i,
    "anon role must be rejected with permission denied"
  );
});

test("RPC Security: User B cannot mutate User A assessment bundle", (t) => {
  if (!dbAvailable) {
    t.skip("Database container unavailable");
    return;
  }

  const userA = "aaaa1111-1111-1111-1111-111111111111";
  const userB = "bbbb2222-2222-2222-2222-222222222222";
  const assessmentA = "aaaa3333-3333-3333-3333-333333333333";

  runSql(`INSERT INTO auth.users (id, email) VALUES ('${userA}', 'victim_a@example.com'), ('${userB}', 'attacker_b@example.com') ON CONFLICT DO NOTHING;`);
  runSql(`DELETE FROM public.assessments WHERE id = '${assessmentA}';`);
  runSql(`INSERT INTO public.assessments (id, user_id, name) VALUES ('${assessmentA}', '${userA}', 'Target Private Assessment');`);

  runSql(`GRANT authenticated TO postgres;`);

  // Attempt mutation as User B
  const res = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '${userB}';
    SELECT public.save_assessment_bundle(
      '${assessmentA}'::uuid,
      'Compromised Title'
    );
    RESET ROLE;
  `);

  const parsed = JSON.parse(res);
  assert.equal(parsed.success, false);
  assert.match(parsed.error, /Unauthorized: access denied/i);

  // Verify unchanged in DB
  const currentTitle = runSql(`SELECT name FROM public.assessments WHERE id = '${assessmentA}';`);
  assert.equal(currentTitle, "Target Private Assessment");
});

test("RPC Security: apply_layout_candidate rejects unauthorized cross-user apply", (t) => {
  if (!dbAvailable) {
    t.skip("Database container unavailable");
    return;
  }
  const userB = "bbbb2222-2222-2222-2222-222222222222";
  const assessmentA = "aaaa3333-3333-3333-3333-333333333333";

  // Attempt apply as User B
  const res = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '${userB}';
    SELECT public.apply_layout_candidate(
      '${assessmentA}'::uuid,
      'cand-test'
    );
    RESET ROLE;
  `);

  const parsed = JSON.parse(res);
  assert.equal(parsed.success, false);
  assert.match(parsed.error, /Unauthorized: access denied/i);
});

test("RPC Security: apply_layout_candidate uses only stored candidate geometry", (t) => {
  if (!dbAvailable) {
    t.skip("Database container unavailable");
    return;
  }

  const userA = "aaaa1111-1111-1111-1111-111111111111";
  const assessmentA = "aaaa3333-3333-3333-3333-333333333333";

  // Setup initial scene and stored optimization record
  const baselineFurniture = JSON.stringify([{ id: "bed-1", type: "bed", x: 10, y: 10, width: 90, length: 190, rotation: 0 }]);
  const candFurniture = JSON.stringify([{ id: "bed-1", type: "bed", x: 50, y: 50, width: 90, length: 190, rotation: 0 }]);
  const candidatesJson = JSON.stringify([{ id: "cand-opt-1", name: "Safe Option", furniture: JSON.parse(candFurniture) }]);

  runSql(`INSERT INTO public.scenes (assessment_id, boundary, furniture) VALUES ('${assessmentA}', '[]'::jsonb, '${baselineFurniture}'::jsonb) ON CONFLICT (assessment_id) DO UPDATE SET furniture = '${baselineFurniture}'::jsonb;`);
  runSql(`INSERT INTO public.optimizations (assessment_id, status, candidates) VALUES ('${assessmentA}', 'generated', '${candidatesJson}'::jsonb);`);

  // Apply as User A
  const res = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '${userA}';
    SELECT public.apply_layout_candidate(
      '${assessmentA}'::uuid,
      'cand-opt-1'
    );
    RESET ROLE;
  `);

  const parsed = JSON.parse(res);
  assert.equal(parsed.success, true);

  // Verify scene furniture now matches candFurniture (x=50, y=50)
  const appliedFurniture = runSql(`SELECT furniture->0->>'x' FROM public.scenes WHERE assessment_id = '${assessmentA}';`);
  assert.equal(appliedFurniture, "50");

  // Revert as User A
  const revertRes = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '${userA}';
    SELECT public.revert_layout_candidate(
      '${assessmentA}'::uuid
    );
    RESET ROLE;
  `);

  const parsedRevert = JSON.parse(revertRes);
  assert.equal(parsedRevert.success, true);

  // Verify baseline restored (x=10)
  const restoredFurniture = runSql(`SELECT furniture->0->>'x' FROM public.scenes WHERE assessment_id = '${assessmentA}';`);
  assert.equal(restoredFurniture, "10");
});
