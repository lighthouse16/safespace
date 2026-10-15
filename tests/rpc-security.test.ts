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
      'cand-test',
      'some-fingerprint'
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
  const fingerprint = "fp-cand-geom-1";

  // Setup initial scene and stored optimization record
  const baselineFurniture = JSON.stringify([{ id: "bed-1", type: "bed", x: 10, y: 10, width: 90, length: 190, rotation: 0 }]);
  const candFurniture = JSON.stringify([{ id: "bed-1", type: "bed", x: 50, y: 50, width: 90, length: 190, rotation: 0 }]);
  const candidatesJson = JSON.stringify([{ id: "cand-opt-1", name: "Safe Option", furniture: JSON.parse(candFurniture) }]);

  runSql(`INSERT INTO public.scenes (assessment_id, boundary, furniture) VALUES ('${assessmentA}', '[]'::jsonb, '${baselineFurniture}'::jsonb) ON CONFLICT (assessment_id) DO UPDATE SET furniture = '${baselineFurniture}'::jsonb;`);
  runSql(`INSERT INTO public.optimizations (assessment_id, status, scene_fingerprint, candidates) VALUES ('${assessmentA}', 'generated', '${fingerprint}', '${candidatesJson}'::jsonb);`);

  // Apply as User A
  const res = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '${userA}';
    SELECT public.apply_layout_candidate(
      '${assessmentA}'::uuid,
      'cand-opt-1',
      '${fingerprint}'
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

test("RPC Security: empty or null auth.uid() is rejected on sensitive RPCs", (t) => {
  if (!dbAvailable) {
    t.skip("Database container unavailable");
    return;
  }

  const assessmentId = "aaaa3333-3333-3333-3333-333333333333";

  // Director reproduction check: empty sub under authenticated role
  const saveRes = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '';
    SELECT public.save_assessment_bundle(
      '${assessmentId}'::uuid,
      'Malicious Empty Sub Mutate'
    );
    RESET ROLE;
  `);
  const parsedSave = JSON.parse(saveRes);
  assert.equal(parsedSave.success, false);
  assert.match(parsedSave.error, /database identity/i);

  const applyRes = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '';
    SELECT public.apply_layout_candidate(
      '${assessmentId}'::uuid,
      'cand-1',
      'some-fp'
    );
    RESET ROLE;
  `);
  const parsedApply = JSON.parse(applyRes);
  assert.equal(parsedApply.success, false);
  assert.match(parsedApply.error, /database identity/i);

  const revertRes = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '';
    SELECT public.revert_layout_candidate(
      '${assessmentId}'::uuid
    );
    RESET ROLE;
  `);
  const parsedRevert = JSON.parse(revertRes);
  assert.equal(parsedRevert.success, false);
  assert.match(parsedRevert.error, /database identity/i);
});

test("RPC Security: apply_layout_candidate enforces in-transaction fingerprint matching", (t) => {
  if (!dbAvailable) {
    t.skip("Database container unavailable");
    return;
  }

  const userA = "aaaa1111-1111-1111-1111-111111111111";
  const assessmentA = "aaaa3333-3333-3333-3333-333333333333";
  const storedFingerprint = "fp-stored-authoritative-999";

  runSql(`DELETE FROM public.optimizations WHERE assessment_id = '${assessmentA}';`);
  const candidatesJson = JSON.stringify([{ id: "cand-fp-1", name: "Safe Option", furniture: [] }]);
  runSql(`INSERT INTO public.optimizations (assessment_id, status, scene_fingerprint, candidates) VALUES ('${assessmentA}', 'generated', '${storedFingerprint}', '${candidatesJson}'::jsonb);`);

  // 1. Missing fingerprint rejected
  const missingRes = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '${userA}';
    SELECT public.apply_layout_candidate(
      '${assessmentA}'::uuid,
      'cand-fp-1'
    );
    RESET ROLE;
  `);
  assert.equal(JSON.parse(missingRes).success, false);
  assert.match(JSON.parse(missingRes).error, /Missing expected scene fingerprint/i);

  // 2. Mismatched fingerprint rejected
  const mismatchRes = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '${userA}';
    SELECT public.apply_layout_candidate(
      '${assessmentA}'::uuid,
      'cand-fp-1',
      'fp-tampered-forged'
    );
    RESET ROLE;
  `);
  assert.equal(JSON.parse(mismatchRes).success, false);
  assert.match(JSON.parse(mismatchRes).error, /Mismatched scene fingerprint/i);
});

test("RPC Security: apply_layout_candidate rejects candidate when scene modified after generation", (t) => {
  if (!dbAvailable) {
    t.skip("Database container unavailable");
    return;
  }

  const userA = "aaaa1111-1111-1111-1111-111111111111";
  const assessmentA = "aaaa3333-3333-3333-3333-333333333333";
  const fingerprint = "fp-stale-scene-check";

  const initialFurniture = JSON.stringify([{ id: "desk-1", x: 10, y: 10 }]);
  const modifiedFurniture = JSON.stringify([{ id: "desk-1", x: 99, y: 99 }]);
  const candidatesJson = JSON.stringify([{ id: "cand-stale-1", name: "Option", furniture: [{ id: "desk-1", x: 50, y: 50 }] }]);

  // Insert initial scene and optimization
  runSql(`DELETE FROM public.optimizations WHERE assessment_id = '${assessmentA}';`);
  runSql(`INSERT INTO public.scenes (assessment_id, boundary, furniture, updated_at) VALUES ('${assessmentA}', '[]'::jsonb, '${initialFurniture}'::jsonb, now() - interval '10 seconds') ON CONFLICT (assessment_id) DO UPDATE SET furniture = '${initialFurniture}'::jsonb, updated_at = now() - interval '10 seconds';`);
  runSql(`INSERT INTO public.optimizations (assessment_id, status, scene_fingerprint, candidates, created_at) VALUES ('${assessmentA}', 'generated', '${fingerprint}', '${candidatesJson}'::jsonb, now() - interval '5 seconds');`);

  // Now mutate scene after optimization was created
  runSql(`UPDATE public.scenes SET furniture = '${modifiedFurniture}'::jsonb, updated_at = now() WHERE assessment_id = '${assessmentA}';`);

  // Attempt apply
  const staleRes = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '${userA}';
    SELECT public.apply_layout_candidate(
      '${assessmentA}'::uuid,
      'cand-stale-1',
      '${fingerprint}'
    );
    RESET ROLE;
  `);

  const parsed = JSON.parse(staleRes);
  assert.equal(parsed.success, false);
  assert.match(parsed.error, /Scene geometry changed since optimization was generated/i);
});

test("RPC Security: direct UPDATE on public.optimizations is blocked for authenticated users", (t) => {
  if (!dbAvailable) {
    t.skip("Database container unavailable");
    return;
  }

  const userA = "aaaa1111-1111-1111-1111-111111111111";
  const assessmentA = "aaaa3333-3333-3333-3333-333333333333";

  // Attempt direct UPDATE on optimizations table
  assert.throws(
    () => {
      runSql(`
        SET ROLE authenticated;
        SET "request.jwt.claim.sub" = '${userA}';
        UPDATE public.optimizations
        SET selected_candidate_id = 'cand-hacked', applied_at = now()
        WHERE assessment_id = '${assessmentA}';
        RESET ROLE;
      `);
    },
    /permission denied for table optimizations/i,
    "direct table UPDATE on optimizations must be rejected with permission denied"
  );
});
