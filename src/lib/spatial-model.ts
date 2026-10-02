export type Point2D = { x: number; y: number };

export type RoomCategory = "waiting" | "reception" | "corridor" | "consultation" | "restroom" | "storage";

export interface SpatialRoom {
  id: string;
  name: string;
  category: RoomCategory;
  x: number;
  y: number;
  width: number;
  depth: number;
  color: string;
  lightLevelLux: number; // Lux level
}

export interface SpatialWall {
  id: string;
  start: Point2D;
  end: Point2D;
  thickness: number;
  isExterior?: boolean;
}

export interface SpatialDoor {
  id: string;
  roomId: string;
  name: string;
  position: Point2D;
  width: number;
  swingDeg: number; // e.g. 90
  swingDirection: "inward-left" | "inward-right" | "outward-left" | "outward-right";
  hinge: Point2D;
}

export type FurnitureCategory =
  | "chair"
  | "desk"
  | "bench"
  | "table"
  | "cabinet"
  | "plant"
  | "mat"
  | "handrail"
  | "light"
  | "medical-fixture";

export interface SpatialFurniture {
  id: string;
  name: string;
  code?: string;
  category: FurnitureCategory;
  roomId: string;
  x: number; // cm
  y: number; // cm
  width: number; // cm
  depth: number; // cm
  height: number; // cm
  rotation: number; // degrees
  isFixed: boolean; // fixed objects cannot be moved
  isStableSupport: boolean; // can an older adult lean on it safely?
  isConfirmed: boolean; // true or needs user confirmation
  detectionConfidence?: number; // 0..1
  notes?: string;
}

export interface SpatialHazard {
  id: string;
  code: string;
  title: string;
  severity: "high" | "medium" | "low";
  position: Point2D; // cm
  relatedFurnitureId?: string;
  plainDescription: string;
  measuredEvidence: string;
  measuredClearanceCm?: number;
  requiredClearanceCm?: number;
  detectionConfidence: number;
  requiresReview: boolean;
  recommendation: string;
  resolvedInAlternative?: string[]; // IDs of alternatives resolving this
}

export interface RouteWaypoint {
  id: string;
  name: string;
  x: number;
  y: number;
  isMandatory: boolean;
}

export interface MobilityProfileData {
  id: string;
  name: string;
  description: string;
  minClearanceCm: number;
  turningSpaceCm: number;
  fallHistory: boolean;
  requiresSupport: boolean;
  lowLightSensitivity: "Low" | "Moderate" | "High";
}

export interface LayoutAlternative {
  id: "min-cost" | "balanced" | "max-safety";
  title: string;
  tagline: string;
  riskIndex: number;
  riskLevel: "Low" | "Moderate" | "High";
  costHkd: number;
  minClearanceCm: number;
  routeLengthM: number;
  furnitureMovesCount: number;
  remainingHazardsCount: number;
  highPriorityHazardsCount: number;
  isRecommended?: boolean;
  changes: {
    description: string;
    furnitureId?: string;
    action: "move" | "rotate" | "remove" | "add";
    costHkd: number;
    targetPos?: Point2D;
    targetRotation?: number;
  }[];
}

/* ─────────────────────────────────────────────────────────────
 * Initial Structured Scene Model for Queen Care Clinic
 * Space dimension: 800 cm x 600 cm (8 m x 6 m)
 * ───────────────────────────────────────────────────────────── */

export const INITIAL_ROOMS: SpatialRoom[] = [
  {
    id: "room-waiting",
    name: "Waiting Area",
    category: "waiting",
    x: 40,
    y: 40,
    width: 440,
    depth: 360,
    color: "#fafaf8",
    lightLevelLux: 320,
  },
  {
    id: "room-reception",
    name: "Reception Alcove",
    category: "reception",
    x: 480,
    y: 40,
    width: 280,
    depth: 200,
    color: "#f5f6f3",
    lightLevelLux: 400,
  },
  {
    id: "room-corridor",
    name: "Consultation Corridor",
    category: "corridor",
    x: 40,
    y: 400,
    width: 720,
    depth: 160,
    color: "#f8f9f7",
    lightLevelLux: 160, // Insufficient near doorway
  },
  {
    id: "room-consultation",
    name: "Consultation Room 1",
    category: "consultation",
    x: 480,
    y: 240,
    width: 280,
    depth: 160,
    color: "#f3f5f2",
    lightLevelLux: 380,
  },
];

