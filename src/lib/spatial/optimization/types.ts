import type { Point2D, Polygon2D } from "../schema";
import type { RouteResult } from "../routing/types";
import type {
  SpatialFurniture,
  SpatialRoom,
  SpatialWall,
  SpatialDoor,
  MobilityProfileData,
} from "@/lib/spatial-model";
import type { SpatialEvaluationResult, SpatialEvaluationSummary } from "../analysis/types";

export interface LayoutMove {
  furnitureId: string;
  furnitureName: string;
  fromPosition: Point2D;
  toPosition: Point2D;
  fromRotation: number;
  toRotation: number;
  deltaX: number;
  deltaY: number;
  rotationDelta: number;
  distanceCm: number;
}

export type CandidateStrategy =
  | "deficit_elimination"
  | "clearance_maximization"
  | "minimal_displacement";

export interface LayoutCandidateMetrics {
  clearanceGainCm: number | null;
  becameFeasible: boolean;
  actionableDeficitsDelta: number;
  pathLengthDeltaCm: number | null;
  routeFeasibility: SpatialEvaluationSummary["routeFeasibility"];
  minimumClearanceCm: number | null;
  actionableDeficitsCount: number;
}

export interface LayoutCandidate {
  id: string;
  name: string;
  description: string;
  strategy: CandidateStrategy;
  moves: LayoutMove[];
  moveCount: number;
  totalDisplacementCm: number;
  furniture: SpatialFurniture[];
  routeResult: RouteResult;
  evaluation: SpatialEvaluationResult;
  metrics: LayoutCandidateMetrics;
}

export type OptimizationStatus =
  | "improved"
  | "already_optimal"
  | "infeasible"
  | "unconfigured";

export interface OptimizationComputeBudget {
  maxEvaluations: number;
  evaluatedCount: number;
  prunedCount: number;
  budgetExhausted: boolean;
}

export interface OptimizationResult {
  status: OptimizationStatus;
  candidates: LayoutCandidate[];
  baselineEvaluation: SpatialEvaluationResult;
  baselineRouteResult: RouteResult | null;
  message: string;
  movableFurnitureCount: number;
  unmovableFurnitureCount: number;
  sceneFingerprint: string;
  computeBudget: OptimizationComputeBudget;
}

export interface OptimizationInput {
  furniture: readonly SpatialFurniture[];
  rooms?: readonly SpatialRoom[];
  walls?: readonly SpatialWall[];
  doors?: readonly SpatialDoor[];
  waypoints: readonly { id: string; name?: string; x: number; y: number; isMandatory?: boolean }[];
  profile: MobilityProfileData;
  boundary?: Polygon2D | null;
  assessmentType?: "demo" | "user";
  maxCandidates?: number;
  maxEvaluations?: number;
}
