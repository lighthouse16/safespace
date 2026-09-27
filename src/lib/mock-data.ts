import type { DomainData } from "./types";

export const demoIds = { facility: "facility-queen-care", assessment: "assessment-queen-care", room: "room-waiting", profile: "profile-walker", route: "route-entry-reception", balancedScenario: "scenario-balanced" } as const;

export const mockData: DomainData = {
  facilities: { [demoIds.facility]: { id: demoIds.facility, name: "Harmony Elder Care Centre", address: "18 Queen's Road Central, Hong Kong", timezone: "Asia/Hong_Kong" } },
  assessments: { [demoIds.assessment]: { id: demoIds.assessment, facilityId: demoIds.facility, name: "Activity Room Safety Review", areaName: "Activity Room", status: "analysis-complete", step: "analysis", owner: "Maya Chen", updatedAt: "2026-09-26T16:40:00+08:00", riskScore: 68, roomIds: [demoIds.room], profileIds: [demoIds.profile], routeIds: [demoIds.route], hazardIds: ["hazard-chair", "hazard-corner"], scenarioIds: ["scenario-current", "scenario-minimum", demoIds.balancedScenario, "scenario-safety"], selectedScenarioId: demoIds.balancedScenario, version: 3 } },
  rooms: { [demoIds.room]: { id: demoIds.room, name: "Activity Room", widthCm: 720, lengthCm: 940, wallThicknessCm: 14, origin: { x: 0, y: 0 } } },
  furniture: {
    "chair-a": { id: "chair-a", roomId: demoIds.room, name: "Visitor chair A", kind: "chair", position: { x: 235, y: 270 }, widthCm: 58, depthCm: 62, rotationDeg: 0, movable: true },
    "chair-b": { id: "chair-b", roomId: demoIds.room, name: "Visitor chair B", kind: "chair", position: { x: 302, y: 270 }, widthCm: 58, depthCm: 62, rotationDeg: 0, movable: true },
    "reception-desk": { id: "reception-desk", roomId: demoIds.room, name: "Reception desk", kind: "desk", position: { x: 510, y: 96 }, widthCm: 180, depthCm: 72, rotationDeg: 0, movable: false }
  },
  profiles: { [demoIds.profile]: { id: demoIds.profile, name: "Older adult using walker", description: "Slower pace with a wheeled walking aid and increased turning clearance.", minimumClearanceCm: 90, turningDiameterCm: 150, verified: true } },
  routes: { [demoIds.route]: { id: demoIds.route, name: "Entrance to reception", roomId: demoIds.room, points: [{ x: 80, y: 860 }, { x: 220, y: 600 }, { x: 320, y: 380 }, { x: 520, y: 180 }], profileIds: [demoIds.profile], critical: true } },
  hazards: {
    "hazard-chair": { id: "hazard-chair", roomId: demoIds.room, title: "Chair blocks critical route", description: "Chair edge narrows route beside waiting seats.", severity: "high", position: { x: 260, y: 330 }, affectedProfileIds: [demoIds.profile], measuredClearanceCm: 54, requiredClearanceCm: 90, confidence: 0.94, recommendation: "Move chair A 55 cm toward west wall." },
    "hazard-corner": { id: "hazard-corner", roomId: demoIds.room, title: "Tight approach at reception", description: "Turning envelope overlaps reception desk corner.", severity: "medium", position: { x: 480, y: 225 }, affectedProfileIds: [demoIds.profile], measuredClearanceCm: 82, requiredClearanceCm: 90, confidence: 0.87, recommendation: "Rotate chair B and preserve a 96 cm route." }
  },
  scenarios: {
    "scenario-current": { id: "scenario-current", name: "Current layout", objective: "Baseline", riskScore: 68, estimatedCostHkd: 0, effort: "low", disruption: "low", changes: [] },
    "scenario-minimum": { id: "scenario-minimum", name: "Minimum cost", objective: "Reduce critical hazards without purchases", riskScore: 39, estimatedCostHkd: 0, effort: "low", disruption: "low", changes: [{ furnitureId: "chair-a", from: { x: 235, y: 270 }, to: { x: 150, y: 270 }, note: "Move chair away from route." }] },
    [demoIds.balancedScenario]: { id: demoIds.balancedScenario, name: "Balanced", objective: "Improve safety with limited disruption", riskScore: 27, estimatedCostHkd: 850, effort: "medium", disruption: "low", changes: [{ furnitureId: "chair-a", from: { x: 235, y: 270 }, to: { x: 145, y: 245 }, note: "Move chair toward west wall." }, { furnitureId: "chair-b", from: { x: 302, y: 270 }, to: { x: 220, y: 245 }, note: "Align seating outside route." }] },
    "scenario-safety": { id: "scenario-safety", name: "Maximum safety", objective: "Maximize route and turning clearance", riskScore: 18, estimatedCostHkd: 3200, effort: "high", disruption: "medium", changes: [{ furnitureId: "chair-a", from: { x: 235, y: 270 }, to: { x: 120, y: 220 }, note: "Relocate seating bank." }] }
  },
  reviews: { "review-queen-care": { id: "review-queen-care", assessmentId: demoIds.assessment, reviewer: "Dr. Adrian Lau", role: "Occupational Therapist", status: "pending", dueAt: "2026-09-29T17:00:00+08:00" } },
  reports: { "report-queen-care": { id: "report-queen-care", assessmentId: demoIds.assessment, audience: "facility-manager", openRiskIds: ["hazard-corner"], disclaimer: "Demo assessment only. Automated findings do not constitute professional certification." } }
};
