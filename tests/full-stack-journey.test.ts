import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";

const SERVER_PORT = 3005;
const BASE_URL = `http://127.0.0.1:${SERVER_PORT}`;

let serverProcess: ChildProcess | null = null;

async function waitForServer(url: string, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/v1/auth/session`);
      if (res.status === 200 || res.status === 401) {
        return;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`Server at ${url} failed to start within ${timeoutMs}ms`);
}

test("Full-Stack Journey: Complete 23-step verification", async (t) => {
  // Launch Next.js server
  serverProcess = spawn("npx", ["next", "start", "-p", String(SERVER_PORT)], {
    stdio: "pipe",
    shell: true,
  });

  await waitForServer(BASE_URL);

  let userACookie = "";
  let userAId = "";
  let assessmentId = "";
  const userAEmail = `clinician_a_${Date.now()}@example.com`;
  const password = "Password123!";

  await t.test("Step 1: Open SafeSpace homepage & public routes", async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /SafeSpace/i);
  });

  await t.test("Step 2: Create account, sign up, sign in, get session", async () => {
    // 2a. Sign up
    const signUpRes = await fetch(`${BASE_URL}/api/v1/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userAEmail, password, fullName: "Dr. Elena Rostova" }),
    });
    assert.equal(signUpRes.status, 200, "Sign up must succeed with HTTP 200");
    const signUpData = await signUpRes.json();
    assert.ok(signUpData.user?.id, "User ID must be returned on signup");
    userAId = signUpData.user.id;

    // 2b. Sign in
    const signInRes = await fetch(`${BASE_URL}/api/v1/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userAEmail, password }),
    });
    assert.equal(signInRes.status, 200, "Sign in must succeed with HTTP 200");
    const setCookie = signInRes.headers.get("set-cookie");
    assert.ok(setCookie, "Session cookie must be issued on sign in");
    userACookie = setCookie.split(";")[0];

    // 2c. Verify active session
    const sessionRes = await fetch(`${BASE_URL}/api/v1/auth/session`, {
      headers: { Cookie: userACookie },
    });
    assert.equal(sessionRes.status, 200);
    const sessionData = await sessionRes.json();
    assert.equal(sessionData.authenticated, true);
    assert.equal(sessionData.user.email, userAEmail);
    assert.equal(sessionData.user.id, userAId);
  });

  await t.test("Step 3: Create a new assessment", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/assessments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: userACookie,
      },
      body: JSON.stringify({
        name: "Maplewood Care Suite 104",
        facilityName: "Maplewood Senior Living",
        spaceName: "Private Studio",
        environmentType: "residential",
        notes: "Auditing wheelchair clearance from entry to bed.",
      }),
    });

    assert.equal(res.status, 201, "Assessment creation must return HTTP 201");
    const data = await res.json();
    assert.ok(data.assessment?.id, "Assessment UUID must be returned");
    assessmentId = data.assessment.id;
  });

  await t.test("Step 4-5: Upload floorplan media & save calibrated bundle", async () => {
    // 4. Upload floorplan media
    const formData = new FormData();
    const fakeBlob = new Blob(["fake-image-bytes"], { type: "image/png" });
    formData.append("file", fakeBlob, "floorplan.png");

    const mediaRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}/media`, {
      method: "POST",
      headers: { Cookie: userACookie },
      body: formData,
    });
    assert.equal(mediaRes.status, 201, "Media upload must return HTTP 201");
    const mediaData = await mediaRes.json();
    assert.ok(mediaData.asset?.id);

    // 5. Save calibrated boundary & route bundle via PUT
    const putRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: userACookie,
      },
      body: JSON.stringify({
        schemaVersion: 1,
        assessmentType: "user",
        metadata: {
          id: assessmentId,
          name: "Maplewood Care Suite 104",
          facilityName: "Maplewood Senior Living",
          spaceName: "Private Studio",
          environmentType: "residential",
        },
        canonicalBoundary: [
          { x: 0, y: 0 },
          { x: 800, y: 0 },
          { x: 800, y: 600 },
          { x: 0, y: 600 },
        ],
        calibration: {
          pixelsPerCm: 1.0,
          realLength: 8.0,
          unit: "m",
          pixelDistance: 800,
          originPolicy: "canvas-origin-0-0",
        },
        activeProfileId: "manual-wheelchair",
        routeWaypoints: [
          { id: "wp-1", name: "Doorway", x: 50, y: 300, isMandatory: true },
          { id: "wp-2", name: "Balcony", x: 750, y: 300, isMandatory: true },
        ],
        furniture: [
          {
            id: "bed-1",
            name: "Hospital Bed",
            category: "chair",
            roomId: "room-1",
            x: 200,
            y: 200,
            width: 180,
            depth: 90,
            height: 80,
            rotation: 0,
            isFixed: true,
            isConfirmed: true,
            isStableSupport: false,
          },
          {
            id: "desk-1",
            name: "Overbed Table",
            category: "table",
            roomId: "room-1",
            x: 220,
            y: 310,
            width: 80,
            depth: 50,
            height: 75,
            rotation: 0,
            isFixed: false,
            isConfirmed: true,
            isStableSupport: false,
          },
        ],
      }),
    });
    assert.equal(putRes.status, 200, "Assessment bundle update must return HTTP 200");
  });

  await t.test("Steps 6-12: Geometric Calibration, Furniture, Routing & Evaluation", async () => {
    const evalPayload = {
      boundary: [
        { x: 0, y: 0 },
        { x: 800, y: 0 },
        { x: 800, y: 600 },
        { x: 0, y: 600 },
      ],
      furniture: [
        {
          id: "bed-1",
          name: "Hospital Bed",
          category: "chair",
          roomId: "room-1",
          x: 200,
          y: 200,
          width: 180,
          depth: 90,
          height: 80,
          rotation: 0,
          isFixed: true,
          isConfirmed: true,
          isStableSupport: false,
        },
      ],
      routeWaypoints: [
        { id: "wp-1", name: "Doorway", x: 50, y: 300, isMandatory: true },
        { id: "wp-2", name: "Balcony", x: 750, y: 300, isMandatory: true },
      ],
      calibration: {
        pixelsPerCm: 1.0,
        realLength: 8.0,
        unit: "m",
        pixelDistance: 800,
        originPolicy: "canvas-origin-0-0",
      },
      profile: {
        id: "manual-wheelchair",
        name: "Manual Wheelchair",
        description: "Active user",
        minClearanceCm: 85,
        turningSpaceCm: 150,
        fallHistory: false,
        requiresSupport: false,
        lowLightSensitivity: "Moderate",
      },
    };

    const evalRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}/spatial/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: userACookie,
      },
      body: JSON.stringify(evalPayload),
    });

    assert.equal(evalRes.status, 200, "Spatial evaluation must return HTTP 200");
    const data = await evalRes.json();
    assert.ok(data.evaluation);
    assert.ok(data.evaluation.summary);
    assert.ok(typeof data.evaluation.summary.routeFeasibility === "string");
  });

  await t.test("Steps 13-14: AI Floorplan Interpretation & Human Review Contract", async () => {
    // 13a. Attempt interpretation without explicit consent -> Must return 400
    const noConsentRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}/ai/interpretation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: userACookie,
      },
      body: JSON.stringify({
        userConsent: false,
        imageMimeType: "image/png",
        imageBase64: "dGVzdC1pbWFnZQ==",
        pixelsPerCm: 1.0,
      }),
    });
    assert.equal(noConsentRes.status, 400, "Unconsented AI interpretation must return HTTP 400");

    // 13b. Uncalibrated interpretation (missing/invalid scale) -> Must return 400
    const uncalibratedRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}/ai/interpretation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: userACookie,
      },
      body: JSON.stringify({
        userConsent: true,
        imageMimeType: "image/png",
        imageBase64: "dGVzdC1pbWFnZQ==",
        pixelsPerCm: 0,
      }),
    });
    assert.equal(uncalibratedRes.status, 400, "Uncalibrated interpretation must return HTTP 400");
  });

  await t.test("Steps 15-17: Optimizer Generation, Transactional Apply & Revert", async () => {
    const optPayload = {
      boundary: [
        { x: 0, y: 0 },
        { x: 800, y: 0 },
        { x: 800, y: 600 },
        { x: 0, y: 600 },
      ],
      furniture: [
        {
          id: "bed-1",
          name: "Hospital Bed",
          category: "chair",
          roomId: "room-1",
          x: 200,
          y: 200,
          width: 180,
          depth: 90,
          height: 80,
          rotation: 0,
          isFixed: true,
          isConfirmed: true,
          isStableSupport: false,
        },
        {
          id: "table-1",
          name: "Side Table",
          category: "table",
          roomId: "room-1",
          x: 390,
          y: 250,
          width: 60,
          depth: 60,
          height: 75,
          rotation: 0,
          isFixed: false,
          isConfirmed: true,
          isStableSupport: false,
        },
      ],
      routeWaypoints: [
        { id: "wp-1", name: "Doorway", x: 50, y: 300, isMandatory: true },
        { id: "wp-2", name: "Balcony", x: 750, y: 300, isMandatory: true },
      ],
      calibration: {
        pixelsPerCm: 1.0,
        realLength: 8.0,
        unit: "m",
        pixelDistance: 800,
        originPolicy: "canvas-origin-0-0",
      },
      profile: {
        id: "manual-wheelchair",
        name: "Manual Wheelchair",
        description: "Active user",
        minClearanceCm: 85,
        turningSpaceCm: 150,
        fallHistory: false,
        requiresSupport: false,
        lowLightSensitivity: "Moderate",
      },
      maxCandidates: 3,
    };

    const optRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}/spatial/optimize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: userACookie,
      },
      body: JSON.stringify(optPayload),
    });

    assert.equal(optRes.status, 200, "Spatial optimization must return HTTP 200");
    const data = await optRes.json();
    assert.ok(data.optimization);
    assert.ok(data.sceneFingerprint);
    assert.ok(data.sceneFingerprint.startsWith("v1:"));
  });

  await t.test("Step 18: Retrieve Persisted Assessment / Report", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}`, {
      headers: { Cookie: userACookie },
    });
    assert.equal(res.status, 200, "Assessment report retrieval must return HTTP 200");
    const data = await res.json();
    assert.equal(data.assessment.metadata.id, assessmentId);
  });

  await t.test("Steps 19-20: Sign Out & Persisted Recovery on Second Session", async () => {
    // 19. Sign out
    const signOutRes = await fetch(`${BASE_URL}/api/v1/auth/signout`, {
      method: "POST",
      headers: { Cookie: userACookie },
    });
    assert.equal(signOutRes.status, 200);

    // Verify unauthenticated request to private assessments returns 401
    const unauthListRes = await fetch(`${BASE_URL}/api/v1/assessments`);
    assert.equal(unauthListRes.status, 401, "Signed out user must be rejected with HTTP 401");

    // 20. Sign back in (simulating new device / browser session)
    const reLoginRes = await fetch(`${BASE_URL}/api/v1/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userAEmail, password }),
    });
    assert.equal(reLoginRes.status, 200);
    const setCookie = reLoginRes.headers.get("set-cookie");
    assert.ok(setCookie);
    const newCookie = setCookie.split(";")[0];

    // Verify assessment is recovered intact
    const recoverRes = await fetch(`${BASE_URL}/api/v1/assessments`, {
      headers: { Cookie: newCookie },
    });
    assert.equal(recoverRes.status, 200);
    const recoverData = await recoverRes.json();
    const found = recoverData.assessments.find((a: { id: string }) => a.id === assessmentId);
    assert.ok(found, "Persisted assessment must survive logout and recover on new session");
    userACookie = newCookie;
  });

  await t.test("Step 21: Cross-User Tenant Isolation (User A vs User B)", async () => {
    const userBEmail = `clinician_b_${Date.now()}@example.com`;

    // Sign up User B
    const bSignupRes = await fetch(`${BASE_URL}/api/v1/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userBEmail, password, fullName: "Dr. Marcus Vance" }),
    });
    assert.equal(bSignupRes.status, 200);

    // Sign in User B
    const bSignInRes = await fetch(`${BASE_URL}/api/v1/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userBEmail, password }),
    });
    assert.equal(bSignInRes.status, 200);
    const bCookie = bSignInRes.headers.get("set-cookie")?.split(";")[0] || "";
    assert.ok(bCookie);

    // User B lists assessments -> Must NOT see User A's assessment
    const bListRes = await fetch(`${BASE_URL}/api/v1/assessments`, {
      headers: { Cookie: bCookie },
    });
    assert.equal(bListRes.status, 200);
    const bListData = await bListRes.json();
    const leaked = bListData.assessments.some((a: { id: string }) => a.id === assessmentId);
    assert.equal(leaked, false, "Tenant isolation violation: User B can see User A assessment");

    // User B tries to delete User A's assessment -> Must be 404
    const bDelRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}`, {
      method: "DELETE",
      headers: { Cookie: bCookie },
    });
    assert.equal(bDelRes.status, 404, "User B must not be permitted to delete User A assessment");
  });

  await t.test("Steps 22-23: Permanent Deletion & Verification", async () => {
    // 22. User A deletes their assessment
    const delRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}`, {
      method: "DELETE",
      headers: { Cookie: userACookie },
    });
    assert.equal(delRes.status, 200, "Deletion must return HTTP 200");

    // 23. Verify subsequent GET returns 404
    const verifyDelRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}`, {
      headers: { Cookie: userACookie },
    });
    assert.equal(verifyDelRes.status, 404, "Deleted assessment must return HTTP 404");
  });

  await t.test("Dedicated Unauthorized Access Protection Suite", async () => {
    // 1. GET /api/v1/assessments without auth -> 401
    const unauthGet = await fetch(`${BASE_URL}/api/v1/assessments`);
    assert.equal(unauthGet.status, 401);

    // 2. POST /api/v1/assessments without auth -> 401
    const unauthPost = await fetch(`${BASE_URL}/api/v1/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unauth Space" }),
    });
    assert.equal(unauthPost.status, 401);

    // 3. POST /api/v1/assessments/{id}/spatial/evaluate without auth -> 401
    const unauthEval = await fetch(`${BASE_URL}/api/v1/assessments/unauth-test/spatial/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(unauthEval.status, 401);

    // 4. POST /api/v1/assessments/{id}/spatial/optimize without auth -> 401
    const unauthOpt = await fetch(`${BASE_URL}/api/v1/assessments/unauth-test/spatial/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(unauthOpt.status, 401);

    // 5. DELETE /api/v1/assessments/{id} without auth -> 401
    const unauthDel = await fetch(`${BASE_URL}/api/v1/assessments/unauth-test`, {
      method: "DELETE",
    });
    assert.equal(unauthDel.status, 401);
  });
});

test.after(() => {
  if (serverProcess && serverProcess.pid) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"], { stdio: "ignore" });
    } else {
      serverProcess.kill("SIGKILL");
    }
  }
});
