import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { join } from "node:path";

const port = Number(process.env.SAFESPACE_SPATIAL_SMOKE_PORT || 3079);
const base = "http://127.0.0.1:" + port;
const next = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [next, "start", "-p", String(port)], {
  cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS: "false" },
});
let output = "";
server.stdout.on("data", (chunk) => output += String(chunk));
server.stderr.on("data", (chunk) => output += String(chunk));

async function ready() {
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    try {
      const r = await fetch(base + "/api/spatial/evaluate", { method: "OPTIONS", signal: AbortSignal.timeout(1200) });
      if (r.status === 204) return;
    } catch { /* starting */ }
    if (server.exitCode !== null) throw new Error("Server exited:\n" + output.slice(-1000));
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Server start timeout:\n" + output.slice(-1000));
}
const boundary = [{ x:0,y:0 },{ x:600,y:0 },{ x:600,y:400 },{ x:0,y:400 }];
const waypoints = [{ id:"a",name:"Entrance",x:100,y:200,isMandatory:true },{ id:"b",name:"Exit",x:500,y:200,isMandatory:true }];
const profile = { id:"walker",name:"Rollator",description:"",minClearanceCm:90,turningSpaceCm:150,fallHistory:false,requiresSupport:true,lowLightSensitivity:"Moderate" };
const baseScene = { units:"cm",boundary,furniture:[],routeWaypoints:waypoints,profile,walls:[] };
const divider = { id:"full-height",start:{x:300,y:0},end:{x:300,y:400},thickness:12,isExterior:false };
async function post(path,payload) {
  const response = await fetch(base + path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  return {status:response.status,body:await response.json()};
}
try {
  await ready();
  const open = await post("/api/spatial/evaluate",baseScene);
  assert.equal(open.status,200);
  assert.equal(open.body.evaluation.summary.routeFeasibility,"adequate");
  const blocked = await post("/api/spatial/evaluate",{...baseScene,walls:[divider]});
  assert.equal(blocked.status,200);
  assert.notEqual(blocked.body.evaluation.summary.routeFeasibility,"adequate");
  const optimized = await post("/api/spatial/optimize",{scene:{...baseScene,walls:[divider]},maxCandidates:2,maxEvaluations:6});
  assert.equal(optimized.status,200);
  assert.notEqual(optimized.body.optimization.baselineEvaluation.summary.routeFeasibility,"adequate");
  assert.deepEqual(optimized.body.optimization.candidates,[]);
  const invalid = await post("/api/spatial/evaluate",{...baseScene,units:"px"});
  assert.equal(invalid.status,400);
  console.log("GUEST SPATIAL HTTP PASS: real Next routes, feasible vs divider-blocked, optimizer constraints, invalid units.");
} catch (error) {
  console.error("GUEST SPATIAL HTTP FAIL",error);
  process.exitCode = 1;
} finally {
  server.kill();
}
