import type { Point2D } from "../schema";

export type SpatialFindingKind =
  | "route-unconfigured"
  | "route-unreachable"
  | "route-clearance-deficit"
  | "route-clearance-adequate"
  | "route-deficit"
  | "route-adequate"
  | "route-bottleneck"
  | "route-out-of-bounds"
  | "route-invalid-geometry"
  | "route-endpoint-blocked"
  | "obstacle-collision"
  | "obstacle-encroachment"
  | "boundary-encroachment"
  | "unassessed-category";

export type SpatialFindingStatus =
  | "observed"
  | "not-observed"
  | "unknown"
  | "needs-review";

export type SpatialFindingClassification =
  | "actionable-deficit"
  | "advisory-observation"
  | "unassessed-scope";

export type EvidenceSource =
  | "computed-geometry"
  | "user-measured"
  | "unverified-demo"
  | "unassessed"
  | "authoring-state";

export interface FindingEvidence {
  measuredValue?: number;
  measuredQuantity?: string;
  requiredQuantity?: string;
  margin?: string;
  failureReason?: string;
  unit?: "cm" | "m" | "count";
  label: string;
  source: EvidenceSource;
  rawEvidenceString: string;
}

export interface FindingRequirement {
  targetValue: number;
  unit: "cm" | "m";
  label: string;
  sourceDescription: string;
}

export interface SuggestedAction {
  type:
    | "reposition-obstacle"
    | "configure-route"
    | "adjust-mobility-profile"
    | "onsite-inspection"
    | "none";
  label: string;
}

export interface SpatialFinding {
  id: string;
  kind: SpatialFindingKind;
  status: SpatialFindingStatus;
  classification: SpatialFindingClassification;
  severity?: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  recommendation?: string;
  entityIds?: string[];
  location?: Point2D;
  segmentIndex?: number;
  evidence: FindingEvidence;
  requirement?: FindingRequirement;
  reviewNeeded: boolean;
  uncertaintyExplanation?: string;
  suggestedAction?: SuggestedAction;
}

export interface SpatialEvaluationSummary {
  actionableDeficitsCount: number;
  advisoryObservationsCount: number;
  unassessedCategoriesCount: number;
  unassessedScopeCount: number;
  routeFeasibility:
    | "unconfigured"
    | "invalid-geometry"
    | "out-of-bounds"
    | "unreachable"
    | "clearance-deficit"
    | "adequate";
  minimumClearanceCm: number | null;
  requiredClearanceRadiusCm: number | null;
  corridorWidthCm: number | null;
  corridorClearanceWidthCm?: number | null;
  pathLengthM: number | null;
  overallStatusLabel: string;
}

export interface SpatialEvaluationResult {
  evaluatedAt: string;
  assessmentType: "demo" | "user";
  sceneLabel: string;
  findings: SpatialFinding[];
  summary: SpatialEvaluationSummary;
}
