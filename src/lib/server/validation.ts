import { z } from "zod";

export const Point2DSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const Polygon2DSchema = z.array(Point2DSchema).min(3);

export const FurnitureCategorySchema = z.enum([
  "chair",
  "desk",
  "bench",
  "table",
  "cabinet",
  "plant",
  "mat",
  "handrail",
  "light",
  "medical-fixture",
]);

export const SpatialFurnitureSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  code: z.string().optional(),
  category: FurnitureCategorySchema,
  roomId: z.string().default("default-room"),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  depth: z.number().finite().positive(),
  height: z.number().finite().default(80),
  rotation: z.number().finite(),
  isFixed: z.boolean().default(false),
  isStableSupport: z.boolean().default(false),
  isConfirmed: z.boolean().default(true),
  detectionConfidence: z.number().finite().optional(),
  notes: z.string().optional(),
});

export const RouteWaypointSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  isMandatory: z.boolean().default(true),
});

export const CalibrationProvenanceSchema = z.object({
  pixelsPerCm: z.number().finite().positive(),
  realLength: z.number().finite().positive(),
  unit: z.enum(["cm", "m"]),
  pixelDistance: z.number().finite().positive(),
  originPolicy: z.literal("canvas-origin-0-0"),
});

export const MobilityProfileDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  minClearanceCm: z.number().finite().positive(),
  turningSpaceCm: z.number().finite().positive(),
  fallHistory: z.boolean().default(false),
  requiresSupport: z.boolean().default(false),
  lowLightSensitivity: z.enum(["Low", "Moderate", "High"]).default("Moderate"),
});

export const AssessmentMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  facilityName: z.string().default(""),
  spaceName: z.string().default(""),
  environmentType: z.string().default("residential"),
  notes: z.string().optional().default(""),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const AssessmentCreateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Assessment name cannot be empty"),
  facilityName: z.string().optional().default(""),
  spaceName: z.string().optional().default(""),
  environmentType: z.string().optional().default("residential"),
  notes: z.string().optional().default(""),
});

export const AssessmentUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  facilityName: z.string().optional(),
  spaceName: z.string().optional(),
  environmentType: z.string().optional(),
  notes: z.string().optional(),
});

export const SpatialWallSchema = z.object({
  id: z.string().min(1).max(160),
  start: Point2DSchema,
  end: Point2DSchema,
  thickness: z.number().finite().positive().max(200),
  isExterior: z.boolean().optional(),
});

export const SpatialHazardSchema = z.object({
  id: z.string().min(1).max(160),
  code: z.string().max(160),
  title: z.string().trim().min(1).max(160),
  severity: z.enum(["high", "medium", "low"]),
  position: Point2DSchema,
  relatedFurnitureId: z.string().optional(),
  plainDescription: z.string().max(4000),
  measuredEvidence: z.string().max(4000),
  measuredClearanceCm: z.number().finite().optional(),
  requiredClearanceCm: z.number().finite().optional(),
  detectionConfidence: z.number().finite().min(0).max(1),
  requiresReview: z.boolean(),
  recommendation: z.string().max(4000),
  resolvedInAlternative: z.array(z.string()).optional(),
});

export const FullAssessmentPayloadSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  assessmentType: z.enum(["demo", "user"]).default("user"),
  metadata: AssessmentMetadataSchema.nullable(),
  canonicalBoundary: Polygon2DSchema.nullable(),
  calibration: CalibrationProvenanceSchema.nullable(),
  activeProfileId: z.string().default("manual-wheelchair"),
  activeProfileSnapshot: MobilityProfileDataSchema.nullable().optional(),
  routeWaypoints: z.array(RouteWaypointSchema).default([]),
  furniture: z.array(SpatialFurnitureSchema).default([]),
  walls: z.array(SpatialWallSchema).default([]),
  hazards: z.array(SpatialHazardSchema).default([]),
  appliedLayoutBaseline: z.array(SpatialFurnitureSchema).nullable().optional(),
  appliedCandidateId: z.string().nullable().optional(),
  appliedSceneFingerprint: z.string().nullable().optional(),
  hasFloorplanImage: z.boolean().optional(),
  pendingMediaCleanupIds: z.array(z.string()).optional(),
});

export const AuthCredentialsSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().optional(),
});

export const SpatialEvaluateRequestSchema = z.object({
  boundary: Polygon2DSchema,
  furniture: z.array(SpatialFurnitureSchema),
  routeWaypoints: z.array(RouteWaypointSchema),
  calibration: CalibrationProvenanceSchema,
  profile: MobilityProfileDataSchema,
});

export const SpatialOptimizeRequestSchema = z.object({
  boundary: Polygon2DSchema,
  furniture: z.array(SpatialFurnitureSchema),
  routeWaypoints: z.array(RouteWaypointSchema),
  calibration: CalibrationProvenanceSchema.optional(),
  profile: MobilityProfileDataSchema,
  maxCandidates: z.number().int().positive().max(10).optional().default(3),
});

export const SpatialApplyRequestSchema = z
  .object({
    candidateId: z.string().min(1),
    expectedSceneFingerprint: z.string().min(1).optional(),
    sceneFingerprint: z.string().min(1).optional(),
  })
  .refine((data) => !!(data.expectedSceneFingerprint || data.sceneFingerprint), {
    message: "Either expectedSceneFingerprint or sceneFingerprint is required",
  });

export const AIFloorplanInterpretationRequestSchema = z.object({
  userConsent: z.literal(true),
  imageMimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  imageBase64: z.string().min(1),
  pixelsPerCm: z.number().optional(),
  scaleInfo: z
    .object({
      pixelsPerCm: z.number().optional(),
    })
    .optional(),
});

export const AIFindingsExplanationRequestSchema = z.object({
  userConsent: z.literal(true),
  assessmentName: z.string(),
  profileLabel: z.string(),
  findings: z
    .array(
      z.object({
        title: z.string(),
        severity: z.string(),
        description: z.string(),
      })
    )
    .optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
});