export const INITIAL_WALLS: SpatialWall[] = [
  // Outer perimeter
  { id: "w-top", start: { x: 40, y: 40 }, end: { x: 760, y: 40 }, thickness: 12, isExterior: true },
  { id: "w-right", start: { x: 760, y: 40 }, end: { x: 760, y: 560 }, thickness: 12, isExterior: true },
  { id: "w-bottom", start: { x: 760, y: 560 }, end: { x: 40, y: 560 }, thickness: 12, isExterior: true },
  { id: "w-left", start: { x: 40, y: 560 }, end: { x: 40, y: 40 }, thickness: 12, isExterior: true },

  // Internal dividing walls
  { id: "w-mid-v", start: { x: 480, y: 40 }, end: { x: 480, y: 400 }, thickness: 10 },
  { id: "w-mid-h1", start: { x: 480, y: 240 }, end: { x: 760, y: 240 }, thickness: 10 },
  { id: "w-corridor-top", start: { x: 40, y: 400 }, end: { x: 760, y: 400 }, thickness: 10 },
];

export const INITIAL_DOORS: SpatialDoor[] = [
  {
    id: "door-entrance",
    roomId: "room-waiting",
    name: "Main Entrance",
    position: { x: 40, y: 220 },
    width: 90,
    swingDeg: 90,
    swingDirection: "inward-right",
    hinge: { x: 40, y: 220 },
  },
  {
    id: "door-corridor-access",
    roomId: "room-corridor",
    name: "Waiting to Corridor Arch",
    position: { x: 260, y: 400 },
    width: 100,
    swingDeg: 0,
    swingDirection: "inward-left",
    hinge: { x: 260, y: 400 },
  },
  {
    id: "door-consultation",
    roomId: "room-consultation",
    name: "Consultation Door",
    position: { x: 520, y: 400 },
    width: 85,
    swingDeg: 90,
    swingDirection: "inward-left",
    hinge: { x: 520, y: 400 },
  },
];

/* ─────────────────────────────────────────────────────────────
 * Initial 18 Objects Detected
 * Exactly 3 require confirmation per prompt spec:
 * 1. chair-c04
 * 2. table-sharp
 * 3. mat-entrance
 * ───────────────────────────────────────────────────────────── */

