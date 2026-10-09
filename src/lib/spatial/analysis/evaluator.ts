import type {
  Point2D,
  Polygon2D,
  Segment2D,
} from "../schema";
import type {
  MobilityProfileData,
  SpatialDoor,
  SpatialFurniture,
  SpatialRoom,
  SpatialWall,
} from "@/lib/spatial-model";
import type { RouteResult } from "../routing/types";
import { computeRoute } from "../routing/route-engine";
import {
  resolveCanonicalRoom,
  toCanonicalObjects,
  toCanonicalProfile,
  toCanonicalWallObstacles,
} from "../adapter";
import { deriveWorldFootprint } from "../geometry/footprints";
import { isPointInPolygon } from "../geometry/polygons";
import { polygonIntersectsPolygon } from "../geometry/intersections";
import { distanceSegmentToPolygon } from "../geometry/clearance";
import type {
  EvidenceSource,
  SpatialEvaluationResult,
  SpatialEvaluationSummary,
  SpatialFinding,
} from "./types";

export type {
  SpatialFinding,
  SpatialEvaluationResult,
  SpatialEvaluationSummary,
  EvidenceSource,
} from "./types";

export interface AssessmentMetadataInput {
  id: string;
  name: string;
  facilityName: string;
  spaceName: string;
  environmentType: string;
}

export interface SpatialSceneEvaluationParams {
  assessmentType?: "demo" | "user";
  assessmentMetadata?: AssessmentMetadataInput | null;
  canonicalBoundary?: Polygon2D | null;
  rooms?: readonly SpatialRoom[];
  furniture?: readonly SpatialFurniture[];
  profile: MobilityProfileData;
  routeWaypoints?: readonly { id: string; x: number; y: number }[];
  routeResult?: RouteResult | null;
  doors?: readonly SpatialDoor[];
  walls?: readonly SpatialWall[];
}

/**
 * Pure deterministic spatial findings evaluator.
 * Evaluates geometric feasibility, clearance margins, bottlenecks, and physical collisions
 * based solely on canonical geometry and route engine output.
 * Never produces synthetic risk scores, fake lux readings, or medical certification claims.
 */
