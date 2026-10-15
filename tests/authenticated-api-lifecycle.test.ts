import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SERVER_PORT = 3006;
const BASE_URL = `http://127.0.0.1:${SERVER_PORT}`;

let serverProcess: ChildProcess | null = null;

async function waitForServer(url: string, timeoutMs = 25000): Promise<void> {
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

test("Authenticated API Lifecycle: End-to-end full product flow", async (t) => {
  serverProcess = spawn("npx", ["next", "start", "-p", String(SERVER_PORT)], {
    stdio: "pipe",
    shell: true,
  });

  t.after(async () => {
    if (serverProcess?.pid) {
      try {
        const { execSync } = await import("node:child_process");
        if (process.platform === "win32") {
          execSync(`taskkill /pid ${serverProcess.pid} /f /t`, { stdio: "ignore" });
        } else {
          serverProcess.kill("SIGKILL");
        }
      } catch {}
    }
  });

  await waitForServer(BASE_URL);

  let authHeader = "";
  let userCookie = "";
  let userId = "";
  let assessmentId = "";
  const email = `doctor_${Date.now()}@example.com`;
  const password = "StrongClinicPassword123!";

  await t.test("1. User Signup & Signin with real Supabase Auth", async () => {
    const signupRes = await fetch(`${BASE_URL}/api/v1/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName: "Dr. Sarah Lin" }),
    });
    assert.equal(signupRes.status, 201, "Signup must return HTTP 201 Created");
    const signupData = await signupRes.json();
    assert.ok(signupData.user?.id);
    userId = signupData.user.id;

    const signinRes = await fetch(`${BASE_URL}/api/v1/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(signinRes.status, 200, "Signin must return HTTP 200 OK");
    const signinData = await signinRes.json();
    assert.ok(signinData.session?.access_token);
    authHeader = `Bearer ${signinData.session.access_token}`;

    const setCookies = signinRes.headers.getSetCookie?.() || [];
    userCookie = setCookies.join("; ");
  });

  await t.test("2. Session hydration validates authentic database user", async () => {
    const sessionRes = await fetch(`${BASE_URL}/api/v1/auth/session`, {
      headers: { Authorization: authHeader },
    });
    assert.equal(sessionRes.status, 200);
    const sessionData = await sessionRes.json();
    assert.equal(sessionData.authenticated, true);
    assert.equal(sessionData.user.id, userId);
  });

  await t.test("3. Create assessment in database", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/assessments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        name: "Geriatric Suite 202",
        facilityName: "Sunrise Senior Health",
        spaceName: "Rehab Room B",
        environmentType: "rehab",
        notes: "Wheelchair turning and route accessibility audit",
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.assessment?.id);
    assessmentId = data.assessment.id;
  });

  await t.test("4. Upload genuine floorplan PNG binary to private storage", async () => {
    const realFloorplanPath = path.resolve(process.cwd(), "safespace-demo-floorplan-calibrated.png");
    assert.ok(fs.existsSync(realFloorplanPath), "Genuine PNG floorplan fixture must exist on disk");
    const realPngBytes = fs.readFileSync(realFloorplanPath);

    const formData = new FormData();
    const blob = new Blob([realPngBytes], { type: "image/png" });
    formData.append("file", blob, "safespace-demo-floorplan-calibrated.png");

    const mediaRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}/media`, {
      method: "POST",
      headers: { Authorization: authHeader },
      body: formData,
    });
    assert.equal(mediaRes.status, 201, "Media upload to private storage must return HTTP 201");
    const mediaData = await mediaRes.json();
    assert.ok(mediaData.asset?.id);
    assert.ok(mediaData.asset?.url);
    assert.equal(mediaData.asset.mimeType, "image/png");
    assert.equal(mediaData.asset.fileSizeBytes, realPngBytes.byteLength);
  });

  await t.test("5. Save calibrated geometry bundle via atomic RPC", async () => {
    const bundlePayload = {
      schemaVersion: 1,
      assessmentType: "user",
      metadata: {
        id: assessmentId,
        name: "Geriatric Suite 202",
        facilityName: "Sunrise Senior Health",
        spaceName: "Rehab Room B",
        environmentType: "rehab",
      },
      canonicalBoundary: [
        { x: 0, y: 0 },
        { x: 600, y: 0 },
        { x: 600, y: 600 },
        { x: 0, y: 600 },
      ],
      calibration: {
        pixelsPerCm: 1.0,
        realLength: 6.0,
        unit: "m",
        pixelDistance: 600,
        originPolicy: "canvas-origin-0-0",
      },
      activeProfileId: "walker",
      activeProfileSnapshot: {
        id: "walker",
        name: "Rollator Walker",
        description: "Standard mobility walker",
        minClearanceCm: 90,
        turningSpaceCm: 150,
        fallHistory: false,
        requiresSupport: true,
        lowLightSensitivity: "Moderate",
      },
      routeWaypoints: [
        { id: "wp-1", name: "Start", x: 100, y: 300, isMandatory: true },
        { id: "wp-2", name: "Mid", x: 300, y: 300, isMandatory: true },
        { id: "wp-3", name: "End", x: 500, y: 300, isMandatory: true },
      ],
      furniture: [
        {
          id: "chair-blocking",
          name: "Blocking Armchair",
          category: "chair",
          roomId: "room-1",
          x: 300,
          y: 275,
          width: 60,
          depth: 60,
          height: 80,
          rotation: 0,
          isFixed: false,
          isConfirmed: true,
          isStableSupport: false,
        },
      ],
    };

    const putRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(bundlePayload),
    });
    assert.equal(putRes.status, 200, "Atomic save must return HTTP 200 OK");
  });

  let candidateId = "";
  let sceneFingerprint = "";

  await t.test("6. Spatial Evaluation and Layout Optimization", async () => {
    // 6a. Evaluate
    const evalRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}/spatial/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        boundary: [
          { x: 0, y: 0 },
          { x: 600, y: 0 },
          { x: 600, y: 600 },
          { x: 0, y: 600 },
        ],
        furniture: [
          {
            id: "chair-blocking",
            name: "Blocking Armchair",
            category: "chair",
            roomId: "room-1",
            x: 300,
            y: 275,
            width: 60,
            depth: 60,
            height: 80,
            rotation: 0,
            isFixed: false,
            isConfirmed: true,
            isStableSupport: false,
          },
        ],
        routeWaypoints: [
          { id: "wp-1", name: "Start", x: 100, y: 300, isMandatory: true },
          { id: "wp-2", name: "Mid", x: 300, y: 300, isMandatory: true },
          { id: "wp-3", name: "End", x: 500, y: 300, isMandatory: true },
        ],
        calibration: {
          pixelsPerCm: 1.0,
          realLength: 6.0,
          unit: "m",
          pixelDistance: 600,
          originPolicy: "canvas-origin-0-0",
        },
        profile: {
          id: "walker",
          name: "Rollator Walker",
          description: "Standard mobility walker",
          minClearanceCm: 90,
          turningSpaceCm: 150,
          fallHistory: false,
          requiresSupport: true,
          lowLightSensitivity: "Moderate",
        },
      }),
    });
    assert.equal(evalRes.status, 200);

    // 6b. Optimize
    const optRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}/spatial/optimize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        boundary: [
          { x: 0, y: 0 },
          { x: 600, y: 0 },
          { x: 600, y: 600 },
          { x: 0, y: 600 },
        ],
        furniture: [
          {
            id: "chair-blocking",
            name: "Blocking Armchair",
            category: "chair",
            roomId: "room-1",
            x: 300,
            y: 275,
            width: 60,
            depth: 60,
            height: 80,
            rotation: 0,
            isFixed: false,
            isConfirmed: true,
            isStableSupport: false,
          },
        ],
        routeWaypoints: [
          { id: "wp-1", name: "Start", x: 100, y: 300, isMandatory: true },
          { id: "wp-2", name: "Mid", x: 300, y: 300, isMandatory: true },
          { id: "wp-3", name: "End", x: 500, y: 300, isMandatory: true },
        ],
        profile: {
          id: "walker",
          name: "Rollator Walker",
          description: "Standard mobility walker",
          minClearanceCm: 90,
          turningSpaceCm: 150,
          fallHistory: false,
          requiresSupport: true,
          lowLightSensitivity: "Moderate",
        },
      }),
    });
    assert.equal(optRes.status, 200);
    const optData = await optRes.json();
    assert.ok(optData.sceneFingerprint?.startsWith("v1:"));
    sceneFingerprint = optData.sceneFingerprint;
    assert.ok(optData.optimization?.candidates?.length > 0);
    candidateId = optData.optimization.candidates[0].id;
  });

  await t.test("7. Transactional Apply & Revert of Layout Candidate", async () => {
    // 7a. Reject stale apply if fingerprint mismatched
    const staleRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}/spatial/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        candidateId,
        sceneFingerprint: "v1:stale-invalid-fingerprint-00000000",
      }),
    });
    assert.equal(staleRes.status, 400, "Stale candidate apply with wrong fingerprint must be rejected");

    // 7b. Successful apply with matching authoritative fingerprint
    const applyRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}/spatial/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        candidateId,
        sceneFingerprint,
      }),
    });
    assert.equal(applyRes.status, 200, "Genuine candidate apply must return HTTP 200");

    // 7c. Revert candidate
    const revertRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}/spatial/revert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    });
    assert.equal(revertRes.status, 200, "Genuine candidate revert must return HTTP 200");
  });

  await t.test("8. Signout and recovery across new independent session", async () => {
    // Sign out
    const signoutRes = await fetch(`${BASE_URL}/api/v1/auth/signout`, {
      method: "POST",
      headers: { Authorization: authHeader },
    });
    assert.equal(signoutRes.status, 200);

    // Sign in anew
    const reLoginRes = await fetch(`${BASE_URL}/api/v1/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(reLoginRes.status, 200);
    const newSessionData = await reLoginRes.json();
    const newAuthHeader = `Bearer ${newSessionData.session.access_token}`;

    // Retrieve assessment bundle
    const getRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}`, {
      headers: { Authorization: newAuthHeader },
    });
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.assessment.metadata.id, assessmentId);
    assert.equal(getData.assessment.metadata.name, "Geriatric Suite 202");
    assert.equal(getData.assessment.hasFloorplanImage, true);
  });

  await t.test("9. Permanent Deletion cascades cleanly", async () => {
    const delRes = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}`, {
      method: "DELETE",
      headers: { Authorization: authHeader },
    });
    assert.equal(delRes.status, 200);

    const getAgain = await fetch(`${BASE_URL}/api/v1/assessments/${assessmentId}`, {
      headers: { Authorization: authHeader },
    });
    assert.equal(getAgain.status, 404, "Deleted assessment must return HTTP 404");
  });
});