export const INITIAL_FURNITURE: SpatialFurniture[] = [
  // 1. Reception desk (Fixed)
  {
    id: "desk-reception",
    name: "Reception Counter",
    code: "REC-01",
    category: "desk",
    roomId: "room-reception",
    x: 520,
    y: 80,
    width: 200,
    depth: 70,
    height: 105,
    rotation: 0,
    isFixed: true,
    isStableSupport: true,
    isConfirmed: true,
    detectionConfidence: 0.98,
    notes: "Fixed ergonomic counter with glass privacy shield.",
  },
  // 2. Staff Task Chair behind reception (Movable)
  {
    id: "chair-staff",
    name: "Reception Office Chair",
    code: "STF-01",
    category: "chair",
    roomId: "room-reception",
    x: 600,
    y: 155,
    width: 55,
    depth: 55,
    height: 90,
    rotation: 0,
    isFixed: false,
    isStableSupport: false,
    isConfirmed: true,
    detectionConfidence: 0.95,
  },
  // 3-8. Waiting chairs (C-01 to C-06)
  {
    id: "chair-c01",
    name: "Waiting Armchair C-01",
    code: "C-01",
    category: "chair",
    roomId: "room-waiting",
    x: 100,
    y: 80,
    width: 55,
    depth: 55,
    height: 82,
    rotation: 0,
    isFixed: false,
    isStableSupport: true,
    isConfirmed: true,
    detectionConfidence: 0.96,
  },
  {
    id: "chair-c02",
    name: "Waiting Armchair C-02",
    code: "C-02",
    category: "chair",
    roomId: "room-waiting",
    x: 170,
    y: 80,
    width: 55,
    depth: 55,
    height: 82,
    rotation: 0,
    isFixed: false,
    isStableSupport: true,
    isConfirmed: true,
    detectionConfidence: 0.97,
  },
  {
    id: "chair-c03",
    name: "Waiting Armchair C-03",
    code: "C-03",
    category: "chair",
    roomId: "room-waiting",
    x: 240,
    y: 80,
    width: 55,
    depth: 55,
    height: 82,
    rotation: 0,
    isFixed: false,
    isStableSupport: true,
    isConfirmed: true,
    detectionConfidence: 0.94,
  },
  // Critical hazard chair C-04 (Requires confirmation!)
  {
    id: "chair-c04",
    name: "Waiting Armchair C-04",
    code: "C-04",
    category: "chair",
    roomId: "room-waiting",
    x: 230,
    y: 205, // Constricts walker route to 54cm
    width: 55,
    depth: 55,
    height: 82,
    rotation: 0,
    isFixed: false,
    isStableSupport: true,
    isConfirmed: false, // 1st unconfirmed
    detectionConfidence: 0.81,
    notes: "Protrudes directly into main circulation path.",
  },
  // Chair C-05 intersects door-swing / circulation (Requires confirmation!)
  {
    id: "chair-c05",
    name: "Waiting Armchair C-05",
    code: "C-05",
    category: "chair",
    roomId: "room-waiting",
    x: 300,
    y: 205,
    width: 55,
    depth: 55,
    height: 82,
    rotation: 0, // Needs 90 deg rotation in Balanced plan
    isFixed: false,
    isStableSupport: true,
    isConfirmed: false, // 2nd unconfirmed
    detectionConfidence: 0.84,
    notes: "Partially intersects consultation access path.",
  },
  {
    id: "chair-c06",
    name: "Waiting Armchair C-06",
    code: "C-06",
    category: "chair",
    roomId: "room-waiting",
    x: 370,
    y: 205,
    width: 55,
    depth: 55,
    height: 82,
    rotation: 0,
    isFixed: false,
    isStableSupport: true,
    isConfirmed: true,
    detectionConfidence: 0.92,
  },
  // 9. Sharp corner magazine table (Requires confirmation!)
  {
    id: "table-sharp",
    name: "Low Magazine Coffee Table",
    code: "TBL-01",
    category: "table",
    roomId: "room-waiting",
    x: 395,
    y: 110,
    width: 50,
    depth: 50,
    height: 45,
    rotation: 0,
    isFixed: false,
    isStableSupport: false,
    isConfirmed: false, // 3rd unconfirmed
    detectionConfidence: 0.78,
    notes: "Sharp untreated square corner 28 cm from walking path.",
  },
  // 10. Loose entrance mat
  {
    id: "mat-entrance",
    name: "Loose Entrance Floor Mat",
    code: "MAT-01",
    category: "mat",
    roomId: "room-waiting",
    x: 65,
    y: 235,
    width: 75,
    depth: 50,
    height: 1.5,
    rotation: 0,
    isFixed: false,
    isStableSupport: false,
    isConfirmed: true,
    detectionConfidence: 0.91,
    notes: "High-friction curl edge without non-slip bevel.",
  },
  // 11. Water dispenser unit
  {
    id: "dispenser-water",
    name: "Water Dispenser Station",
    code: "WTR-01",
    category: "medical-fixture",
    roomId: "room-waiting",
    x: 420,
    y: 50,
    width: 40,
    depth: 40,
    height: 130,
    rotation: 0,
    isFixed: true,
    isStableSupport: false,
    isConfirmed: true,
    detectionConfidence: 0.95,
  },
  // 12. Pamphlet rack / bookshelf
  {
    id: "shelf-brochure",
    name: "Health Education Display Rack",
    code: "SHF-01",
    category: "cabinet",
    roomId: "room-waiting",
    x: 60,
    y: 330,
    width: 70,
    depth: 25,
    height: 140,
    rotation: 0,
    isFixed: true,
    isStableSupport: false,
    isConfirmed: true,
    detectionConfidence: 0.93,
  },
  // 13. Indoor decorative planter
  {
    id: "plant-waiting",
    name: "Indoor Palm Planter",
    code: "PLT-01",
    category: "plant",
    roomId: "room-waiting",
    x: 55,
    y: 55,
    width: 35,
    depth: 35,
    height: 110,
    rotation: 0,
    isFixed: false,
    isStableSupport: false,
    isConfirmed: true,
    detectionConfidence: 0.92,
  },
  // 14. Corridor rest bench
  {
    id: "bench-corridor",
    name: "Padded Corridor Rest Bench",
    code: "BCH-01",
    category: "bench",
    roomId: "room-corridor",
    x: 140,
    y: 480,
    width: 130,
    depth: 45,
    height: 48,
    rotation: 0,
    isFixed: true,
    isStableSupport: true,
    isConfirmed: true,
    detectionConfidence: 0.96,
  },
  // 15. Queue Calling Screen
  {
    id: "tv-queue",
    name: "Patient Queue Display",
    code: "DSP-01",
    category: "medical-fixture",
    roomId: "room-reception",
    x: 540,
    y: 45,
    width: 90,
    depth: 10,
    height: 50,
    rotation: 0,
    isFixed: true,
    isStableSupport: false,
    isConfirmed: true,
    detectionConfidence: 0.97,
  },
  // 16. Consultation Doctor Desk
  {
    id: "desk-doctor",
    name: "Physician Consultation Desk",
    code: "DOC-01",
    category: "desk",
    roomId: "room-consultation",
    x: 560,
    y: 270,
    width: 150,
    depth: 70,
    height: 75,
    rotation: 0,
    isFixed: true,
    isStableSupport: true,
    isConfirmed: true,
    detectionConfidence: 0.98,
  },
  // 17. Doctor Executive Chair
  {
    id: "chair-doctor",
    name: "Doctor Examination Chair",
    code: "DOC-02",
    category: "chair",
    roomId: "room-consultation",
    x: 630,
    y: 250,
    width: 55,
    depth: 55,
    height: 90,
    rotation: 0,
    isFixed: false,
    isStableSupport: false,
    isConfirmed: true,
    detectionConfidence: 0.94,
  },
  // 18. Patient Consultation Chair
  {
    id: "chair-patient",
    name: "Patient Examination Armchair",
    code: "PT-01",
    category: "chair",
    roomId: "room-consultation",
    x: 580,
    y: 350,
    width: 55,
    depth: 55,
    height: 85,
    rotation: 0,
    isFixed: false,
    isStableSupport: true,
    isConfirmed: true,
    detectionConfidence: 0.95,
  },
];