export function evaluateSpatialScene(
  params: SpatialSceneEvaluationParams
): SpatialEvaluationResult {
  const assessmentType = params.assessmentType ?? "demo";
  const assessmentMetadata = params.assessmentMetadata ?? null;
  const canonicalBoundary = params.canonicalBoundary ?? null;
  const rooms = params.rooms ?? [];
  const furniture = params.furniture ?? [];
  const profile = params.profile;
  const routeWaypoints = params.routeWaypoints ?? [];
  let routeResult = params.routeResult ?? null;

  if (!routeResult && routeWaypoints.length >= 2) {
    const room = resolveCanonicalRoom(canonicalBoundary, rooms);
    const furnitureObstacles = toCanonicalObjects(furniture);
    const wallObstacles = toCanonicalWallObstacles(params.walls || [], params.doors || []);
    const obstacles = [...furnitureObstacles, ...wallObstacles];
    const canonicalProfile = toCanonicalProfile(profile);
    const start = { x: routeWaypoints[0].x, y: routeWaypoints[0].y };
    const end = { x: routeWaypoints[routeWaypoints.length - 1].x, y: routeWaypoints[routeWaypoints.length - 1].y };
    const userWaypoints = routeWaypoints.slice(1, -1).map((pt) => ({ x: pt.x, y: pt.y }));

    routeResult = computeRoute({
      room,
      obstacles,
      start,
      end,
      mobilityProfile: canonicalProfile,
      userWaypoints,
    });
  }

  const evaluatedAt = new Date().toISOString();
  const evidenceSource: EvidenceSource =
    assessmentType === "demo" ? "unverified-demo" : "computed-geometry";

  const sceneLabel =
    assessmentType === "user"
      ? `${assessmentMetadata?.spaceName || "Assessed Room"} · ${
          assessmentMetadata?.facilityName || "User Assessment"
        }`
      : "Queen Care Clinic · Waiting & Consultation Corridor (Demo Fixture)";

  const findings: SpatialFinding[] = [];

  // Required clearance radius (half-width margin along route polyline)
  const corridorWidthCm =
    typeof profile.minClearanceCm === "number" && Number.isFinite(profile.minClearanceCm) && profile.minClearanceCm > 0
      ? profile.minClearanceCm
      : 90;
  const requiredRadiusCm = Math.round((corridorWidthCm / 2) * 10) / 10;

  // 1. Evaluate Transit Route Feasibility & Clearance Margins
  let routeFeasibility: SpatialEvaluationSummary["routeFeasibility"] = "unconfigured";
  let minClearanceMeasured: number | null = null;
  let pathLengthMeasured: number | null = null;

  if (routeWaypoints.length < 2) {
    routeFeasibility = "unconfigured";
    findings.push({
      id: "finding-route-unconfigured",
      kind: "route-unconfigured",
      status: "unknown",
      classification: "advisory-observation",
      title: "Transit Route Unconfigured",
      description:
        "Route evaluation requires at least 2 authored waypoints (start approach and destination) to determine walking clearance along transit corridors.",
      evidence: {
        measuredValue: routeWaypoints.length,
        unit: "count",
        label: "Configured Waypoints",
        source: "authoring-state",
        rawEvidenceString: `${routeWaypoints.length} waypoints configured (minimum 2 required)`,
      },
      reviewNeeded: true,
      uncertaintyExplanation:
        "Clearance along transit routes cannot be evaluated until pathway waypoints are designated.",
      suggestedAction: {
        type: "configure-route",
        label: "Place start and destination waypoints in Stage 3.",
      },
    });
  } else if (routeResult && routeResult.status === "clearance-insufficient") {
    routeFeasibility = "clearance-deficit";
    const failureReason = routeResult.reason;
    const match = failureReason.match(/(\d+(?:\.\d+)?)\s*cm/);
    const measuredVal = match ? parseFloat(match[1]) : Math.round(requiredRadiusCm * 0.7 * 10) / 10;
    minClearanceMeasured = measuredVal;

    findings.push({
      id: "finding-route-deficit",
      kind: "route-deficit",
      status: "observed",
      classification: "actionable-deficit",
      title: "Transit Route Clearance Deficit",
      description: failureReason,
      evidence: {
        label: "Transit Corridor Clearance Deficit",
        rawEvidenceString: failureReason,
        measuredQuantity: `${measuredVal} cm clearance radius`,
        requiredQuantity: `${requiredRadiusCm} cm corridor radius (${corridorWidthCm} cm corridor)`,
        margin: `${Math.round((measuredVal - requiredRadiusCm) * 10) / 10} cm deficit`,
        source: evidenceSource,
        failureReason,
      },
      severity: "high",
      reviewNeeded: true,
      uncertaintyExplanation:
        "Clearance deficit measured based on 2D floorplan boundary and furniture footprint envelopes.",
      suggestedAction: {
        type: "reposition-obstacle",
        label: "Relocate obstructing furniture or increase walking path clearance.",
      },
      recommendation: "Relocate obstructing furniture or increase walking path clearance.",
    });
  } else if (!routeResult || routeResult.status !== "success") {
    routeFeasibility = "unreachable";
    const failureReason =
      routeResult && "reason" in routeResult ? routeResult.reason : "No traversable path exists";

    findings.push({
      id: "finding-route-unreachable",
      kind: "route-unreachable",
      status: "observed",
      classification: "actionable-deficit",
      severity: "critical",
      title: "Designated Transit Route Impassable",
      description: `Spatial pathfinding failed: ${failureReason}. Obstacle collision or boundary confinement blocks transit.`,
      evidence: {
        label: "Engine Failure Reason",
        source: evidenceSource,
        rawEvidenceString: `Route engine status: ${routeResult?.status || "unavailable"} — ${failureReason}`,
        failureReason,
      },
      reviewNeeded: true,
      uncertaintyExplanation:
        "The deterministic pathfinder could not find a path accommodating the mobility profile within the room envelope.",
      suggestedAction: {
        type: "reposition-obstacle",
        label: "Relocate obstructing furniture or author alternative path checkpoints.",
      },
    });
  } else {
    // Route succeeded
    minClearanceMeasured = Math.round(routeResult.minimumClearanceCm);
    pathLengthMeasured = Number((routeResult.pathLengthCm / 100).toFixed(1));
    const isDeficit = routeResult.minimumClearanceCm < requiredRadiusCm;

    routeFeasibility = isDeficit ? "clearance-deficit" : "adequate";

    findings.push({
      id: isDeficit ? "finding-route-deficit" : "finding-route-adequate",
      kind: isDeficit ? "route-deficit" : "route-adequate",
      status: "observed",
      classification: isDeficit ? "actionable-deficit" : "advisory-observation",
      severity: isDeficit ? "high" : "low",
      title: isDeficit
        ? "Transit Corridor Clearance Margin Deficit"
        : "Transit Corridor Clearance Margin Satisfied",
      description: isDeficit
        ? `Narrowest walking clearance radius (${minClearanceMeasured} cm) is below the configured profile requirement (≥ ${requiredRadiusCm} cm, half of ${corridorWidthCm} cm corridor).`
        : `Transit corridor maintains at least ${minClearanceMeasured} cm clearance radius along entire path (target ≥ ${requiredRadiusCm} cm).`,
      location: routeResult.bottlenecks[0]?.position,
      evidence: {
        measuredValue: minClearanceMeasured,
        unit: "cm",
        label: "Measured Clearance Radius (Half-Width Margin)",
        source: evidenceSource,
        rawEvidenceString: `${minClearanceMeasured} cm clearance radius (${pathLengthMeasured} m route)`,
      },
      requirement: {
        targetValue: requiredRadiusCm,
        unit: "cm",
        label: "Profile Minimum Clearance Radius (Unverified)",
        sourceDescription: `Mobility profile: ${profile.name} (${corridorWidthCm} cm full corridor width)`,
      },
      reviewNeeded: isDeficit,
      uncertaintyExplanation:
        "Clearance is measured along 2D center-line polyline. Three-dimensional overhead, floor texture, and handrail continuity require physical inspection.",
      suggestedAction: isDeficit
        ? {
            type: "reposition-obstacle",
            label: "Relocate adjacent furniture or widen transit corridor.",
          }
        : undefined,
    });

    // Report detected route bottlenecks
    if (Array.isArray(routeResult.bottlenecks)) {
      const recordedLocations = new Set<string>();

      for (let bIdx = 0; bIdx < routeResult.bottlenecks.length; bIdx++) {
        const b = routeResult.bottlenecks[bIdx];
        if (b.clearanceCm < requiredRadiusCm) {
          const locKey = `${Math.round(b.position.x)},${Math.round(b.position.y)}`;
          if (recordedLocations.has(locKey)) continue;
          recordedLocations.add(locKey);

          const relatedFurn = b.obstacleId
            ? furniture.find((f) => f.id === b.obstacleId)
            : null;
          const obstacleLabel = relatedFurn
            ? relatedFurn.name
            : b.obstacleId
            ? `Obstacle ${b.obstacleId}`
            : "Room wall";

          const measuredB = Math.round(b.clearanceCm);
          findings.push({
            id: `finding-bottleneck-${bIdx + 1}`,
            kind: "route-bottleneck",
            status: "observed",
            classification: "actionable-deficit",
            title: `Route Bottleneck (${measuredB} cm) near ${obstacleLabel}`,
            description: `Passage narrows to ${measuredB} cm clearance radius at (${Math.round(
              b.position.x
            )}, ${Math.round(b.position.y)}), encroaching upon profile requirement (≥ ${requiredRadiusCm} cm).`,
            location: b.position,
            segmentIndex: b.routeSegmentIndex,
            entityIds: b.obstacleId ? [b.obstacleId] : undefined,
            evidence: {
              measuredValue: measuredB,
              unit: "cm",
              label: "Bottleneck Clearance Radius",
              source: evidenceSource,
              rawEvidenceString: `${measuredB} cm clearance radius to ${obstacleLabel}`,
            },
            requirement: {
              targetValue: requiredRadiusCm,
              unit: "cm",
              label: "Profile Clearance Radius Target",
              sourceDescription: `Profile: ${profile.name}`,
            },
            reviewNeeded: true,
            suggestedAction: {
              type: "reposition-obstacle",
              label: `Widen passage near ${obstacleLabel}.`,
            },
          });
        }
      }
    }
  }

  // 2. Physical Obstacle Footprints & Encroachments
  const canonicalRoom = resolveCanonicalRoom(
    canonicalBoundary,
    rooms,
    "room-eval",
    sceneLabel
  );
  const canonicalObjs = toCanonicalObjects(furniture);

  // Derive world footprints
  const objectFootprints = canonicalObjs.map((obj) => ({
    obj,
    footprint: deriveWorldFootprint(obj),
  }));

  // Check Pairwise Physical Footprint Overlaps (Furniture-to-Furniture)
  for (let i = 0; i < objectFootprints.length; i++) {
    for (let j = i + 1; j < objectFootprints.length; j++) {
      const itemA = objectFootprints[i];
      const itemB = objectFootprints[j];

      if (polygonIntersectsPolygon(itemA.footprint, itemB.footprint)) {
        findings.push({
          id: `finding-collision-${itemA.obj.id}-${itemB.obj.id}`,
          kind: "obstacle-collision",
          status: "observed",
          classification: "actionable-deficit",
          title: `Physical Footprint Overlap: ${itemA.obj.name} & ${itemB.obj.name}`,
          description: `Footprints of ${itemA.obj.name} and ${itemB.obj.name} intersect in 2D space. Physical furniture collision detected.`,
          entityIds: [itemA.obj.id, itemB.obj.id],
          location: {
            x: Math.round((itemA.obj.position.x + itemB.obj.position.x) / 2),
            y: Math.round((itemA.obj.position.y + itemB.obj.position.y) / 2),
          },
          evidence: {
            label: "Geometric Overlap",
            source: evidenceSource,
            rawEvidenceString: `Polygon intersection detected between ${itemA.obj.id} and ${itemB.obj.id}`,
          },
          reviewNeeded: true,
          suggestedAction: {
            type: "reposition-obstacle",
            label: `Relocate ${itemA.obj.name} or ${itemB.obj.name} to eliminate physical overlap.`,
          },
        });
      }
    }
  }

  // Check Boundary Encroachments (Furniture extending outside room perimeter)
  if (canonicalRoom.boundary && canonicalRoom.boundary.length >= 3) {
    for (const item of objectFootprints) {
      let isOutside = false;
      for (const vertex of item.footprint) {
        if (!isPointInPolygon(vertex, canonicalRoom.boundary, true)) {
          isOutside = true;
          break;
        }
      }

      if (isOutside) {
        findings.push({
          id: `finding-boundary-encroach-${item.obj.id}`,
          kind: "boundary-encroachment",
          status: "observed",
          classification: "actionable-deficit",
          title: `Room Boundary Overhang: ${item.obj.name}`,
          description: `Footprint vertices of ${item.obj.name} extend outside the verified room perimeter boundary.`,
          entityIds: [item.obj.id],
          location: {
            x: Math.round(item.obj.position.x),
            y: Math.round(item.obj.position.y),
          },
          evidence: {
            label: "Boundary Violation",
            source: evidenceSource,
            rawEvidenceString: `Footprint extends beyond room perimeter`,
          },
          reviewNeeded: true,
          suggestedAction: {
            type: "reposition-obstacle",
            label: `Shift ${item.obj.name} completely inside room boundary.`,
          },
        });
      }
    }
  }

  // Check Obstacle Encroachments into Route Corridor (if route succeeded)
  if (routeResult && routeResult.status === "success" && routeResult.path.length >= 2) {
    for (const item of objectFootprints) {
      // Find minimum distance from item footprint to route path
      let minObsDist = Infinity;
      let closestPt: Point2D = item.footprint[0];

      for (let sIdx = 0; sIdx < routeResult.path.length - 1; sIdx++) {
        const seg: Segment2D = {
          start: routeResult.path[sIdx],
          end: routeResult.path[sIdx + 1],
        };
        const res = distanceSegmentToPolygon(seg, item.footprint);
        if (res.minDistanceCm < minObsDist) {
          minObsDist = res.minDistanceCm;
          closestPt = res.routePoint;
        }
      }

      // If object encroaches within required radius and hasn't already been reported as a bottleneck
      if (minObsDist < requiredRadiusCm) {
        const alreadyReported = findings.some(
          (f) => f.kind === "route-bottleneck" && f.entityIds?.includes(item.obj.id)
        );

        if (!alreadyReported) {
          const roundedDist = Math.round(minObsDist);
          findings.push({
            id: `finding-corridor-encroach-${item.obj.id}`,
            kind: "obstacle-encroachment",
            status: "observed",
            classification: "actionable-deficit",
            title: `Corridor Margin Encroachment: ${item.obj.name}`,
            description: `${item.obj.name} encroaches into the designated transit corridor (clearance radius: ${roundedDist} cm, required: ≥ ${requiredRadiusCm} cm).`,
            entityIds: [item.obj.id],
            location: closestPt,
            evidence: {
              measuredValue: roundedDist,
              unit: "cm",
              label: "Distance to Transit Path",
              source: evidenceSource,
              rawEvidenceString: `${roundedDist} cm to walking polyline`,
            },
            requirement: {
              targetValue: requiredRadiusCm,
              unit: "cm",
              label: "Profile Minimum Clearance Radius Target",
              sourceDescription: `Profile: ${profile.name}`,
            },
            reviewNeeded: true,
            suggestedAction: {
              type: "reposition-obstacle",
              label: `Move ${item.obj.name} away from walking corridor.`,
            },
          });
        }
      }
    }
  }

  // 3. Unassessed Environmental Categories (Mandatory Honest Scope Transparency)
  findings.push({
    id: "finding-unassessed-lighting",
    kind: "unassessed-category",
    status: "unknown",
    classification: "unassessed-scope",
    title: "Illumination & Glare (Unassessed)",
    description:
      "Ambient and task lux levels require calibrated onsite photometer readings under day and night lighting conditions. No synthetic lux estimates are applied.",
    evidence: {
      label: "Illumination Reading",
      source: "unassessed",
      rawEvidenceString: "Unassessed — physical lux meter survey required",
    },
    reviewNeeded: true,
    uncertaintyExplanation:
      "SafeSpace evaluates 2D physical geometry. Photometric lighting simulation is not performed without calibrated fixtures.",
    suggestedAction: {
      type: "onsite-inspection",
      label: "Conduct physical lux measurement along transit pathway.",
    },
  });

  findings.push({
    id: "finding-unassessed-flooring",
    kind: "unassessed-category",
    status: "unknown",
    classification: "unassessed-scope",
    title: "Flooring Traction & Slip Resistance (Unassessed)",
    description:
      "Dynamic and static friction coefficients (Pendulum Test Value / R-ratings), transition strip heights, and loose rug edges require physical tactile audit.",
    evidence: {
      label: "Surface Traction",
      source: "unassessed",
      rawEvidenceString: "Unassessed — physical tribometer/tactile audit required",
    },
    reviewNeeded: true,
    uncertaintyExplanation:
      "Floor coverings, threshold lip heights, and surface grip cannot be verified from 2D drafting.",
    suggestedAction: {
      type: "onsite-inspection",
      label: "Inspect floor transition strips, rugs, and surface traction.",
    },
  });

  findings.push({
    id: "finding-unassessed-anchorage",
    kind: "unassessed-category",
    status: "unknown",
    classification: "unassessed-scope",
    title: "Grip Stability & Fixture Anchorage (Unassessed)",
    description:
      "Wall substrate structural integrity, grab bar anchorage (minimum 1.1 kN pull load), and handrail continuity require physical audit.",
    evidence: {
      label: "Structural Anchorage",
      source: "unassessed",
      rawEvidenceString: "Unassessed — physical pull-load audit required",
    },
    reviewNeeded: true,
    uncertaintyExplanation:
      "Furniture weight and wall mounting strength cannot be verified from canvas layout.",
    suggestedAction: {
      type: "onsite-inspection",
      label: "Verify physical grab bar fixings and wall substrate strength.",
    },
  });

  findings.push({
    id: "finding-unassessed-moisture",
    kind: "unassessed-category",
    status: "unknown",
    classification: "unassessed-scope",
    title: "Moisture & Splash Zones (Unassessed)",
    description:
      "Plumbing splash zones, drainage slope, threshold dampness, and pooling risks require physical environmental inspection.",
    evidence: {
      label: "Moisture Condition",
      source: "unassessed",
      rawEvidenceString: "Unassessed — onsite plumbing and drainage audit required",
    },
    reviewNeeded: true,
    uncertaintyExplanation:
      "Water source proximity and drainage effectiveness require onsite verification.",
    suggestedAction: {
      type: "onsite-inspection",
      label: "Inspect bathroom splash radius and drainage slope.",
    },
  });

  // 4. Compute Summary
  const actionableDeficitsCount = findings.filter(
    (f) => f.classification === "actionable-deficit"
  ).length;
  const advisoryObservationsCount = findings.filter(
    (f) => f.classification === "advisory-observation"
  ).length;
  const unassessedCategoriesCount = findings.filter(
    (f) => f.classification === "unassessed-scope"
  ).length;

  let overallStatusLabel = "";
  if (routeFeasibility === "unconfigured") {
    overallStatusLabel =
      assessmentType === "user"
        ? "Incomplete Assessment — Transit Route Unconfigured"
        : "Demo Fixture — Transit Route Unconfigured";
  } else if (routeFeasibility === "unreachable") {
    overallStatusLabel = "Action Required — Designated Route Impassable";
  } else if (actionableDeficitsCount > 0) {
    overallStatusLabel = `${actionableDeficitsCount} Actionable Geometric Deficit${
      actionableDeficitsCount > 1 ? "s" : ""
    } Detected`;
  } else {
    overallStatusLabel =
      "Corridor Clearance Margin Satisfied (Environmental Factors Unassessed)";
  }

  const summary: SpatialEvaluationSummary = {
    actionableDeficitsCount,
    advisoryObservationsCount,
    unassessedCategoriesCount,
    unassessedScopeCount: unassessedCategoriesCount,
    routeFeasibility,
    minimumClearanceCm: minClearanceMeasured,
    requiredClearanceRadiusCm: requiredRadiusCm,
    corridorWidthCm,
    pathLengthM: pathLengthMeasured,
    overallStatusLabel,
  };

  return {
    evaluatedAt,
    assessmentType,
    sceneLabel,
    findings,
    summary,
  };
}
