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
 * Computes a deterministic string signature of the current scene geometry and profile.
 * Used for cache validation and rejecting stale optimization candidates on Apply.
 */
export function computeSceneFingerprint(input: {
  furniture: readonly SpatialFurniture[];
  waypoints: readonly { id: string; x: number; y: number }[];
  boundary?: readonly { x: number; y: number }[] | null;
  profileId?: string;
  minClearanceCm?: number;
}): string {
  const furnSig = input.furniture
    .map(
      (f) =>
        `${f.id}:${Math.round(f.x)}:${Math.round(f.y)}:${Math.round(f.rotation || 0)}:${Math.round(f.width)}:${Math.round(f.depth)}:${f.isFixed ? 1 : 0}`
    )
    .sort()
    .join(";");
  const wpSig = input.waypoints
    .map((w) => `${w.id}:${Math.round(w.x)}:${Math.round(w.y)}`)
    .join(";");
  const bndSig = input.boundary
    ? input.boundary.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(";")
    : "none";
  const profSig = `${input.profileId || ""}:${input.minClearanceCm || 0}`;
  return `${furnSig}|${wpSig}|${bndSig}|${profSig}`;
}

/**
 * Pure deterministic constrained layout optimizer.
 * Explores bounded translations and rotations for movable furniture items.
 * Strictly preserves immutable entities: fixed furniture (isFixed: true),
 * room boundaries, walls, and route waypoints.
 * Evaluates candidate snapshots independently and verifies boundary containment,
 * pairwise obstacle clearance, route non-regression, and absence of new actionable deficits.
 * Enforces a hard deterministic computation budget.
 */