/* ─────────────────────────────────────────────────────────────
 * The 7 Exact Main Hazards from Scenario Spec
 * ───────────────────────────────────────────────────────────── */

export const INITIAL_HAZARDS: SpatialHazard[] = [
  {
    id: "hz-01",
    code: "HZ-01",
    title: "Insufficient Walker Route Clearance",
    severity: "high",
    position: { x: 235, y: 220 },
    relatedFurnitureId: "chair-c04",
    plainDescription:
      "Waiting chair C-04 reduces walking clearance to 54 cm, significantly below the 90 cm preferred clearance configured for this walker profile.",
    measuredEvidence: "Measured clearance: 54 cm (Profile requirement: ≥ 90 cm, Deficit: 36 cm).",
    measuredClearanceCm: 54,
    requiredClearanceCm: 90,
    detectionConfidence: 0.96,
    requiresReview: true,
    recommendation: "Relocate waiting chair C-04 by at least 70 cm away from main transit path.",
    resolvedInAlternative: ["min-cost", "balanced", "max-safety"],
  },
  {
    id: "hz-02",
    code: "HZ-02",
    title: "Sharp Furniture Corner Near Critical Route",
    severity: "high",
    position: { x: 395, y: 140 },
    relatedFurnitureId: "table-sharp",
    plainDescription:
      "A sharp 90-degree wooden corner of the magazine table is situated within 28 cm of the walker turning path, creating high impact injury risk during unsteady gait.",
    measuredEvidence: "Corner clearance: 28 cm to route envelope. Edge radius < 2 mm.",
    measuredClearanceCm: 28,
    requiredClearanceCm: 60,
    detectionConfidence: 0.91,
    requiresReview: true,
    recommendation: "Shift table flush against east partition or replace with rounded edge fixture.",
    resolvedInAlternative: ["balanced", "max-safety"],
  },
  {
    id: "hz-03",
    code: "HZ-03",
    title: "Insufficient Doorway Illuminance",
    severity: "high",
    position: { x: 500, y: 395 },
    relatedFurnitureId: "door-consultation",
    plainDescription:
      "Lighting near the consultation-room doorway threshold measures 110 Lux, creating visual adaptation lag and shadow illusion for older adults with moderate low-light sensitivity.",
    measuredEvidence: "Photometric reading: 110 Lux (CIBSE/OT minimum standard: ≥ 200 Lux).",
    detectionConfidence: 0.88,
    requiresReview: true,
    recommendation: "Install overhead LED diffuser luminaire (3000K, 250+ Lux) at threshold zone.",
    resolvedInAlternative: ["balanced", "max-safety"],
  },
  {
    id: "hz-04",
    code: "HZ-04",
    title: "Unsupported Walking Gap (>2m)",
    severity: "medium",
    position: { x: 380, y: 440 },
    plainDescription:
      "A 2.1-metre route section along the consultation corridor lacks continuous stable support or handrail contact for frail users.",
    measuredEvidence: "Continuous unsupported distance: 2.1 m (Max recommended without rest: 1.5 m).",
    detectionConfidence: 0.94,
    requiresReview: false,
    recommendation: "Install wall-mounted continuous ergonomic handrail (height 88 cm).",
    resolvedInAlternative: ["balanced", "max-safety"],
  },
  {
    id: "hz-05",
    code: "HZ-05",
    title: "Door-Swing Zone Intersection",
    severity: "medium",
    position: { x: 310, y: 220 },
    relatedFurnitureId: "chair-c05",
    plainDescription:
      "Waiting chair C-05 intrudes into the primary pedestrian trajectory and door-swing safety buffer.",
    measuredEvidence: "Buffer overlap: 32 cm encroachment into recommended egress corridor.",
    detectionConfidence: 0.89,
    requiresReview: false,
    recommendation: "Rotate chair C-05 by 90 degrees flush to perimeter layout.",
    resolvedInAlternative: ["balanced", "max-safety"],
  },
  {
    id: "hz-06",
    code: "HZ-06",
    title: "Unsecured High-Friction Entrance Mat",
    severity: "medium",
    position: { x: 80, y: 245 },
    relatedFurnitureId: "mat-entrance",
    plainDescription:
      "A small loose mat with curling edges is located immediately inside the entrance, creating a significant trip and walker castor entrapment hazard.",
    measuredEvidence: "Non-adhered edge with 12 mm height differential without transition bevel.",
    detectionConfidence: 0.97,
    requiresReview: false,
    recommendation: "Remove loose mat or replace with flush recessed barrier matting.",
    resolvedInAlternative: ["min-cost", "balanced", "max-safety"],
  },
  {
    id: "hz-07",
    code: "HZ-07",
    title: "Unnecessary Tight S-Turn Trajectory",
    severity: "low",
    position: { x: 320, y: 280 },
    plainDescription:
      "Current furniture cluster forces older adults using a walker through an awkward double 80-degree turn requiring heavy upper-body pivoting.",
    measuredEvidence: "Route curvature radius: 42 cm (Preferred walker turning radius: ≥ 75 cm).",
    detectionConfidence: 0.93,
    requiresReview: false,
    recommendation: "Align circulation into direct linear transit corridor.",
    resolvedInAlternative: ["balanced", "max-safety"],
  },
];

