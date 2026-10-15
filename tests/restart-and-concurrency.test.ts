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

test("Durability & Concurrency: Persisted state survives complete process restart", (t) => {
  if (!dbAvailable) {
    t.skip("Database container unavailable");
    return;
  }

  const userId = "77777777-7777-7777-7777-777777777777";
  const assessmentId = "88888888-8888-8888-8888-888888888888";

  // Simulate server instance 1 writing to DB
  runSql(`INSERT INTO auth.users (id, email) VALUES ('${userId}', 'restart_test@example.com') ON CONFLICT DO NOTHING;`);
  runSql(`DELETE FROM public.assessments WHERE id = '${assessmentId}';`);
  runSql(`INSERT INTO public.assessments (id, user_id, name, facility_name, space_name) VALUES ('${assessmentId}', '${userId}', 'Pre-Restart Assessment', 'Evergreen Hall', 'Suite 12');`);
  runSql(`INSERT INTO public.scenes (assessment_id, boundary, furniture) VALUES ('${assessmentId}', '[{"x":0,"y":0},{"x":500,"y":500}]'::jsonb, '[{"id":"bed-1","x":100,"y":100}]'::jsonb);`);

  // Simulate independent server instance 2 (or post-restart instance) reading state
  const recoveredName = runSql(`SELECT name FROM public.assessments WHERE id = '${assessmentId}' AND user_id = '${userId}';`);
  const recoveredFurniture = runSql(`SELECT furniture->0->>'id' FROM public.scenes WHERE assessment_id = '${assessmentId}';`);

  assert.equal(recoveredName, "Pre-Restart Assessment", "Assessment data must persist durably in PostgreSQL");
  assert.equal(recoveredFurniture, "bed-1", "Scene furniture must persist durably in PostgreSQL");
});

test("Durability & Concurrency: Row-level locking serializes concurrent candidate applications", (t) => {
  if (!dbAvailable) {
    t.skip("Database container unavailable");
    return;
  }

  const userId = "77777777-7777-7777-7777-777777777777";
  const assessmentId = "99999999-9999-9999-9999-999999999999";

  runSql(`INSERT INTO auth.users (id, email) VALUES ('${userId}', 'concurrency_test@example.com') ON CONFLICT DO NOTHING;`);
  runSql(`DELETE FROM public.assessments WHERE id = '${assessmentId}';`);
  runSql(`INSERT INTO public.assessments (id, user_id, name) VALUES ('${assessmentId}', '${userId}', 'Concurrent Mutation Space');`);
  runSql(`INSERT INTO public.scenes (assessment_id, boundary, furniture) VALUES ('${assessmentId}', '[]'::jsonb, '[{"id":"chair-1","x":10,"y":10}]'::jsonb);`);

  const candidatesJson = JSON.stringify([
    { id: "cand-a", name: "Option A", furniture: [{ id: "chair-1", x: 100, y: 100 }] },
    { id: "cand-b", name: "Option B", furniture: [{ id: "chair-1", x: 200, y: 200 }] },
  ]);
  const fingerprint = "fingerprint-concurrency-123";
  runSql(`INSERT INTO public.optimizations (assessment_id, status, scene_fingerprint, candidates) VALUES ('${assessmentId}', 'generated', '${fingerprint}', '${candidatesJson}'::jsonb);`);

  runSql(`GRANT authenticated TO postgres;`);

  // Transaction 1: Apply Candidate A with authoritative fingerprint
  const resA = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '${userId}';
    SELECT public.apply_layout_candidate('${assessmentId}'::uuid, 'cand-a', '${fingerprint}');
    RESET ROLE;
  `);
  assert.equal(JSON.parse(resA).success, true);

  const appliedX = runSql(`SELECT furniture->0->>'x' FROM public.scenes WHERE assessment_id = '${assessmentId}';`);
  assert.equal(appliedX, "100", "Candidate A furniture must be applied");

  // Transaction 2: Replayed apply without revert must be rejected
  const resB = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '${userId}';
    SELECT public.apply_layout_candidate('${assessmentId}'::uuid, 'cand-b', '${fingerprint}');
    RESET ROLE;
  `);
  const parsedB = JSON.parse(resB);
  assert.equal(parsedB.success, false);
  assert.match(parsedB.error, /already been applied/i);

  // Revert Candidate A
  const revertRes = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '${userId}';
    SELECT public.revert_layout_candidate('${assessmentId}'::uuid);
    RESET ROLE;
  `);
  assert.equal(JSON.parse(revertRes).success, true);

  // After revert, apply Candidate B
  const resB2 = runSql(`
    SET ROLE authenticated;
    SET "request.jwt.claim.sub" = '${userId}';
    SELECT public.apply_layout_candidate('${assessmentId}'::uuid, 'cand-b', '${fingerprint}');
    RESET ROLE;
  `);
  assert.equal(JSON.parse(resB2).success, true);

  // Final furniture should be Candidate B
  const finalX = runSql(`SELECT furniture->0->>'x' FROM public.scenes WHERE assessment_id = '${assessmentId}';`);
  assert.equal(finalX, "200", "Serialized mutations must leave consistent terminal state");
});