export function optimizeLayout(input: OptimizationInput): OptimizationResult {
  const maxCandidates = input.maxCandidates ?? 3;
  const maxEvaluations = input.maxEvaluations ?? 60;
  const assessmentType = input.assessmentType ?? "demo";
  const furniture = input.furniture ?? [];
  const waypoints = input.waypoints ?? [];
  const walls = input.walls ?? [];
  const doors = input.doors ?? [];
  const rooms = input.rooms ?? [];
  const boundary = input.boundary ?? null;

  const NON_BLOCKING = new Set(["mat", "light", "handrail"]);
  const movableItems = furniture.filter((f) => !f.isFixed && !NON_BLOCKING.has(f.category));
  const unmovableCount = furniture.length - movableItems.length;
  const movableCount = movableItems.length;

  const sceneFingerprint = computeSceneFingerprint({
    furniture,
    waypoints,
    boundary,
    profileId: input.profile.id,
    minClearanceCm: input.profile.minClearanceCm,
  });

  let evaluatedCount = 0;
  let prunedCount = 0;
  let budgetExhausted = false;

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
      sceneFingerprint,
      computeBudget: { maxEvaluations, evaluatedCount: 0, prunedCount: 0, budgetExhausted: false },
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
      sceneFingerprint,
      computeBudget: { maxEvaluations, evaluatedCount: 0, prunedCount: 0, budgetExhausted: false },
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

  // Actionable signatures present in baseline
  const baselineActionableSigs = new Set(
    baselineEvaluation.findings
      .filter((f) => f.classification === "actionable-deficit")
      .map((f) => `${f.kind}:${(f.entityIds || []).slice().sort().join(",")}`)
  );

  // 4. Fixed furniture constraint check
  if (movableCount === 0) {
    return {
      status: isBaselineClean ? "already_optimal" : "infeasible",
      candidates: [],
      baselineEvaluation,
      baselineRouteResult,
      message: isBaselineClean
        ? `Baseline configuration satisfies configured profile clearance target (${input.profile.minClearanceCm} cm). No changes required.`
        : "Layout contains actionable deficits, but all furniture items are marked fixed and cannot be repositioned.",
      movableFurnitureCount: 0,
      unmovableFurnitureCount: unmovableCount,
      sceneFingerprint,
      computeBudget: { maxEvaluations, evaluatedCount: 0, prunedCount: 0, budgetExhausted: false },
    };
  }

  // Helper to test and evaluate a candidate layout
  function evaluateProposed(proposedFurn: SpatialFurniture[]): LayoutCandidate | null {
    if (evaluatedCount >= maxEvaluations) {
      budgetExhausted = true;
      return null;
    }

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
      prunedCount++;
      return null;
    }

    // Constraint 1: Strict boundary containment for all candidate furniture
    for (const obj of candidateObstacles) {
      const fp = deriveWorldFootprint(obj);
      if (!isFootprintContainedInBoundary(fp, room.boundary)) {
        prunedCount++;
        return null;
      }
    }

    // Constraint 2: Collision checks for moved items
    for (const movedObj of candidateObstacles.filter((o) => movedIds.has(o.id))) {
      const fpMoved = deriveWorldFootprint(movedObj);

      // Check collision with other furniture items
      for (const otherObj of candidateObstacles) {
        if (otherObj.id === movedObj.id) continue;
        const fpOther = deriveWorldFootprint(otherObj);
        if (polygonIntersectsPolygon(fpMoved, fpOther)) {
          prunedCount++;
          return null;
        }
      }

      // Check collision with wall obstacles
      for (const w of wallObstacles) {
        const fpW = deriveWorldFootprint(w);
        if (polygonIntersectsPolygon(fpMoved, fpW)) {
          prunedCount++;
          return null;
        }
      }
    }

    evaluatedCount++;

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

    // Constraint 3: Deficit non-regression (must not increase total actionable deficits)
    if (candDeficits > baselineDeficits) {
      prunedCount++;
      return null;
    }

    // Constraint 4: Route feasibility non-regression
    // If baseline had adequate route, candidate MUST have adequate route
    if (
      baselineEvaluation.summary.routeFeasibility === "adequate" &&
      candEval.summary.routeFeasibility !== "adequate"
    ) {
      prunedCount++;
      return null;
    }
    // If baseline was clearance-deficit, candidate must NOT regress to unreachable or invalid-geometry
    if (
      baselineEvaluation.summary.routeFeasibility === "clearance-deficit" &&
      (candEval.summary.routeFeasibility === "unreachable" ||
        candEval.summary.routeFeasibility === "invalid-geometry" ||
        candEval.summary.routeFeasibility === "out-of-bounds")
    ) {
      prunedCount++;
      return null;
    }

    // Constraint 5: Anti-regression on actionable findings (NO newly introduced collisions or physical defects)
    const candActionable = candEval.findings.filter((f) => f.classification === "actionable-deficit");
    for (const cf of candActionable) {
      // Route clearance deficit / bottleneck progression is evaluated via feasibility & metrics
      if (cf.kind === "route-deficit" || cf.kind === "route-bottleneck") {
        continue;
      }
      const sig = `${cf.kind}:${(cf.entityIds || []).slice().sort().join(",")}`;
      if (!baselineActionableSigs.has(sig)) {
        prunedCount++;
        return null; // Reject candidate that introduced a new physical deficit (e.g. collision)
      }
    }

    // Metric computation with strict NULL preservation (Zero Fake Metrics)
    const baseMinClr = baselineEvaluation.summary.minimumClearanceCm;
    const candMinClr = candEval.summary.minimumClearanceCm;
    const clearanceGainCm =
      baseMinClr !== null && candMinClr !== null
        ? Math.round((candMinClr - baseMinClr) * 10) / 10
        : null;

    const becameFeasible =
      baselineEvaluation.summary.routeFeasibility !== "adequate" &&
      candEval.summary.routeFeasibility === "adequate";

    const deficitsDelta = candDeficits - baselineDeficits;

    const baseLen = baselineEvaluation.summary.pathLengthM;
    const candLen = candEval.summary.pathLengthM;
    const pathLengthDeltaCm =
      baseLen !== null && candLen !== null
        ? Math.round((candLen - baseLen) * 100)
        : null;

    // Constraint 6: Demonstrable Geometric Improvement
    // Candidate MUST demonstrate at least one demonstrable improvement:
    // a) deficitsDelta < 0 (resolved at least one baseline deficit without new ones)
    // b) becameFeasible === true (impassable/clearance-deficit route became adequate)
    // c) clearanceGainCm !== null && clearanceGainCm > 0 (measured bottleneck clearance gain)
    const hasDemonstrableGain =
      deficitsDelta < 0 ||
      becameFeasible ||
      (clearanceGainCm !== null && clearanceGainCm > 0);

    if (!hasDemonstrableGain) {
      prunedCount++;
      return null;
    }

    // Strategy determined by objective achieved
    let strategy: CandidateStrategy;
    if (candDeficits === 0 && baselineDeficits > 0) {
      strategy = "deficit_elimination";
    } else if (clearanceGainCm !== null && clearanceGainCm > 0) {
      strategy = "clearance_maximization";
    } else {
      strategy = "minimal_displacement";
    }

    const movesSlug = moves
      .map((m) => `${m.furnitureId}_${Math.round(m.toPosition.x)}_${Math.round(m.toPosition.y)}@${m.toRotation}`)
      .join("-");

    return {
      id: `candidate-${strategy}-${movesSlug}`,
      name: "", // Assigned after ranking
      description: "", // Assigned after ranking
      strategy,
      moves,
      moveCount: moves.length,
      totalDisplacementCm: Math.round(computeDisplacement(moves) * 10) / 10,
      furniture: proposedFurn,
      routeResult: candRoute,
      evaluation: candEval,
      metrics: {
        clearanceGainCm,
        becameFeasible,
        actionableDeficitsDelta: deficitsDelta,
        pathLengthDeltaCm,
        routeFeasibility: candEval.summary.routeFeasibility,
        minimumClearanceCm: candEval.summary.minimumClearanceCm,
        actionableDeficitsCount: candDeficits,
      },
    };
  }

  // 5. Candidate Generation Loop
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

  // Search translations
  const baseTranslations = [
    { dx: 0, dy: 70 },
    { dx: 0, dy: -80 },
    { dx: 0, dy: 80 },
    { dx: 70, dy: 0 },
    { dx: 80, dy: 0 },
    { dx: -70, dy: 0 },
    { dx: -80, dy: 0 },
    { dx: 0, dy: -100 },
    { dx: 0, dy: 100 },
    { dx: -100, dy: 0 },
    { dx: 100, dy: 0 },
  ];

  // Sort movable items to prioritize items cited in baseline actionable deficits
  const sortedMovableItems = movableItems.slice().sort((a, b) => {
    const aTarget = deficitFurnitureIds.has(a.id);
    const bTarget = deficitFurnitureIds.has(b.id);
    if (aTarget !== bTarget) return aTarget ? -1 : 1;
    let minA = Infinity;
    let minB = Infinity;
    for (const w of waypoints) {
      minA = Math.min(minA, Math.hypot(a.x - w.x, a.y - w.y));
      minB = Math.min(minB, Math.hypot(b.x - w.x, b.y - w.y));
    }
    return minA - minB;
  });

  // Pass 1: Single-item perturbations for items with deficits or nearest to route
  for (const item of sortedMovableItems) {
    if (budgetExhausted) break;
    const isTarget = deficitFurnitureIds.size === 0 || deficitFurnitureIds.has(item.id);
    const candidateTranslations = isTarget ? baseTranslations : baseTranslations.slice(0, 8);

    for (const t of candidateTranslations) {
      if (budgetExhausted) break;
      for (const rot of [item.rotation, (item.rotation + 90) % 360]) {
        if (budgetExhausted) break;
        const proposed = furniture.map((f) =>
          f.id === item.id ? { ...f, x: item.x + t.dx, y: item.y + t.dy, rotation: rot } : { ...f }
        );
        const cand = evaluateProposed(proposed);
        if (cand) {
          rawCandidates.push(cand);
        }
      }
    }
  }

  // Pass 2: Multi-item perturbations if multiple deficits and budget permits
  if (!budgetExhausted) {
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
        if (budgetExhausted) break;
        for (const tB of compactTranslations) {
          if (budgetExhausted) break;
          const proposed = furniture.map((f) => {
            if (f.id === primaryA.id) return { ...f, x: primaryA.x + tA.dx, y: primaryA.y + tA.dy };
            if (f.id === primaryB.id) return { ...f, x: primaryB.x + tB.dx, y: primaryB.y + tB.dy };
            return { ...f };
          });
          const cand = evaluateProposed(proposed);
          if (cand) {
            rawCandidates.push(cand);
          }
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
    // 2. Feasibility progression (became feasible)
    if (a.metrics.becameFeasible !== b.metrics.becameFeasible) {
      return a.metrics.becameFeasible ? -1 : 1;
    }
    // 3. Clearance gain (higher is better, treat null as -1 for sorting)
    const gainA = a.metrics.clearanceGainCm ?? -1;
    const gainB = b.metrics.clearanceGainCm ?? -1;
    if (gainA !== gainB) {
      return gainB - gainA;
    }
    // 4. Move count (fewer moves is better)
    if (a.moveCount !== b.moveCount) {
      return a.moveCount - b.moveCount;
    }
    // 5. Total displacement (lower is better)
    return a.totalDisplacementCm - b.totalDisplacementCm;
  });

  const topCandidates = uniqueCandidates.slice(0, maxCandidates);

  const computeBudget = {
    maxEvaluations,
    evaluatedCount,
    prunedCount,
    budgetExhausted,
  };

  if (topCandidates.length > 0) {
    topCandidates.forEach((cand, idx) => {
      const movedNames = cand.moves.map((m) => m.furnitureName).join(" & ");
      const dist = Math.round(cand.totalDisplacementCm);
      cand.name = `Alternative ${idx + 1}: Shift ${movedNames} (${dist} cm)`;

      if (cand.metrics.actionableDeficitsCount === 0 && baselineDeficits > 0) {
        cand.strategy = "deficit_elimination";
        cand.description = `Reposition ${movedNames} by ${dist} cm to resolve all actionable clearance deficits.`;
      } else if (cand.metrics.clearanceGainCm !== null && cand.metrics.clearanceGainCm > 0) {
        cand.strategy = "clearance_maximization";
        cand.description = `Reposition ${movedNames} by ${dist} cm to increase bottleneck clearance by ${cand.metrics.clearanceGainCm} cm.`;
      } else if (cand.metrics.becameFeasible) {
        cand.strategy = "deficit_elimination";
        cand.description = `Reposition ${movedNames} by ${dist} cm to restore route corridor feasibility.`;
      } else {
        cand.strategy = "minimal_displacement";
        cand.description = `Reposition ${movedNames} by ${dist} cm with minimal spatial displacement.`;
      }

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
      message: `Generated ${topCandidates.length} verified layout alternative(s) within evaluation budget (${evaluatedCount} evaluated, ${prunedCount} pruned). Bounded search does not guarantee global optimality.`,
      movableFurnitureCount: movableCount,
      unmovableFurnitureCount: unmovableCount,
      sceneFingerprint,
      computeBudget,
    };
  }

  return {
    status: isBaselineClean ? "already_optimal" : "infeasible",
    candidates: [],
    baselineEvaluation,
    baselineRouteResult,
    message: isBaselineClean
      ? `Baseline configuration satisfies configured profile clearance target (${input.profile.minClearanceCm} cm). No changes required.`
      : `No collision-free alternative found within evaluation budget (${evaluatedCount} evaluated, ${prunedCount} pruned). Bounded solver does not guarantee global optimality.`,
    movableFurnitureCount: movableCount,
    unmovableFurnitureCount: unmovableCount,
    sceneFingerprint,
    computeBudget,
  };
}