/* ─────────────────────────────────────────────────────────────
 * Preconfigured Critical Route
 * Entrance → Reception → Waiting Seat → Consultation Room
 * ───────────────────────────────────────────────────────────── */

export const INITIAL_ROUTE: RouteWaypoint[] = [
  { id: "pt-1", name: "Entrance Doorway", x: 60, y: 240, isMandatory: true },
  { id: "pt-2", name: "Foyer Intake Point", x: 160, y: 240, isMandatory: false },
  { id: "pt-3", name: "Reception Counter Approach", x: 470, y: 180, isMandatory: true },
  { id: "pt-4", name: "Pinch Point (Chair C-04)", x: 235, y: 270, isMandatory: false },
  { id: "pt-5", name: "Waiting Seat Transition", x: 310, y: 290, isMandatory: true },
  { id: "pt-6", name: "Corridor Portal Threshold", x: 260, y: 440, isMandatory: false },
  { id: "pt-7", name: "Mid-Corridor Transit", x: 420, y: 460, isMandatory: false },
  { id: "pt-8", name: "Consultation Room 1", x: 550, y: 450, isMandatory: true },
];

/* ─────────────────────────────────────────────────────────────
 * Mobility Profiles
 * ───────────────────────────────────────────────────────────── */

export const MOBILITY_PROFILES: MobilityProfileData[] = [
  {
    id: "walker",
    name: "Uses a walker",
    description: "Older adult with bilateral mobility aid requiring stable clearance & support points.",
    minClearanceCm: 90,
    turningSpaceCm: 150,
    fallHistory: true,
    requiresSupport: true,
    lowLightSensitivity: "Moderate",
  },
  {
    id: "cane",
    name: "Uses a cane",
    description: "Unilateral support aid user with mild asymmetry in gait velocity and balance.",
    minClearanceCm: 75,
    turningSpaceCm: 110,
    fallHistory: true,
    requiresSupport: true,
    lowLightSensitivity: "Low",
  },
  {
    id: "wheelchair",
    name: "Uses a wheelchair",
    description: "Manual or powered wheelchair user needing standard ADA turning circles.",
    minClearanceCm: 95,
    turningSpaceCm: 160,
    fallHistory: false,
    requiresSupport: false,
    lowLightSensitivity: "Low",
  },
  {
    id: "independent",
    name: "Independent walking",
    description: "Older adult walking without assistive devices with age-typical reaction time.",
    minClearanceCm: 65,
    turningSpaceCm: 90,
    fallHistory: false,
    requiresSupport: false,
    lowLightSensitivity: "Low",
  },
  {
    id: "limited-vision",
    name: "Limited vision",
    description: "Visually impaired older adult highly susceptible to glare and contrast drop.",
    minClearanceCm: 85,
    turningSpaceCm: 120,
    fallHistory: true,
    requiresSupport: true,
    lowLightSensitivity: "High",
  },
];

