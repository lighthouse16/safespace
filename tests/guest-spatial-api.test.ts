import test from "node:test";
import assert from "node:assert/strict";
import { POST as evaluate } from "@/app/api/spatial/evaluate/route";
import { POST as optimize } from "@/app/api/spatial/optimize/route";
import { runServerEvaluation } from "@/lib/server/spatial/evaluator-service";

const boundary = [{x:0,y:0},{x:600,y:0},{x:600,y:400},{x:0,y:400}];
const routeWaypoints = [
  { id:"start", name:"Entrance", x:110,y:200,isMandatory:true },
  { id:"end", name:"Exit", x:490,y:200,isMandatory:true },
];
const profile = {
  id:"walker",name:"Walker",description:"Example mobility envelope",
  minClearanceCm:90,turningSpaceCm:150,fallHistory:false,
  requiresSupport:true,lowLightSensitivity:"Moderate" as const,
};
const wall = {id:"partition",start:{x:300,y:0},end:{x:300,y:400},thickness:12,isExterior:false};
const body = {units:"cm" as const,boundary,furniture:[],routeWaypoints,profile,walls:[] as typeof wall[]};
const req=(url:string,payload:unknown,headers:Record<string,string>={})=>new Request("http://localhost"+url,{method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(payload)});
test("Guest stateless API returns real 2D route result without authentication",async()=>{
 const response=await evaluate(req("/api/spatial/evaluate",body));
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.source,"deterministic-server-spatial-engine");
 assert.equal(data.stored,false);
 assert.equal(data.evaluation.summary.routeFeasibility,"adequate");
 assert.ok(data.evaluation.summary.pathLengthM>0);
 assert.ok(data.evaluation.summary.minimumClearanceCm>0);
 assert.match(data.limitations,/turning/i);
});
test("Full-height partition invalidates route both in guest API and server wrapper",async()=>{
 const walled={...body,walls:[wall]};
 const response=await evaluate(req("/api/spatial/evaluate",walled));
 assert.equal(response.status,200);
 const data=await response.json();
 assert.notEqual(data.evaluation.summary.routeFeasibility,"adequate");
 const srv=await runServerEvaluation({
   assessmentType:"user",boundary,furniture:[],waypoints:routeWaypoints,walls:[wall],profile,persistResult:false,
 });
 assert.equal(srv.success,true);
 assert.deepEqual(data.evaluation.summary.routeFeasibility,srv.result?.summary.routeFeasibility);
 assert.equal(data.evaluation.summary.minimumClearanceCm,null);
});
test("Optimization fingerprint includes walls and keeps blocked partition",async()=>{
 const bare=await optimize(req("/api/spatial/optimize",{scene:body,maxCandidates:2,maxEvaluations:8}));
 const walled=await optimize(req("/api/spatial/optimize",{scene:{...body,walls:[wall]},maxCandidates:2,maxEvaluations:8}));
 assert.equal(bare.status,200);
 assert.equal(walled.status,200);
 const a=await bare.json(), b=await walled.json();
 assert.notEqual(a.sceneFingerprint,b.sceneFingerprint);
 assert.notEqual(b.optimization.baselineEvaluation.summary.routeFeasibility,"adequate");
 assert.deepEqual(b.optimization.candidates,[]);
 assert.equal(b.stored,false);
});
test("Guest route fails closed on bad units, geometry, oversized inputs and origin",async()=>{
 for (const payload of [{...body,units:"px"},{...body,walls:[{...wall,thickness:-1}]},{...body,boundary:[{x:0,y:0},{x:3000,y:0},{x:3000,y:300},{x:0,y:300}]}]) {
  const response=await evaluate(req("/api/spatial/evaluate",payload));
  assert.equal(response.status,400);
 }
 const badOrigin=await evaluate(req("/api/spatial/evaluate",body,{Origin:"https://unknown.example"}));
 assert.equal(badOrigin.status,403);
 const huge=await evaluate(req("/api/spatial/evaluate",{...body,note:"X".repeat(150000)}));
 assert.equal(huge.status,413);
});
