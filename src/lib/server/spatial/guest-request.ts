import { z } from "zod";
import {
  Polygon2DSchema,
  SpatialFurnitureSchema,
  SpatialWallSchema,
  RouteWaypointSchema,
  MobilityProfileDataSchema,
} from "@/lib/server/validation";
import { validateSceneGeometry } from "@/lib/server/spatial/geometry-validator";

const MAX_SPAN_CM = 1500; // Guest CPU cap: 15m square, 5cm grid ~90k cells.

export const GuestSpatialSceneSchema = z.object({
  units: z.literal("cm"),
  boundary: Polygon2DSchema.max(80),
  furniture: z.array(SpatialFurnitureSchema).max(60),
  routeWaypoints: z.array(RouteWaypointSchema).max(12),
  walls: z.array(SpatialWallSchema).max(40).default([]),
  profile: MobilityProfileDataSchema,
}).superRefine((scene, context) => {
  const xs = scene.boundary.map((point) => point.x);
  const ys = scene.boundary.map((point) => point.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  if (spanX > MAX_SPAN_CM || spanY > MAX_SPAN_CM) {
    context.addIssue({ code: "custom", message: "Guest scene must fit within 15m × 15m to bound compute time" });
  }
  if (scene.profile.minClearanceCm > 250 || scene.profile.turningSpaceCm > 500) {
    context.addIssue({ code: "custom", message: "Mobility profile exceeds supported physical configuration" });
  }
  const geometry = validateSceneGeometry({
    boundary: scene.boundary,
    furniture: scene.furniture,
    waypoints: scene.routeWaypoints,
    walls: scene.walls,
  });
  for (const error of geometry.errors) {
    context.addIssue({ code: "custom", message: error });
  }
});

export const GuestOptimizeSchema = z.object({
  scene: GuestSpatialSceneSchema,
  maxCandidates: z.number().int().min(1).max(3).optional().default(3),
  maxEvaluations: z.number().int().min(1).max(40).optional().default(30),
});

export type GuestSpatialScene = z.infer<typeof GuestSpatialSceneSchema>;