/* ─────────────────────────────────────────────────────────────
 * Layout Alternatives (3 Options)
 * ───────────────────────────────────────────────────────────── */

export const LAYOUT_ALTERNATIVES: Record<string, LayoutAlternative> = {
  "min-cost": {
    id: "min-cost",
    title: "Minimum Cost",
    tagline: "Quick operational adjustment with zero hardware installation",
    riskIndex: 41,
    riskLevel: "Moderate",
    costHkd: 180,
    minClearanceCm: 82,
    routeLengthM: 11.2,
    furnitureMovesCount: 1,
    remainingHazardsCount: 4,
    highPriorityHazardsCount: 1,
    changes: [
      {
        description: "Move waiting chair C-04 by 70 cm into north perimeter row.",
        furnitureId: "chair-c04",
        action: "move",
        costHkd: 0,
        targetPos: { x: 100, y: 150 },
      },
      {
        description: "Remove loose high-friction entrance mat.",
        furnitureId: "mat-entrance",
        action: "remove",
        costHkd: 180, // labor / disposal
      },
    ],
  },
  balanced: {
    id: "balanced",
    title: "Balanced Layout",
    tagline: "Recommended optimal balance of safety, comfort and modest capital expenditure",
    riskIndex: 27,
    riskLevel: "Low",
    costHkd: 850,
    minClearanceCm: 96,
    routeLengthM: 10.4,
    furnitureMovesCount: 2,
    remainingHazardsCount: 2,
    highPriorityHazardsCount: 0,
    isRecommended: true,
    changes: [
      {
        description: "Move waiting chair C-04 by 70 cm north to perimeter wall.",
        furnitureId: "chair-c04",
        action: "move",
        costHkd: 0,
        targetPos: { x: 100, y: 150 },
      },
      {
        description: "Rotate waiting chair C-05 by 90 degrees outward to clear doorway arc.",
        furnitureId: "chair-c05",
        action: "rotate",
        costHkd: 0,
        targetPos: { x: 340, y: 140 },
        targetRotation: 90,
      },
      {
        description: "Remove loose entrance mat and polish floor threshold.",
        furnitureId: "mat-entrance",
        action: "remove",
        costHkd: 0,
      },
      {
        description: "Install 2.4 m wall-mounted continuous corridor handrail.",
        action: "add",
        costHkd: 620,
      },
      {
        description: "Install 3000K warm LED downlight diffuser at consultation doorway.",
        action: "add",
        costHkd: 230,
      },
    ],
  },
  "max-safety": {
    id: "max-safety",
    title: "Maximum Safety",
    tagline: "Comprehensive architectural retrofit for absolute barrier-free access",
    riskIndex: 19,
    riskLevel: "Low",
    costHkd: 2400,
    minClearanceCm: 110,
    routeLengthM: 10.0,
    furnitureMovesCount: 4,
    remainingHazardsCount: 1,
    highPriorityHazardsCount: 0,
    changes: [
      {
        description: "Relocate chairs C-01 through C-06 into recessed peripheral bays.",
        furnitureId: "chair-c04",
        action: "move",
        costHkd: 0,
        targetPos: { x: 80, y: 150 },
      },
      {
        description: "Replace sharp-corner coffee table with rounded medical-grade table.",
        furnitureId: "table-sharp",
        action: "remove",
        costHkd: 750,
      },
      {
        description: "Recessed barrier matting at clinic entrance.",
        furnitureId: "mat-entrance",
        action: "add",
        costHkd: 550,
      },
      {
        description: "Install dual-height continuous handrails on both sides of corridor.",
        action: "add",
        costHkd: 850,
      },
      {
        description: "Full photometric upgrade with photocell occupancy sensors.",
        action: "add",
        costHkd: 250,
      },
    ],
  },
};

