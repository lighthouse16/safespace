import test from "node:test";
import assert from "node:assert/strict";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

test("Auth Adversarial: real Supabase Auth signup and password authentication", async () => {
  const email = `adversarial_${Date.now()}@example.com`;
  const password = "ValidStrongPassword123!";

  // 1. Genuine signup
  const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  assert.equal(signupRes.status, 200);
  const signupJson = await signupRes.json();
  assert.ok(signupJson.access_token, "Must return real access_token");
  assert.ok(signupJson.user?.id, "Must return real user ID");

  // 2. Successful signin with correct password
  const signinRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  assert.equal(signinRes.status, 200);
  const signinJson = await signinRes.json();
  assert.ok(signinJson.access_token, "Must return valid JWT token");
});

test("Auth Adversarial: signin strictly rejects incorrect password", async () => {
  const email = `adversarial_pwd_${Date.now()}@example.com`;
  const correctPassword = "CorrectPassword123!";
  const wrongPassword = "WrongPassword999!";

  await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: correctPassword }),
  });

  // Attempt signin with wrong password
  const failedRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: wrongPassword }),
  });

  assert.equal(failedRes.status, 400);
  const json = await failedRes.json();
  assert.match(json.error_description || json.msg || "", /invalid login credentials/i);
});

test("Auth Adversarial: signin strictly rejects nonexistent user", async () => {
  const failedRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: "nonexistent_ghost_user@example.com", password: "SomePassword123!" }),
  });

  assert.equal(failedRes.status, 400);
  const json = await failedRes.json();
  assert.match(json.error_description || json.msg || "", /invalid login credentials/i);
});
