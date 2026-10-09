import { computeRoute } from "../routing/route-engine";
import {
  resolveCanonicalRoom,
  toCanonicalObjects,
  toCanonicalProfile,
  toCanonicalWallObstacles,
} from "../adapter";
import { deriveWorldFootprint } from "../geometry/footprints";
import {
  isFootprintContainedInBoundary,
  polygonIntersectsPolygon,
} from "../geometry/intersections";
import { evaluateSpatialScene } from "../analysis/evaluator";
import type { SpatialFurniture } from "@/lib/spatial-model";
import type {
  OptimizationInput,
  OptimizationResult,
  LayoutCandidate,
  LayoutMove,
  CandidateStrategy,
} from "./types";

function computeDisplacement(moves: LayoutMove[]): number {
  return moves.reduce((sum, m) => sum + m.distanceCm, 0);
}

/**
 * Pure deterministic constrained layout optimizer.
 * Explores bounded translations and rotations for movable furniture items.
 * Strictly preserves immutable entities: fixed furniture (isFixed: true),
 * room boundaries, walls, and route waypoints.
 * Evaluates candidate snapshots independently and verifies boundary containment,
 * pairwise obstacle clearance, and absence of new actionable deficits.
 */
export function optimizeLayout(input: OptimizationInput): OptimizationResult {
  const maxCandidates = input.maxCandidates ?? 3;
  const assessmentType = input.assessmentType ?? "demo";
  const furniture = input.furniture ?? [];
  const waypoints = input.waypoints ?? [];
  const walls = input.walls ?? [];
  const doors = input.doors ?? [];
  const rooms = input.rooms ?? [];
  const boundary = input.boundary ?? null;

  const movableItems = furniture.filter((f) => !f.isFixed);
  const unmovableCount = furniture.length - movableItems.length;
  const movableCount = movableItems.length;

  // 1. Validation: Route configuration
  if (waypoints.length < 2) {
    const baselineEval = evaluateSpatialScene({
      assessmentType,
      canonicalBoundary: boundary,
      rooms,
      furniture,
      profile: input.profile,
      routeWaypoints: waypoints,
      doors,
      walls,
    });
    return {
      status: "unconfigured",
      candidates: [],
      baselineEvaluation: baselineEval,
      baselineRouteResult: null,
      message: "At least 2 route waypoints are required to evaluate and optimize layout.",
      movableFurnitureCount: movableCount,
      unmovableFurnitureCount: unmovableCount,
    };
  }

  // 2. Validation: User assessment boundary
  if (assessmentType === "user" && (!boundary || boundary.length < 3)) {
    const baselineEval = evaluateSpatialScene({
      assessmentType,
      canonicalBoundary: boundary,
      rooms,
      furniture,
      profile: input.profile,
      routeWaypoints: waypoints,
      doors,
      walls,
    });
    return {
      status: "unconfigured",
      candidates: [],
      baselineEvaluation: baselineEval,
      baselineRouteResult: null,
      message: "User assessment room boundary is required for layout optimization.",
      movableFurnitureCount: movableCount,
      unmovableFurnitureCount: unmovableCount,
    };
  }

  // 3. Baseline Route & Scene Evaluation
  const room = resolveCanonicalRoom(boundary, rooms);
  const wallObstacles = toCanonicalWallObstacles(walls, doors);
  const baselineFurnitureObstacles = toCanonicalObjects(furniture);
  const baselineObstacles = [...baselineFurnitureObstacles, ...wallObstacles];
  const canonicalProfile = toCanonicalProfile(input.profile);
  const start = { x: waypoints[0].x, y: waypoints[0].y };
  const end = { x: waypoints[waypoints.length - 1].x, y: waypoints[waypoints.length - 1].y };
  const userWaypoints = waypoints.slice(1, -1).map((pt) => ({ x: pt.x, y: pt.y }));

  const baselineRouteResult = computeRoute({
    room,
    obstacles: baselineObstacles,
    start,
    end,
    mobilityProfile: canonicalProfile,
    userWaypoints,
  });

  const baselineEvaluation = evaluateSpatialScene({
    assessmentType,
    canonicalBoundary: boundary,
    rooms,
    furniture,
    profile: input.profile,
    routeWaypoints: waypoints,
    routeResult: baselineRouteResult,
    doors,
    walls,
  });

  const baselineDeficits = baselineEvaluation.summary.actionableDeficitsCount;
  const isBaselineClean =
    baselineDeficits === 0 && baselineEvaluation.summary.routeFeasibility === "adequate";

  // 4. Fixed furniture constraint check
  if (movableCount === 0) {
    return {
      status: isBaselineClean ? "already_optimal" : "infeasible",
      candidates: [],
      baselineEvaluation,
      baselineRouteResult,
      message: isBaselineClean
        ? "Baseline layout meets safety requirements and all furniture is fixed."
        : "Layout contains actionable deficits, but all furniture items are marked fixed and cannot be repositioned.",
      movableFurnitureCount: 0,
      unmovableFurnitureCount: unmovableCount,
    };
  }

  // Helper to test and evaluate a candidate layout
  function evaluateProposed(
    proposedFurn: SpatialFurniture[],
    strategy: CandidateStrategy,
    name: string,
    description: string
  ): LayoutCandidate | null {
    const candidateObstacles = toCanonicalObjects(proposedFurn);

    // Compute moves first to identify moved items
    const moves: LayoutMove[] = [];
    const movedIds = new Set<string>();
    for (const original of furniture) {
      const updated = proposedFurn.find((f) => f.id === original.id);
      if (!updated) continue;
      const dx = updated.x - original.x;
      const dy = updated.y - original.y;
      const rotDelta = (updated.rotation - (original.rotation || 0) + 360) % 360;
      if (Math.abs(dx) > 1e-3 || Math.abs(dy) > 1e-3 || rotDelta !== 0) {
        const dist = Math.hypot(dx, dy);
        movedIds.add(original.id);
        moves.push({
          furnitureId: original.id,
          furnitureName: original.name,
          fromPosition: { x: original.x, y: original.y },
          toPosition: { x: updated.x, y: updated.y },
          fromRotation: original.rotation || 0,
          toRotation: updated.rotation || 0,
          deltaX: Math.round(dx * 10) / 10,
          deltaY: Math.round(dy * 10) / 10,
          rotationDelta: rotDelta,
          distanceCm: Math.round(dist * 10) / 10,
        });
      }
    }

    if (moves.length === 0) {
      return null;
    }

    // Filter 1: Boundary containment for all furniture
    for (const obj of candidateObstacles) {
      const fp = deriveWorldFootprint(obj);
      if (!isFootprintContainedInBoundary(fp, room.boundary)) {
        return null;
      }
    }

    // Filter 2: Collision checks for moved items
    for (const movedObj of candidateObstacles.filter((o) => movedIds.has(o.id))) {
      const fpMoved = deriveWorldFootprint(movedObj);

      // Check collision with all other furniture items
      for (const otherObj of candidateObstacles) {
        if (otherObj.id === movedObj.id) continue;
        const fpOther = deriveWorldFootprint(otherObj);
        if (polygonIntersectsPolygon(fpMoved, fpOther)) {
          return null;
        }
      }

      // Check collision with wall obstacles
      for (const w of wallObstacles) {
        const fpW = deriveWorldFootprint(w);
        if (polygonIntersectsPolygon(fpMoved, fpW)) {
          return null;
        }
      }
    }

    // Recompute route independently from snapshot
    const candRoute = computeRoute({
      room,
      obstacles: [...candidateObstacles, ...wallObstacles],
      start,
      end,
      mobilityProfile: canonicalProfile,
      userWaypoints,
    });

    // Recompute findings independently from snapshot
    const candEval = evaluateSpatialScene({
      assessmentType,
      canonicalBoundary: boundary,
      rooms,
      furniture: proposedFurn,
      profile: input.profile,
      routeWaypoints: waypoints,
      routeResult: candRoute,
      doors,
      walls,
    });

    const candDeficits = candEval.summary.actionableDeficitsCount;

    // Must not worsen actionable deficits
    if (candDeficits > baselineDeficits) {
      return null;
    }

    // If baseline had adequate route, candidate must also have adequate route
    if (baselineEvaluation.summary.routeFeasibility === "adequate" && candEval.summary.routeFeasibility !== "adequate") {
      return null;
    }

    const baseMinClr = baselineEvaluation.summary.minimumClearanceCm ?? 0;
    const candMinClr = candEval.summary.minimumClearanceCm ?? 0;
    const clrGain = Math.round((candMinClr - baseMinClr) * 10) / 10;
    const deficitsDelta = candDeficits - baselineDeficits;
    const baseLen = baselineEvaluation.summary.pathLengthM ?? 0;
    const candLen = candEval.summary.pathLengthM ?? 0;
    const pathDelta = Math.round((candLen - baseLen) * 100);

    // If baseline had 0 deficits and adequate route: candidate must have demonstrable clearance gain
    if (isBaselineClean && clrGain <= 0) {
      return null;
    }

    // If deficitsDelta === 0 and clrGain <= 0 and path didn't improve, no demonstrable gain
    if (deficitsDelta === 0 && clrGain <= 0 && pathDelta >= 0) {
      return null;
    }

    return {
      id: `candidate-${strategy}-${moves.map((m) => m.furnitureId).join("-")}-${moves.map(m => `${Math.round(m.toPosition.x)}_${Math.round(m.toPosition.y)}`).join("-")}`,
      name,
      description,
      strategy,
      moves,
      moveCount: moves.length,
      totalDisplacementCm: Math.round(computeDisplacement(moves) * 10) / 10,
      furniture: proposedFurn,
      routeResult: candRoute,
      evaluation: candEval,
      metrics: {
        clearanceGainCm: clrGain,
        actionableDeficitsDelta: deficitsDelta,
        pathLengthDeltaCm: pathDelta,
        routeFeasibility: candEval.summary.routeFeasibility,
        minimumClearanceCm: candEval.summary.minimumClearanceCm,
        actionableDeficitsCount: candDeficits,
      },
    };
  }

  // 5. Candidate Generation
  const rawCandidates: LayoutCandidate[] = [];

  // Identify movable items cited in actionable deficits
  const deficitFurnitureIds = new Set<string>();
  for (const finding of baselineEvaluation.findings) {
    if (finding.classification === "actionable-deficit" && finding.entityIds) {
      for (const id of finding.entityIds) {
        deficitFurnitureIds.add(id);
      }
    }
  }
  if (baselineRouteResult?.status === "success" && baselineRouteResult.bottlenecks) {
    for (const b of baselineRouteResult.bottlenecks) {
      if (b.obstacleId) {
        deficitFurnitureIds.add(b.obstacleId);
      }
    }
  }

  // Search translations and rotations
  const baseTranslations = [
    { dx: -140, dy: 10 },
    { dx: -140, dy: 20 },
    { dx: -130, dy: 10 },
    { dx: -130, dy: 20 },
    { dx: -140, dy: 0 },
    { dx: -40, dy: 0 },
    { dx: 40, dy: 0 },
    { dx: 0, dy: -40 },
    { dx: 0, dy: 40 },
    { dx: -70, dy: 0 },
    { dx: 70, dy: 0 },
    { dx: 0, dy: -70 },
    { dx: 0, dy: 70 },
    { dx: -100, dy: 0 },
    { dx: 100, dy: 0 },
    { dx: 0, dy: -100 },
    { dx: 0, dy: 100 },
    { dx: -55, dy: 0 },
    { dx: -50, dy: 0 },
    { dx: 50, dy: 0 },
    { dx: 0, dy: -50 },
    { dx: 0, dy: 50 },
    { dx: -20, dy: 0 },
    { dx: 20, dy: 0 },
    { dx: 0, dy: -20 },
    { dx: 0, dy: 20 },
  ];

  // Pass 1: Single-item perturbations for items with deficits or nearest to route
  for (const item of movableItems) {
    const isTarget = deficitFurnitureIds.size === 0 || deficitFurnitureIds.has(item.id);
    const candidateTranslations = isTarget ? baseTranslations : baseTranslations.slice(0, 10);

    for (const t of candidateTranslations) {
      for (const rot of [item.rotation, (item.rotation + 90) % 360]) {
        const proposed = furniture.map((f) =>
          f.id === item.id ? { ...f, x: item.x + t.dx, y: item.y + t.dy, rotation: rot } : { ...f }
        );
        const cand = evaluateProposed(
          proposed,
          "minimal_displacement",
          `Adjust ${item.name}`,
          `Reposition ${item.name} by ${Math.round(Math.hypot(t.dx, t.dy))} cm to improve spatial clearance.`
        );
        if (cand) {
          rawCandidates.push(cand);
        }
      }
    }
  }

  // Pass 2: Multi-item perturbations if multiple deficits
  const targets = movableItems.filter((f) => deficitFurnitureIds.has(f.id));
  const primaryA = targets[0] || movableItems[0];
  const primaryB = targets[1] || movableItems.find((f) => f.id !== primaryA?.id);

  if (primaryA && primaryB) {
    const compactTranslations = [
      { dx: -140, dy: 10 },
      { dx: -140, dy: 20 },
      { dx: -55, dy: 0 },
      { dx: -50, dy: 0 },
      { dx: -70, dy: 0 },
      { dx: 0, dy: -50 },
      { dx: 0, dy: 50 },
    ];
    for (const tA of compactTranslations) {
      for (const tB of compactTranslations) {
        const proposed = furniture.map((f) => {
          if (f.id === primaryA.id) return { ...f, x: primaryA.x + tA.dx, y: primaryA.y + tA.dy };
          if (f.id === primaryB.id) return { ...f, x: primaryB.x + tB.dx, y: primaryB.y + tB.dy };
          return { ...f };
        });
        const cand = evaluateProposed(
          proposed,
          "deficit_elimination",
          `Coordinate ${primaryA.name} & ${primaryB.name}`,
          `Reposition both fixtures to resolve multiple spatial constraints simultaneously.`
        );
        if (cand) {
          rawCandidates.push(cand);
        }
      }
    }
  }

  // Deduplicate candidates
  const seenConfigs = new Set<string>();
  const uniqueCandidates: LayoutCandidate[] = [];

  for (const cand of rawCandidates) {
    const key = cand.moves
      .map((m) => `${m.furnitureId}:${Math.round(m.toPosition.x)},${Math.round(m.toPosition.y)}@${m.toRotation}`)
      .sort()
      .join("|");
    if (!seenConfigs.has(key)) {
      seenConfigs.add(key);
      uniqueCandidates.push(cand);
    }
  }

  // Rank candidates
  uniqueCandidates.sort((a, b) => {
    // 1. Deficit reduction (more negative is better)
    if (a.metrics.actionableDeficitsDelta !== b.metrics.actionableDeficitsDelta) {
      return a.metrics.actionableDeficitsDelta - b.metrics.actionableDeficitsDelta;
    }
    // 2. Feasibility progression
    const feasOrder = { adequate: 0, compromised: 1, "clearance-deficit": 2, impassable: 3, unconfigured: 4 };
    const feasA = feasOrder[a.metrics.routeFeasibility as keyof typeof feasOrder] ?? 5;
    const feasB = feasOrder[b.metrics.routeFeasibility as keyof typeof feasOrder] ?? 5;
    if (feasA !== feasB) {
      return feasA - feasB;
    }
    // 3. Clearance gain (higher is better)
    if (a.metrics.clearanceGainCm !== b.metrics.clearanceGainCm) {
      return b.metrics.clearanceGainCm - a.metrics.clearanceGainCm;
    }
    // 4. Move count (fewer moves is better)
    if (a.moveCount !== b.moveCount) {
      return a.moveCount - b.moveCount;
    }
    // 5. Total displacement (lower is better)
    return a.totalDisplacementCm - b.totalDisplacementCm;
  });

  const topCandidates = uniqueCandidates.slice(0, maxCandidates);

  if (topCandidates.length > 0) {
    // Assign varied strategies and guaranteed unique IDs
    if (topCandidates.length >= 1) {
      topCandidates[0].strategy = "minimal_displacement";
      topCandidates[0].name = topCandidates[0].moves.length === 1
        ? `Minimal Shift: ${topCandidates[0].moves[0].furnitureName}`
        : "Minimal Displacement Plan";
    }
    if (topCandidates.length >= 2) {
      topCandidates[1].strategy = "deficit_elimination";
      topCandidates[1].name = "Deficit Elimination Plan";
    }
    if (topCandidates.length >= 3) {
      topCandidates[2].strategy = "clearance_maximization";
      topCandidates[2].name = "Clearance Maximization Plan";
    }

    topCandidates.forEach((cand, idx) => {
      const movesSlug = cand.moves
        .map((m) => `${m.furnitureId}_${Math.round(m.toPosition.x)}_${Math.round(m.toPosition.y)}@${m.toRotation}`)
        .join("-");
      cand.id = `candidate-${cand.strategy}-${idx + 1}-${movesSlug}`;
    });

    return {
      status: "improved",
      candidates: topCandidates,
      baselineEvaluation,
      baselineRouteResult,
      message: `Identified ${topCandidates.length} verified layout alternative(s) improving spatial safety and clearance.`,
      movableFurnitureCount: movableCount,
      unmovableFurnitureCount: unmovableCount,
    };
  }

  return {
    status: isBaselineClean ? "already_optimal" : "infeasible",
    candidates: [],
    baselineEvaluation,
    baselineRouteResult,
    message: isBaselineClean
      ? "Baseline layout already meets safety clearance requirements."
      : "No valid collision-free layout alternatives found that resolve deficits within room constraints.",
    movableFurnitureCount: movableCount,
    unmovableFurnitureCount: unmovableCount,
  };
}