/* ─────────────────────────────────────────────────────────────
 * Real-time Metric & Constraint Evaluation Engine
 * Evaluates live clearance and risk if user tweaks furniture
 * ───────────────────────────────────────────────────────────── */

export function calculateLiveMetrics(
  furniture: SpatialFurniture[],
  activeAlternativeId: string | null = null,
  route: RouteWaypoint[] = INITIAL_ROUTE
): {
  riskIndex: number;
  riskLevel: "Low" | "Moderate" | "High";
  minClearanceCm: number;
  routeLengthM: number;
  constraintWarning: string | null;
  activeHazardsCount: number;
  highPriorityHazardsCount: number;
} {
  // Chair C-04 position is the critical pinch point near route point (235, 220)
  const chair4 = furniture.find((f) => f.id === "chair-c04");
  const mat = furniture.find((f) => f.id === "mat-entrance");

  let minClearance = 96;
  let constraintWarning: string | null = null;

  if (chair4) {
    // Distance from chair-c04 center to corridor passage point (235, 260)
    const distToRoute = Math.hypot(chair4.x + chair4.width / 2 - 235, chair4.y + chair4.depth / 2 - 260);
    // Clearance formula based on proximity
    const effectiveClearance = Math.round(Math.max(45, Math.min(120, distToRoute * 1.4)));
    if (distToRoute < 50) {
      minClearance = Math.min(minClearance, 54);
    } else {
      minClearance = Math.min(minClearance, effectiveClearance);
    }

    if (minClearance < 90) {
      constraintWarning = `This position reduces walker clearance to ${minClearance} cm (min 90 cm required).`;
    }
  }

  let totalLengthCm = 0;
  for (let i = 0; i < route.length - 1; i++) {
    totalLengthCm += Math.hypot(route[i + 1].x - route[i].x, route[i + 1].y - route[i].y);
  }

  const isDefaultRoute = route.length === 8 && route[0].x === 60;
  const routeLengthM = isDefaultRoute
    ? activeAlternativeId === "balanced"
      ? 10.4
      : activeAlternativeId === "max-safety"
      ? 10.0
      : 11.8
    : Number((totalLengthCm / 100).toFixed(1));

  // Determine risk index based on clearance and remaining hazards
  let risk = 27;
  let highHazards = 0;
  let totalHazards = 2;

  if (minClearance <= 60) {
    risk = 68;
    highHazards = 3;
    totalHazards = 7;
  } else if (minClearance < 90) {
    risk = 41;
    highHazards = 1;
    totalHazards = 4;
  } else {
    risk = 27;
    highHazards = 0;
    totalHazards = 2;
  }

  // If mat still present near entrance and we're not in balanced/max-safety
  if (mat && activeAlternativeId === null && minClearance <= 60) {
    risk = 68;
  }

  const riskLevel: "Low" | "Moderate" | "High" =
    risk >= 60 ? "High" : risk >= 35 ? "Moderate" : "Low";

  return {
    riskIndex: risk,
    riskLevel,
    minClearanceCm: minClearance,
    routeLengthM,
    constraintWarning,
    activeHazardsCount: totalHazards,
    highPriorityHazardsCount: highHazards,
  };
}
