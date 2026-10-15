import test from "node:test";
import assert from "node:assert/strict";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

test("Negative Security: Unauthenticated access to private tables via REST is blocked by RLS", async () => {
  // Querying private assessments table with anon key (no user token)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/assessments`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
    },
  });

  // PostgREST with RLS returns empty array or 401 for anon
  assert.ok(res.status === 200 || res.status === 401);
  const data = await res.json();
  if (Array.isArray(data)) {
    assert.equal(data.length, 0, "Anonymous role must never see private assessments under RLS");
  }
});

test("Negative Security: Anonymous insertion into private tables is blocked by RLS", async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/assessments`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: JSON.stringify({
      user_id: "00000000-0000-0000-0000-000000000000",
      name: "Illegitimate Injected Assessment",
    }),
  });

  // PostgREST with RLS blocks insert for anon
  assert.ok(res.status >= 400, "Anonymous insert must be blocked by RLS check policy");
});

test("Negative Security: Forged Bearer token is rejected by auth", async () => {
  const forgedJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTExMTEtMTExMS0xMTExMTExMTExMTEiLCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.invalid-forged-signature";

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${forgedJwt}`,
    },
  });

  assert.ok(res.status === 401 || res.status === 403, "Forged JWT must be rejected with HTTP 401 or 403");
});
