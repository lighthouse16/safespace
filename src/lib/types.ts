export type ID = string;
export type AssessmentStatus = "draft" | "analysis-complete" | "review-pending" | "approved";
export type Severity = "low" | "medium" | "high" | "critical";
export type WorkflowStep = "setup" | "import" | "model" | "profiles" | "routes" | "analysis" | "options" | "report";
export type Point = Readonly<{ x: number; y: number }>;

export interface Facility { id: ID; name: string; address: string; timezone: string; }
export interface RoomGeometry { id: ID; name: string; widthCm: number; lengthCm: number; wallThicknessCm: number; origin: Point; }
export type FurnitureKind = "chair" | "table" | "desk" | "cabinet" | "plant";
export interface Furniture { id: ID; roomId: ID; name: string; kind: FurnitureKind; position: Point; widthCm: number; depthCm: number; rotationDeg: number; movable: boolean; }
export interface MobilityProfile { id: ID; name: string; description: string; minimumClearanceCm: number; turningDiameterCm: number; verified: boolean; }
export interface Route { id: ID; name: string; roomId: ID; points: readonly Point[]; profileIds: readonly ID[]; critical: boolean; }
export interface Hazard { id: ID; roomId: ID; title: string; description: string; severity: Severity; position: Point; affectedProfileIds: readonly ID[]; measuredClearanceCm?: number; requiredClearanceCm?: number; confidence: number; recommendation: string; }
export interface ScenarioChange { furnitureId: ID; from: Point; to: Point; note: string; }
export interface Scenario { id: ID; name: string; objective: string; riskScore: number; estimatedCostHkd: number; effort: "low" | "medium" | "high"; disruption: "low" | "medium" | "high"; changes: readonly ScenarioChange[]; }
export interface Review { id: ID; assessmentId: ID; reviewer: string; role: string; status: "pending" | "approved" | "changes-requested" | "rejected" | "inspection-required"; dueAt: string; rationale?: string; snapshotVersion?: number; }
export interface Report { id: ID; assessmentId: ID; audience: "facility-manager" | "contractor" | "funding-partner"; generatedAt?: string; openRiskIds: readonly ID[]; disclaimer: string; }
export interface Assessment { id: ID; facilityId: ID; name: string; areaName: string; status: AssessmentStatus; step: WorkflowStep; owner: string; updatedAt: string; riskScore?: number; roomIds: readonly ID[]; profileIds: readonly ID[]; routeIds: readonly ID[]; hazardIds: readonly ID[]; scenarioIds: readonly ID[]; selectedScenarioId?: ID; version: number; }
export interface DomainData { facilities: Record<ID, Facility>; assessments: Record<ID, Assessment>; rooms: Record<ID, RoomGeometry>; furniture: Record<ID, Furniture>; profiles: Record<ID, MobilityProfile>; routes: Record<ID, Route>; hazards: Record<ID, Hazard>; scenarios: Record<ID, Scenario>; reviews: Record<ID, Review>; reports: Record<ID, Report>; }
