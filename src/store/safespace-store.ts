import { create } from "zustand";
import {
  type Point2D,
  type SpatialFurniture,
  type SpatialRoom,
  type SpatialWall,
  type SpatialDoor,
  type SpatialHazard,
  type RouteWaypoint,
  type MobilityProfileData,
  INITIAL_ROOMS,
  INITIAL_WALLS,
  INITIAL_DOORS,
  INITIAL_FURNITURE,
  INITIAL_HAZARDS,
  INITIAL_ROUTE,
  MOBILITY_PROFILES,
  LAYOUT_ALTERNATIVES,
  calculateLiveMetrics,
} from "@/lib/spatial-model";
import {
  computeRoute,
  resolveCanonicalRoom,
  toCanonicalObjects,
  toCanonicalProfile,
  toCanonicalWallObstacles,
  findInteriorProvisionalPoint,
  validatePolygon2D,
  isSimplePolygon,
  polygonArea,
  evaluateSpatialScene,
  type SpatialEvaluationResult,
  type Polygon2D,
  type RouteResult,
  optimizeLayout,
  type OptimizationResult,
  computeSceneFingerprint,
} from "@/lib/spatial";
import {
  SAFESPACE_STORAGE_VERSION,
  savePersistedAssessment,
  loadPersistedAssessment,
  getPersistedAssessment,
  clearPersistedAssessment,
  saveActiveWorkspace,
  loadActiveWorkspace,
  type AssessmentMetadata,
  type CalibrationProvenance,
  type PersistedAssessmentState,
} from "@/lib/storage/persistence";
import {
  saveFloorplanImage,
  getFloorplanImage,
  deleteFloorplanImage,
  type PersistedFloorplanImage,
} from "@/lib/storage/image-db";
import {
  coordinatedDeleteAssessment,
  type DeletionResult,
} from "@/lib/storage/coordinated-storage";
import {
  isValidFootprintPlacement,
  findFeasibleFootprintPlacement,
  furnitureToWorldFootprint,
  wallToObstacleFootprint,
  doorToObstacleFootprint,
  type ObstacleFootprint,
} from "@/lib/spatial";

export type WorkflowStage = "layout" | "profile" | "routes" | "analysis" | "improve";

export type EditorTool = "select" | "pan" | "furniture" | "hazard" | "measure";

export type AssessmentCreationResult = {
  success: boolean;
  error?: string;
  isSaved?: boolean;
  assessmentId?: string;
  rollbackFailed?: boolean;
};

export interface SafeSpaceState {
  // Assessment Identity & Isolation
  assessmentType: "demo" | "user";
  assessmentId: string;
  assessmentMetadata: AssessmentMetadata | null;
  canonicalBoundary: Polygon2D | null;
  calibrationProvenance: CalibrationProvenance | null;
  floorplanImageBlobUrl: string | null;
  setFloorplanImageBlobUrl: (url: string | null) => void;
  storageStatus: "idle" | "saved" | "error" | "quota_exceeded";
  storageError: string | null;

  // Workflow stage
  activeStage: WorkflowStage;
  setStage: (stage: WorkflowStage) => void;

  // Stage 1: Layout & Import
  importMode: "initial" | "uploading" | "extracting" | "ready";
  setImportMode: (mode: "initial" | "uploading" | "extracting" | "ready") => void;
  selectedTool: EditorTool;
  setSelectedTool: (tool: EditorTool) => void;

  // Scene elements
  rooms: SpatialRoom[];
  walls: SpatialWall[];
  doors: SpatialDoor[];
  furniture: SpatialFurniture[];
  hazards: SpatialHazard[];
  routeWaypoints: RouteWaypoint[];

  // Selection
  selectedFurnitureId: string | null;
  selectedHazardId: string | null;
  selectedFindingId: string | null;
  selectFurniture: (id: string | null) => void;
  selectHazard: (id: string | null) => void;
  selectFinding: (id: string | null) => void;

  // View & Grid controls
  showGrid: boolean;
  setShowGrid: (val: boolean | ((prev: boolean) => boolean)) => void;
  showDimensions: boolean;
  setShowDimensions: (val: boolean | ((prev: boolean) => boolean)) => void;
  snapToGrid: boolean;
  setSnapToGrid: (val: boolean | ((prev: boolean) => boolean)) => void;
  zoom: number;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  panOffset: Point2D;
  setPanOffset: (offset: Point2D) => void;

  // Layout editing & History
  history: SpatialFurniture[][];
  future: SpatialFurniture[][];
  moveFurniture: (id: string, x: number, y: number) => void;
  rotateFurniture: (id: string) => void;
  confirmFurniture: (id: string) => void;
  confirmAllRemaining: () => void;
  deleteFurniture: (id: string) => void;
  addFurniture: (category: SpatialFurniture["category"]) => void;
  undo: () => void;
  redo: () => void;

  // Stage 2: Profile
  activeProfileId: string;
  activeProfile: MobilityProfileData;
  setProfile: (id: string) => void;
  updateProfile: (updates: Partial<MobilityProfileData>) => void;

  // Stage 3: Routes & Animation
  selectedWaypointId: string | null;
  selectWaypoint: (id: string | null) => void;
  moveRouteWaypoint: (id: string, x: number, y: number) => void;
  removeRouteWaypoint: (id: string) => void;
  addRouteWaypoint: (name?: string, x?: number, y?: number) => void;
  recalculateRoute: () => void;
  routeResult: RouteResult | null;
  isWalkerAnimating: boolean;
  setIsWalkerAnimating: (val: boolean) => void;

  // Analysis Transition
  isTransitioning: boolean;
  transitionStep: number;
  runAnalysisTransition: () => void;

  // Stage 4: Analysis
  viewMode: "2d" | "3d";
  setViewMode: (mode: "2d" | "3d") => void;
  cameraPreset: "isometric" | "top" | "reset" | null;
  setCameraPreset: (preset: "isometric" | "top" | "reset" | null) => void;
  layerToggles: {
    route: boolean;
    clearance: boolean;
    heatmap: boolean;
    hazards: boolean;
    dimensions: boolean;
    walls: boolean;
  };
  toggleLayer: (layer: keyof SafeSpaceState["layerToggles"]) => void;

  // Stage 5: Improve
  optimisationObjective: "min-cost" | "balanced" | "max-safety";
  setOptimisationObjective: (obj: "min-cost" | "balanced" | "max-safety") => void;
  selectedAlternativeId: "min-cost" | "balanced" | "max-safety";
  selectAlternative: (altId: "min-cost" | "balanced" | "max-safety") => void;
  compareMode: "side-by-side" | "slider";
  setCompareMode: (mode: "side-by-side" | "slider") => void;
  compareSliderPosition: number;
  setCompareSliderPosition: (pos: number) => void;
  proposedFurniture: SpatialFurniture[];
  moveProposedFurniture: (id: string, x: number, y: number) => void;
  approvalStatus: "draft" | "approved" | "changes-requested";
  approvePlan: () => void;
  requestChanges: () => void;
  reportModalOpen: boolean;
  setReportModalOpen: (open: boolean) => void;

  // Gate 3 Layout Optimization
  activeOptimizationResult: OptimizationResult | null;
  selectedCandidateId: string | null;
  appliedCandidateId: string | null;
  appliedSceneFingerprint: string | null;
  baselineFurnitureSnapshot: SpatialFurniture[] | null;
  selectCandidate: (candidateId: string | null) => void;
  runOptimization: () => OptimizationResult;
  applyLayoutCandidate: (candidateId: string) => { success: boolean; error?: string };
  revertLayoutCandidate: () => { success: boolean; error?: string };

  // Placement & Interaction Feedback
  placementError: string | null;
  clearPlacementError: () => void;

  // Computed helper
  getSpatialFindings: () => SpatialEvaluationResult;
  getLiveMetrics: () => ReturnType<typeof calculateLiveMetrics>;
  resetToDemo: (initialStage?: unknown) => void;

  // Assessment Lifecycle
  createAndLoadUserAssessment: (payload: {
    metadata: AssessmentMetadata;
    boundaryCm: Polygon2D;
    calibration: CalibrationProvenance;
    imageFile?: File | Blob;
  }) => Promise<AssessmentCreationResult>;
  loadDemoAssessment: (initialStage?: unknown) => void;
  resetDemoAssessment: (initialStage?: unknown) => void;
  clearUserAssessment: () => Promise<DeletionResult>;
  hydrateFromStorage: () => void;
}

function cloneFurniture(items: SpatialFurniture[]): SpatialFurniture[] {
  return items.map((f) => ({ ...f }));
}

function generateProposedFurniture(
  base: SpatialFurniture[],
  altId: "min-cost" | "balanced" | "max-safety"
): SpatialFurniture[] {
  let list = cloneFurniture(base);
  const alt = LAYOUT_ALTERNATIVES[altId];
  if (!alt) return list;

  alt.changes.forEach((ch) => {
    if (ch.action === "move" && ch.furnitureId && ch.targetPos) {
      list = list.map((item) =>
        item.id === ch.furnitureId ? { ...item, x: ch.targetPos!.x, y: ch.targetPos!.y } : item
      );
    } else if (ch.action === "rotate" && ch.furnitureId) {
      list = list.map((item) =>
        item.id === ch.furnitureId
          ? {
              ...item,
              x: ch.targetPos ? ch.targetPos.x : item.x,
              y: ch.targetPos ? ch.targetPos.y : item.y,
              rotation: ch.targetRotation ?? (item.rotation + 90) % 360,
            }
          : item
      );
    } else if (ch.action === "remove" && ch.furnitureId) {
      list = list.filter((item) => item.id !== ch.furnitureId);
    }
  });

  return list;
}

export function computeStoreRoute(
  furniture: SpatialFurniture[],
  rooms: SpatialRoom[],
  profile: MobilityProfileData,
  waypoints: RouteWaypoint[],
  walls: SpatialWall[],
  doors: SpatialDoor[],
  canonicalBoundaryOverride?: Polygon2D | null
): RouteResult | null {
  if (!waypoints || waypoints.length < 2) return null;
  const room = resolveCanonicalRoom(canonicalBoundaryOverride, rooms);
  const furnitureObstacles = toCanonicalObjects(furniture);
  const wallObstacles = toCanonicalWallObstacles(walls, doors);
  const obstacles = [...furnitureObstacles, ...wallObstacles];
  const canonicalProfile = toCanonicalProfile(profile);
  const start = { x: waypoints[0].x, y: waypoints[0].y };
  const end = { x: waypoints[waypoints.length - 1].x, y: waypoints[waypoints.length - 1].y };
  const userWaypoints = waypoints.slice(1, -1).map((pt) => ({ x: pt.x, y: pt.y }));

  return computeRoute({
    room,
    obstacles,
    start,
    end,
    mobilityProfile: canonicalProfile,
    userWaypoints,
  });
}

function getStoreSceneFingerprint(state: SafeSpaceState): string {
  return computeSceneFingerprint({
    furniture: state.furniture,
    waypoints: state.routeWaypoints,
    boundary: state.canonicalBoundary,
    rooms: state.rooms,
    walls: state.walls,
    doors: state.doors,
    profile: state.activeProfile,
  });
}

function persistUserMutation(
  get: () => SafeSpaceState,
  set: (partial: Partial<SafeSpaceState>) => void
): { success: boolean; error?: string } {
  const state = get();
  if (state.assessmentType === "user") {
    const saveRes = savePersistedAssessment({
      schemaVersion: SAFESPACE_STORAGE_VERSION,
      assessmentType: "user",
      metadata: state.assessmentMetadata,
      canonicalBoundary: state.canonicalBoundary,
      calibration: state.calibrationProvenance,
      activeProfileId: state.activeProfile.id,
      activeProfileSnapshot: state.activeProfile,
      routeWaypoints: state.routeWaypoints,
      furniture: state.furniture,
      appliedLayoutBaseline: state.baselineFurnitureSnapshot,
      appliedCandidateId: state.appliedCandidateId,
      appliedSceneFingerprint: state.appliedSceneFingerprint,
    });
    if (saveRes.success) {
      set({ storageStatus: "saved", storageError: null });
      return { success: true };
    } else {
      set({ storageStatus: "error", storageError: saveRes.error });
      return { success: false, error: saveRes.error };
    }
  }
  return { success: true };
}

function invalidateOptimizationAndAppliedBaseline(
  currentFurniture: SpatialFurniture[]
): Partial<SafeSpaceState> {
  return {
    activeOptimizationResult: null,
    selectedCandidateId: null,
    proposedFurniture: cloneFurniture(currentFurniture),
    baselineFurnitureSnapshot: null,
    appliedCandidateId: null,
    appliedSceneFingerprint: null,
  };
}

function getObstaclesInStore(state: {
  furniture: SpatialFurniture[];
  walls?: SpatialWall[];
  doors?: SpatialDoor[];
  ignoreId?: string;
}): ObstacleFootprint[] {
  const obstacles: ObstacleFootprint[] = [];
  for (const f of state.furniture) {
    if (state.ignoreId && f.id === state.ignoreId) continue;
    obstacles.push(furnitureToWorldFootprint(f));
  }
  if (state.walls) {
    for (const w of state.walls) {
      obstacles.push(wallToObstacleFootprint(w));
    }
  }
  if (state.doors) {
    for (const d of state.doors) {
      obstacles.push(doorToObstacleFootprint(d));
    }
  }
  return obstacles;
}

export const useSafeSpaceStore = create<SafeSpaceState>((set, get) => ({
  // Assessment Identity
  assessmentType: "demo",
  assessmentId: "demo-queen-care",
  assessmentMetadata: null,
  canonicalBoundary: null,
  calibrationProvenance: null,
  floorplanImageBlobUrl: null,
  setFloorplanImageBlobUrl: (url) => set({ floorplanImageBlobUrl: url }),
  storageStatus: "idle",
  storageError: null,

  // Workflow stage
  activeStage: "layout",
  setStage: (stage) => set({ activeStage: stage }),

  // Stage 1
  importMode: "ready", // ready for demo clinic by default
  setImportMode: (mode) => set({ importMode: mode }),
  selectedTool: "select",
  setSelectedTool: (tool) => set({ selectedTool: tool }),

  rooms: INITIAL_ROOMS,
  walls: INITIAL_WALLS,
  doors: INITIAL_DOORS,
  furniture: cloneFurniture(INITIAL_FURNITURE),
  hazards: INITIAL_HAZARDS,
  routeWaypoints: INITIAL_ROUTE,
  routeResult: computeStoreRoute(
    INITIAL_FURNITURE,
    INITIAL_ROOMS,
    MOBILITY_PROFILES[0],
    INITIAL_ROUTE,
    INITIAL_WALLS,
    INITIAL_DOORS,
    null
  ),

  selectedFurnitureId: null,
  selectedHazardId: null,
  selectedFindingId: null,
  selectFurniture: (id) =>
    set({ selectedFurnitureId: id, selectedHazardId: null, selectedFindingId: null }),
  selectHazard: (id) =>
    set({ selectedHazardId: id, selectedFurnitureId: null, selectedFindingId: null }),
  selectFinding: (id) =>
    set({ selectedFindingId: id, selectedHazardId: null, selectedFurnitureId: null }),

  showGrid: true,
  setShowGrid: (val) =>
    set((state) => ({ showGrid: typeof val === "function" ? val(state.showGrid) : val })),
  showDimensions: true,
  setShowDimensions: (val) =>
    set((state) => ({ showDimensions: typeof val === "function" ? val(state.showDimensions) : val })),
  snapToGrid: true,
  setSnapToGrid: (val) =>
    set((state) => ({ snapToGrid: typeof val === "function" ? val(state.snapToGrid) : val })),
  zoom: 1,
  setZoom: (zoom) =>
    set((state) => ({ zoom: typeof zoom === "function" ? zoom(state.zoom) : zoom })),
  panOffset: { x: 0, y: 0 },
  setPanOffset: (panOffset) => set({ panOffset }),

  placementError: null,
  clearPlacementError: () => set({ placementError: null }),

  history: [],
  future: [],

  moveFurniture: (id, x, y) => {
    const { furniture, history, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary } = get();
    const item = furniture.find((f) => f.id === id);
    if (!item || item.isFixed) return;

    if (canonicalBoundary && canonicalBoundary.length >= 3) {
      const obstacles = getObstaclesInStore({ furniture, walls, doors, ignoreId: id });
      const targetCenter = { x: x + item.width / 2, y: y + item.depth / 2 };
      const valid = isValidFootprintPlacement(
        {
          position: targetCenter,
          dimensionsCm: { width: item.width, depth: item.depth },
          rotationDeg: item.rotation,
        },
        canonicalBoundary,
        obstacles,
        id
      );
      if (!valid) {
        set({ placementError: "Cannot move item: position exceeds room boundary or collides with existing obstacles." });
        return;
      }
    }

    const newHistory = [...history, cloneFurniture(furniture)].slice(-20);
    const updated = furniture.map((f) => (f.id === id ? { ...f, x, y } : f));
    const newRouteResult = computeStoreRoute(updated, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary);
    set({
      furniture: updated,
      history: newHistory,
      future: [],
      routeResult: newRouteResult,
      placementError: null,
      ...invalidateOptimizationAndAppliedBaseline(updated),
    });
    persistUserMutation(get, set);
  },

  rotateFurniture: (id) => {
    const { furniture, history, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary } = get();
    const item = furniture.find((f) => f.id === id);
    if (!item || item.isFixed) return;

    const newRot = (item.rotation + 90) % 360;

    if (canonicalBoundary && canonicalBoundary.length >= 3) {
      const obstacles = getObstaclesInStore({ furniture, walls, doors, ignoreId: id });
      const center = { x: item.x + item.width / 2, y: item.y + item.depth / 2 };
      const valid = isValidFootprintPlacement(
        {
          position: center,
          dimensionsCm: { width: item.width, depth: item.depth },
          rotationDeg: newRot,
        },
        canonicalBoundary,
        obstacles,
        id
      );
      if (!valid) {
        set({ placementError: "Cannot rotate item: rotated dimensions exceed room boundary or collide with existing obstacles." });
        return;
      }
    }

    const newHistory = [...history, cloneFurniture(furniture)].slice(-20);
    const updated = furniture.map((f) => (f.id === id ? { ...f, rotation: newRot } : f));
    const newRouteResult = computeStoreRoute(updated, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary);
    set({
      furniture: updated,
      history: newHistory,
      future: [],
      routeResult: newRouteResult,
      placementError: null,
      ...invalidateOptimizationAndAppliedBaseline(updated),
    });
    persistUserMutation(get, set);
  },

  confirmFurniture: (id) => {
    const { furniture } = get();
    const updated = furniture.map((f) => (f.id === id ? { ...f, isConfirmed: true } : f));
    set({
      furniture: updated,
      ...invalidateOptimizationAndAppliedBaseline(updated),
    });
    persistUserMutation(get, set);
  },

  confirmAllRemaining: () => {
    const { furniture } = get();
    const updated = furniture.map((f) => ({ ...f, isConfirmed: true }));
    set({
      furniture: updated,
      ...invalidateOptimizationAndAppliedBaseline(updated),
    });
    persistUserMutation(get, set);
  },

  deleteFurniture: (id) => {
    const { furniture, history, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary } = get();
    const item = furniture.find((f) => f.id === id);
    if (!item || item.isFixed) return;

    const newHistory = [...history, cloneFurniture(furniture)].slice(-20);
    const updated = furniture.filter((f) => f.id !== id);
    const newRouteResult = computeStoreRoute(updated, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary);
    set({
      furniture: updated,
      selectedFurnitureId: null,
      history: newHistory,
      future: [],
      routeResult: newRouteResult,
      ...invalidateOptimizationAndAppliedBaseline(updated),
    });
    persistUserMutation(get, set);
  },

  addFurniture: (category) => {
    const { furniture, history, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary } = get();
    const newHistory = [...history, cloneFurniture(furniture)].slice(-20);
    const id = `item-${Date.now()}`;
    const categoryDefaults: Record<SpatialFurniture["category"], { w: number; d: number; h: number; name: string }> = {
      chair: { w: 55, d: 55, h: 80, name: "Armchair" },
      desk: { w: 120, d: 70, h: 75, name: "Consult Desk" },
      table: { w: 100, d: 60, h: 45, name: "Low Table" },
      bench: { w: 140, d: 45, h: 45, name: "Waiting Bench" },
      cabinet: { w: 90, d: 45, h: 120, name: "Storage Cabinet" },
      mat: { w: 80, d: 50, h: 1.5, name: "Floor Mat" },
      light: { w: 30, d: 30, h: 10, name: "Ceiling Downlight" },
      handrail: { w: 150, d: 8, h: 90, name: "Wall Handrail" },
      "medical-fixture": { w: 60, d: 60, h: 100, name: "Medical Dispenser" },
      plant: { w: 40, d: 40, h: 90, name: "Indoor Plant" },
    };

    const def = categoryDefaults[category] || { w: 60, d: 60, h: 75, name: "Item" };
    let posX = 240;
    let posY = 200;
    let rot = 0;

    if (canonicalBoundary && canonicalBoundary.length >= 3) {
      const obstacles = getObstaclesInStore({ furniture, walls, doors });
      const refPoints = furniture.map((f) => ({ x: f.x + f.width / 2, y: f.y + f.depth / 2 }));
      const interiorPt =
        findInteriorProvisionalPoint(canonicalBoundary, "intermediate", refPoints) ||
        findInteriorProvisionalPoint(canonicalBoundary, "start");

      const feasible = findFeasibleFootprintPlacement(
        { width: def.w, depth: def.d },
        canonicalBoundary,
        obstacles,
        interiorPt ? { preferredPoint: interiorPt } : undefined
      );

      if (!feasible) {
        set({
          placementError: "Cannot place item: insufficient space inside room boundary without colliding with obstacles.",
          storageStatus: "error",
          storageError: "Cannot place item: insufficient space inside room boundary without colliding with obstacles.",
        });
        return;
      }

      posX = feasible.position.x - def.w / 2;
      posY = feasible.position.y - def.d / 2;
      rot = feasible.rotationDeg;
    }

    const newItem: SpatialFurniture = {
      id,
      name: def.name,
      category,
      roomId: canonicalBoundary ? "user-space" : rooms[0]?.id || "room-1",
      x: posX,
      y: posY,
      width: def.w,
      depth: def.d,
      height: def.h,
      rotation: rot,
      isFixed: false,
      isConfirmed: false,
      isStableSupport: category === "handrail" || category === "desk",
    };

    const updated = [...furniture, newItem];
    const newRouteResult = computeStoreRoute(updated, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary);
    set({
      furniture: updated,
      selectedFurnitureId: id,
      selectedHazardId: null,
      history: newHistory,
      future: [],
      routeResult: newRouteResult,
      placementError: null,
      ...invalidateOptimizationAndAppliedBaseline(updated),
    });
    persistUserMutation(get, set);
  },

  undo: () => {
    const { history, furniture, future, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary } = get();
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    const newRouteResult = computeStoreRoute(prev, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary);
    set({
      furniture: prev,
      history: history.slice(0, -1),
      future: [cloneFurniture(furniture), ...future],
      routeResult: newRouteResult,
      ...invalidateOptimizationAndAppliedBaseline(prev),
    });
    persistUserMutation(get, set);
  },

  redo: () => {
    const { future, furniture, history, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary } = get();
    if (future.length === 0) return;
    const next = future[0];
    const newRouteResult = computeStoreRoute(next, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary);
    set({
      furniture: next,
      history: [...history, cloneFurniture(furniture)],
      future: future.slice(1),
      routeResult: newRouteResult,
      ...invalidateOptimizationAndAppliedBaseline(next),
    });
    persistUserMutation(get, set);
  },

  // Stage 2
  activeProfileId: "walker",
  activeProfile: MOBILITY_PROFILES[0],
  setProfile: (id) => {
    const found = MOBILITY_PROFILES.find((p) => p.id === id) || MOBILITY_PROFILES[0];
    const { furniture, rooms, routeWaypoints, walls, doors, canonicalBoundary } = get();
    const activeFurn = furniture;
    const newRouteResult = computeStoreRoute(activeFurn, rooms, found, routeWaypoints, walls, doors, canonicalBoundary);
    set({
      activeProfileId: found.id,
      activeProfile: { ...found },
      routeResult: newRouteResult,
      ...invalidateOptimizationAndAppliedBaseline(activeFurn),
    });
    persistUserMutation(get, set);
  },
  updateProfile: (updates) => {
    const updatedProfile = { ...get().activeProfile, ...updates };
    const { furniture, rooms, routeWaypoints, walls, doors, canonicalBoundary } = get();
    const activeFurn = furniture;
    const newRouteResult = computeStoreRoute(activeFurn, rooms, updatedProfile, routeWaypoints, walls, doors, canonicalBoundary);
    set({
      activeProfile: updatedProfile,
      routeResult: newRouteResult,
      ...invalidateOptimizationAndAppliedBaseline(activeFurn),
    });
    persistUserMutation(get, set);
  },

  // Stage 3
  selectedWaypointId: null,
  selectWaypoint: (id) => set({ selectedWaypointId: id }),
  moveRouteWaypoint: (id, x, y) => {
    const { routeWaypoints, furniture, rooms, activeProfile, walls, doors, canonicalBoundary } = get();
    const updated = routeWaypoints.map((pt) => (pt.id === id ? { ...pt, x, y } : pt));
    const activeFurn = furniture;
    const newRouteResult = computeStoreRoute(activeFurn, rooms, activeProfile, updated, walls, doors, canonicalBoundary);
    set({
      routeWaypoints: updated,
      routeResult: newRouteResult,
      ...invalidateOptimizationAndAppliedBaseline(activeFurn),
    });
    persistUserMutation(get, set);
  },
  removeRouteWaypoint: (id) => {
    const { routeWaypoints, furniture, rooms, activeProfile, walls, doors, canonicalBoundary } = get();
    const updated = routeWaypoints.filter((pt) => pt.id !== id);
    const activeFurn = furniture;
    const newRouteResult = computeStoreRoute(activeFurn, rooms, activeProfile, updated, walls, doors, canonicalBoundary);
    set({
      routeWaypoints: updated,
      selectedWaypointId: null,
      routeResult: newRouteResult,
      ...invalidateOptimizationAndAppliedBaseline(activeFurn),
    });
    persistUserMutation(get, set);
  },
  addRouteWaypoint: (name, x, y) => {
    const { routeWaypoints, furniture, rooms, activeProfile, walls, doors, canonicalBoundary } = get();
    const activeFurn = furniture;

    let posX = x;
    let posY = y;

    if (posX === undefined || posY === undefined) {
      if (canonicalBoundary && canonicalBoundary.length >= 3) {
        const pt =
          routeWaypoints.length === 0
            ? findInteriorProvisionalPoint(canonicalBoundary, "start")
            : routeWaypoints.length === 1
            ? findInteriorProvisionalPoint(canonicalBoundary, "end", routeWaypoints)
            : findInteriorProvisionalPoint(canonicalBoundary, "intermediate", routeWaypoints);

        if (!pt) {
          return;
        }
        posX = pt.x;
        posY = pt.y;
      } else {
        if (routeWaypoints.length >= 2) {
          const p1 = routeWaypoints[routeWaypoints.length - 2];
          const p2 = routeWaypoints[routeWaypoints.length - 1];
          posX = Math.round((p1.x + p2.x) / 2);
          posY = Math.round((p1.y + p2.y) / 2);
        } else if (routeWaypoints.length === 1) {
          posX = 450;
          posY = 350;
        } else {
          posX = 200;
          posY = 250;
        }
      }
    }

    const idx = routeWaypoints.length;
    const newWp: RouteWaypoint = {
      id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name || (idx === 0 ? "Start Approach" : idx === 1 ? "Destination" : `Checkpoint ${idx + 1}`),
      x: posX!,
      y: posY!,
      isMandatory: idx === 0 || idx === 1,
    };

    let updated: RouteWaypoint[];
    if (routeWaypoints.length < 2) {
      updated = [...routeWaypoints, newWp];
    } else {
      updated = [
        ...routeWaypoints.slice(0, -1),
        newWp,
        routeWaypoints[routeWaypoints.length - 1],
      ];
    }

    const newRouteResult = computeStoreRoute(activeFurn, rooms, activeProfile, updated, walls, doors, canonicalBoundary);
    set({
      routeWaypoints: updated,
      selectedWaypointId: newWp.id,
      routeResult: newRouteResult,
      ...invalidateOptimizationAndAppliedBaseline(activeFurn),
    });
    persistUserMutation(get, set);
  },
  recalculateRoute: () => {
    const { furniture, rooms, activeProfile, walls, doors, canonicalBoundary, routeWaypoints } = get();
    const activeFurn = furniture;
    const newRouteResult = computeStoreRoute(activeFurn, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary);
    set({
      selectedWaypointId: null,
      routeResult: newRouteResult,
    });
  },
  isWalkerAnimating: false,
  setIsWalkerAnimating: (isWalkerAnimating) => set({ isWalkerAnimating }),

  // Transition modal
  isTransitioning: false,
  transitionStep: 0,
  runAnalysisTransition: () => {
    set({
      isTransitioning: false,
      transitionStep: 0,
      activeStage: "analysis",
    });
  },

  // Stage 4: Analysis
  viewMode: "2d",
  setViewMode: (viewMode) => set({ viewMode }),
  cameraPreset: null,
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  layerToggles: {
    route: true,
    clearance: true,
    heatmap: true,
    hazards: true,
    dimensions: true,
    walls: true,
  },
  toggleLayer: (layer) =>
    set((state) => ({
      layerToggles: { ...state.layerToggles, [layer]: !state.layerToggles[layer] },
    })),

  // Stage 5: Improve
  optimisationObjective: "balanced",
  setOptimisationObjective: (optimisationObjective) => set({ optimisationObjective }),
  selectedAlternativeId: "balanced",
  selectAlternative: (altId) => {
    const { furniture } = get();
    const proposed = generateProposedFurniture(furniture, altId);
    set({ selectedAlternativeId: altId, proposedFurniture: proposed });
  },
  compareMode: "side-by-side",
  setCompareMode: (compareMode) => set({ compareMode }),
  compareSliderPosition: 50,
  setCompareSliderPosition: (compareSliderPosition) => set({ compareSliderPosition }),
  proposedFurniture: generateProposedFurniture(INITIAL_FURNITURE, "balanced"),
  moveProposedFurniture: (id, x, y) => {
    // PREVIEW ONLY: updates proposedFurniture without mutating canonical routeResult
    const { proposedFurniture } = get();
    const updated = proposedFurniture.map((f) => (f.id === id ? { ...f, x, y } : f));
    set({ proposedFurniture: updated });
  },
  approvalStatus: "draft",
  approvePlan: () => set({ approvalStatus: "approved" }),
  requestChanges: () => set({ approvalStatus: "changes-requested" }),
  reportModalOpen: false,
  setReportModalOpen: (reportModalOpen) => set({ reportModalOpen }),

  // Gate 3 Layout Optimization
  activeOptimizationResult: null,
  selectedCandidateId: null,
  appliedCandidateId: null,
  appliedSceneFingerprint: null,
  baselineFurnitureSnapshot: null,
  selectCandidate: (candidateId) => {
    const { activeOptimizationResult, baselineFurnitureSnapshot, furniture } = get();
    if (!candidateId || !activeOptimizationResult) {
      set({
        selectedCandidateId: null,
        proposedFurniture: cloneFurniture(baselineFurnitureSnapshot || furniture),
      });
      return;
    }
    const candidate = activeOptimizationResult.candidates.find((c) => c.id === candidateId);
    if (candidate) {
      // P0 A: Candidate preview MUST NOT mutate canonical routeResult or furniture
      set({
        selectedCandidateId: candidate.id,
        proposedFurniture: cloneFurniture(candidate.furniture),
      });
    } else {
      set({
        selectedCandidateId: null,
        proposedFurniture: cloneFurniture(baselineFurnitureSnapshot || furniture),
      });
    }
  },
  runOptimization: () => {
    const state = get();
    // Do not generate or overwrite optimization while in applied-layout review mode
    if (state.baselineFurnitureSnapshot !== null) {
      return state.activeOptimizationResult ?? {
        status: "unconfigured" as const,
        candidates: [],
        message: "Applied layout review mode active. Revert to original baseline before generating new proposals.",
        baselineEvaluation: state.getSpatialFindings(),
        baselineRouteResult: state.routeResult,
        movableFurnitureCount: state.furniture.filter((f) => !f.isFixed).length,
        unmovableFurnitureCount: state.furniture.filter((f) => f.isFixed).length,
        computeBudget: { maxEvaluations: 0, evaluatedCount: 0, prunedCount: 0, budgetExhausted: false },
        sceneFingerprint: getStoreSceneFingerprint(state),
      };
    }

    // P1 F: Optimize against active furniture
    const targetFurniture = state.furniture;
    const result = optimizeLayout({
      furniture: targetFurniture,
      rooms: state.rooms,
      walls: state.walls,
      doors: state.doors,
      waypoints: state.routeWaypoints,
      profile: state.activeProfile,
      boundary: state.canonicalBoundary,
      assessmentType: state.assessmentType,
    });
    const firstCand = result.candidates[0] ?? null;
    set({
      activeOptimizationResult: result,
      selectedCandidateId: firstCand ? firstCand.id : null,
      proposedFurniture: firstCand ? cloneFurniture(firstCand.furniture) : cloneFurniture(targetFurniture),
    });
    return result;
  },
  applyLayoutCandidate: (candidateId) => {
    const state = get();
    const result = state.activeOptimizationResult;
    if (!result) {
      return { success: false, error: "No active optimization result found" };
    }

    // P0 A & P0 3: Reject stale candidate if exact scene or profile changed
    const currentFingerprint = getStoreSceneFingerprint(state);
    if (result.sceneFingerprint !== currentFingerprint) {
      return { success: false, error: "Scene or profile has changed. Please re-run optimization." };
    }

    const candidate = result.candidates.find((c) => c.id === candidateId);
    if (!candidate) {
      return { success: false, error: "Candidate layout not found" };
    }

    const baseline = state.baselineFurnitureSnapshot || cloneFurniture(state.furniture);
    const updatedFurniture = cloneFurniture(candidate.furniture);
    const updatedRoute = computeStoreRoute(
      updatedFurniture,
      state.rooms,
      state.activeProfile,
      state.routeWaypoints,
      state.walls,
      state.doors,
      state.canonicalBoundary
    );

    const appliedFingerprint = computeSceneFingerprint({
      furniture: updatedFurniture,
      waypoints: state.routeWaypoints,
      boundary: state.canonicalBoundary,
      rooms: state.rooms,
      walls: state.walls,
      doors: state.doors,
      profile: state.activeProfile,
    });

    // P0 B: Commit durable user assessment first with error handling
    if (state.assessmentType === "user") {
      const saveRes = savePersistedAssessment({
        schemaVersion: SAFESPACE_STORAGE_VERSION,
        assessmentType: "user",
        metadata: state.assessmentMetadata,
        canonicalBoundary: state.canonicalBoundary,
        calibration: state.calibrationProvenance,
        activeProfileId: state.activeProfile.id,
        activeProfileSnapshot: state.activeProfile,
        routeWaypoints: state.routeWaypoints,
        furniture: updatedFurniture,
        appliedLayoutBaseline: baseline,
        appliedCandidateId: candidate.id,
        appliedSceneFingerprint: appliedFingerprint,
      });

      if (!saveRes.success) {
        set({
          storageStatus: "error",
          storageError: saveRes.error,
        });
        return { success: false, error: saveRes.error || "Storage quota exceeded or storage failure." };
      }
    }

    // Update in-memory state; keep approvalStatus unchanged (do not claim professional OT sign-off)
    set({
      baselineFurnitureSnapshot: baseline,
      furniture: updatedFurniture,
      proposedFurniture: cloneFurniture(updatedFurniture),
      routeResult: updatedRoute,
      appliedCandidateId: candidate.id,
      appliedSceneFingerprint: appliedFingerprint,
      activeOptimizationResult: null,
      selectedCandidateId: null,
      storageStatus: state.assessmentType === "user" ? "saved" : "idle",
      storageError: null,
    });

    return { success: true };
  },
  revertLayoutCandidate: () => {
    const state = get();
    if (!state.baselineFurnitureSnapshot) {
      return { success: false, error: "No baseline snapshot to revert to." };
    }

    if (state.appliedSceneFingerprint && getStoreSceneFingerprint(state) !== state.appliedSceneFingerprint) {
      return { success: false, error: "Scene has been modified since layout was applied. Reverting would overwrite subsequent edits." };
    }

    const revertedFurniture = cloneFurniture(state.baselineFurnitureSnapshot);
    const revertedRoute = computeStoreRoute(
      revertedFurniture,
      state.rooms,
      state.activeProfile,
      state.routeWaypoints,
      state.walls,
      state.doors,
      state.canonicalBoundary
    );

    if (state.assessmentType === "user") {
      const saveRes = savePersistedAssessment({
        schemaVersion: SAFESPACE_STORAGE_VERSION,
        assessmentType: "user",
        metadata: state.assessmentMetadata,
        canonicalBoundary: state.canonicalBoundary,
        calibration: state.calibrationProvenance,
        activeProfileId: state.activeProfile.id,
        activeProfileSnapshot: state.activeProfile,
        routeWaypoints: state.routeWaypoints,
        furniture: revertedFurniture,
        appliedLayoutBaseline: null,
        appliedCandidateId: null,
        appliedSceneFingerprint: null,
      });

      if (!saveRes.success) {
        set({
          storageStatus: "error",
          storageError: saveRes.error,
        });
        return { success: false, error: saveRes.error || "Failed to persist reverted baseline." };
      }
    }

    set({
      furniture: revertedFurniture,
      proposedFurniture: revertedFurniture,
      routeResult: revertedRoute,
      activeOptimizationResult: null,
      selectedCandidateId: null,
      appliedCandidateId: null,
      appliedSceneFingerprint: null,
      baselineFurnitureSnapshot: null,
      storageStatus: state.assessmentType === "user" ? "saved" : "idle",
      storageError: null,
    });

    return { success: true };
  },

  getSpatialFindings: () => {
    const state = get();
    return evaluateSpatialScene({
      assessmentType: state.assessmentType,
      assessmentMetadata: state.assessmentMetadata,
      canonicalBoundary: state.canonicalBoundary,
      rooms: state.rooms,
      furniture: state.furniture,
      profile: state.activeProfile,
      routeWaypoints: state.routeWaypoints,
      routeResult: state.routeResult,
      doors: state.doors,
      walls: state.walls,
    });
  },

  getLiveMetrics: () => {
    const {
      assessmentType,
      activeStage,
      furniture,
      selectedAlternativeId,
      routeWaypoints,
    } = get();

    if (assessmentType === "user") {
      const evaluation = get().getSpatialFindings();
      const minClearanceCm = evaluation.summary.minimumClearanceCm ?? 0;
      const routeLengthM = evaluation.summary.pathLengthM ?? 0;
      const deficits = evaluation.summary.actionableDeficitsCount;

      return {
        riskIndex: null,
        riskLevel: "Pending Review" as const,
        minClearanceCm,
        routeLengthM,
        constraintWarning:
          deficits > 0
            ? `${deficits} geometric clearance deficit(s) detected along transit corridor.`
            : null,
        activeHazardsCount: deficits,
        highPriorityHazardsCount: deficits,
      };
    }

    const activeFurn = furniture;
    const alt = activeStage === "improve" ? selectedAlternativeId : null;
    return calculateLiveMetrics(activeFurn, alt, routeWaypoints);
  },

  resetToDemo: (initialStage?: unknown) => {
    const currentUrl = get().floorplanImageBlobUrl;
    if (currentUrl) {
      try { URL.revokeObjectURL(currentUrl); } catch {}
    }
    const savedWs = saveActiveWorkspace("demo");
    const defaultProfile = { ...MOBILITY_PROFILES[0] };
    const defaultFurniture = cloneFurniture(INITIAL_FURNITURE);
    const initialProposed = generateProposedFurniture(INITIAL_FURNITURE, "balanced");
    const initialRouteResult = computeStoreRoute(
      defaultFurniture,
      INITIAL_ROOMS,
      defaultProfile,
      INITIAL_ROUTE,
      INITIAL_WALLS,
      INITIAL_DOORS,
      null
    );
    const validStages: readonly WorkflowStage[] = ["layout", "profile", "routes", "analysis", "improve"];
    // ponytail: preserve explicit stage target when navigating demo workspace
    const targetStage: WorkflowStage =
      typeof initialStage === "string" && (validStages as readonly string[]).includes(initialStage)
        ? (initialStage as WorkflowStage)
        : get().assessmentType === "demo"
        ? get().activeStage
        : "layout";
    set({
      assessmentType: "demo",
      assessmentId: "demo-queen-care",
      assessmentMetadata: null,
      canonicalBoundary: null,
      calibrationProvenance: null,
      floorplanImageBlobUrl: null,
      activeStage: targetStage,
      furniture: defaultFurniture,
      walls: INITIAL_WALLS,
      doors: INITIAL_DOORS,
      rooms: INITIAL_ROOMS,
      hazards: INITIAL_HAZARDS,
      activeProfileId: defaultProfile.id,
      activeProfile: defaultProfile,
      routeWaypoints: INITIAL_ROUTE,
      selectedWaypointId: null,
      selectedFurnitureId: null,
      selectedHazardId: null,
      selectedAlternativeId: "balanced",
      proposedFurniture: initialProposed,
      approvalStatus: "draft",
      viewMode: "2d",
      routeResult: initialRouteResult,
      activeOptimizationResult: null,
      selectedCandidateId: null,
      appliedCandidateId: null,
      baselineFurnitureSnapshot: null,
      storageStatus: savedWs ? "idle" : "error",
      storageError: savedWs ? null : "Failed to persist active workspace selection.",
    });
  },

  createAndLoadUserAssessment: async (payload) => {
    const { metadata, boundaryCm, calibration, imageFile } = payload;

    // 0. Pre-flight capture of persisted snapshot before ANY write
    const previousPersisted = getPersistedAssessment();
    const previousPersistedId = previousPersisted?.metadata?.id;
    const previousActiveWs = loadActiveWorkspace();
    const isReusingId = Boolean(previousPersistedId && previousPersistedId === metadata.id);

    let previousImageRecord: PersistedFloorplanImage | null = null;
    if (isReusingId && previousPersistedId) {
      try {
        previousImageRecord = await getFloorplanImage(previousPersistedId);
      } catch {}
    }

    // 1. Validate geometry and metadata inputs
    if (!boundaryCm || !Array.isArray(boundaryCm) || boundaryCm.length < 3) {
      const err = "Boundary requires at least 3 vertices";
      set({ storageStatus: "error", storageError: err });
      return { success: false, error: err };
    }
    const polyValid = validatePolygon2D(boundaryCm);
    if (!polyValid.valid) {
      const err = `Invalid polygon boundary: ${polyValid.errors?.join(", ")}`;
      set({ storageStatus: "error", storageError: err });
      return { success: false, error: err };
    }
    if (!isSimplePolygon(boundaryCm)) {
      const err = "Boundary polygon self-intersects";
      set({ storageStatus: "error", storageError: err });
      return { success: false, error: err };
    }
    if (polygonArea(boundaryCm) <= 1e-3) {
      const err = "Boundary area is zero or near-zero";
      set({ storageStatus: "error", storageError: err });
      return { success: false, error: err };
    }

    // 2. Prepare persisted assessment payload
    const defaultProfile = { ...MOBILITY_PROFILES[0] };
    const savePayload: PersistedAssessmentState = {
      schemaVersion: SAFESPACE_STORAGE_VERSION,
      assessmentType: "user",
      metadata,
      canonicalBoundary: boundaryCm,
      calibration,
      activeProfileId: defaultProfile.id,
      activeProfileSnapshot: defaultProfile,
      routeWaypoints: [],
      furniture: [],
      hasFloorplanImage: Boolean(imageFile),
    };

    // 3. Persist floorplan image to IndexedDB FIRST if provided
    let imageCommitted = false;
    if (imageFile) {
      try {
        const idbSuccess = await saveFloorplanImage({
          assessmentId: metadata.id,
          blob: imageFile,
          mimeType: (imageFile as File).type || "image/png",
          name: (imageFile as File).name || "floorplan",
          size: imageFile.size,
          canvasWidth: 800,
          canvasHeight: 600,
          updatedAt: new Date().toISOString(),
        });
        if (!idbSuccess) {
          const err = "Failed to save floorplan image to local database. Assessment creation aborted to prevent media loss.";
          set({ storageStatus: "error", storageError: err });
          return { success: false, error: err };
        }
        imageCommitted = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const errStr = `IndexedDB storage error: ${msg}`;
        set({ storageStatus: "error", storageError: errStr });
        return { success: false, error: errStr };
      }
    }

    // 4. Persist assessment state to localStorage
    const saveRes = savePersistedAssessment(savePayload);
    if (!saveRes.success) {
      // Rollback media if written
      let rollbackOk = true;
      if (imageCommitted) {
        try {
          if (!isReusingId) {
            rollbackOk = await deleteFloorplanImage(metadata.id);
          } else if (previousImageRecord) {
            rollbackOk = await saveFloorplanImage(previousImageRecord);
          }
        } catch {
          rollbackOk = false;
        }
      }

      // Ensure previous assessment remains in localStorage
      if (previousPersisted) {
        try {
          savePersistedAssessment(previousPersisted);
        } catch {
          rollbackOk = false;
        }
      }

      const err = saveRes.error || "Failed to persist assessment layout to browser storage.";
      const finalErr = rollbackOk
        ? `${err} Previous assessment state preserved.`
        : `${err} Warning: partial rollback failure; database may be in inconsistent state.`;
      set({ storageStatus: "error", storageError: finalErr });
      return { success: false, error: finalErr, rollbackFailed: !rollbackOk };
    }

    // 5. Persist active workspace selection
    const savedWs = saveActiveWorkspace("user");
    if (!savedWs) {
      // ACTIVE WORKSPACE FAILED! ROLLBACK EVERYTHING TO PREVIOUS STATE!
      let rollbackOk = true;

      // 5a. Rollback localStorage
      try {
        if (previousPersisted) {
          const restoreRes = savePersistedAssessment(previousPersisted);
          if (!restoreRes.success) rollbackOk = false;
        } else {
          clearPersistedAssessment();
        }
      } catch {
        rollbackOk = false;
      }

      // 5b. Rollback active workspace
      try {
        saveActiveWorkspace(previousActiveWs);
      } catch {
        rollbackOk = false;
      }

      // 5c. Rollback IndexedDB image
      if (imageCommitted) {
        try {
          if (!isReusingId) {
            const delOk = await deleteFloorplanImage(metadata.id);
            if (!delOk) rollbackOk = false;
          } else if (previousImageRecord) {
            const restOk = await saveFloorplanImage(previousImageRecord);
            if (!restOk) rollbackOk = false;
          }
        } catch {
          rollbackOk = false;
        }
      }

      // 5d. Verify rollback integrity
      const currentPersistedAfterRollback = getPersistedAssessment();
      const verifiedIntact = previousPersisted
        ? currentPersistedAfterRollback?.metadata?.id === previousPersistedId
        : currentPersistedAfterRollback === null;

      if (!verifiedIntact) {
        rollbackOk = false;
      }

      const err = rollbackOk
        ? "Failed to persist active workspace selection. Previous assessment state has been preserved."
        : "Failed to persist active workspace selection, and rollback of previous assessment failed. Storage may be in inconsistent state.";

      set({ storageStatus: "error", storageError: err });
      return { success: false, error: err, rollbackFailed: !rollbackOk };
    }

    // 6. Safe commit point reached! Both stores acknowledged durable writes.
    // Now clean up previous user assessment media if ID changed (derived from PERSISTED previous ID!)
    if (previousPersistedId && previousPersistedId !== metadata.id) {
      try {
        const deletedOld = await deleteFloorplanImage(previousPersistedId);
        if (!deletedOld) {
          console.warn(`Previous assessment image (${previousPersistedId}) could not be cleaned up from IndexedDB.`);
        }
      } catch (err) {
        console.warn(`Previous assessment image cleanup error:`, err);
      }
    }

    // Revoke old URL and create new URL
    const currentUrl = get().floorplanImageBlobUrl;
    if (currentUrl) {
      try { URL.revokeObjectURL(currentUrl); } catch {}
    }
    let imageBlobUrl: string | null = null;
    if (imageFile) {
      try {
        imageBlobUrl = URL.createObjectURL(imageFile);
      } catch {
        imageBlobUrl = null;
      }
    }

    // Update in-memory state
    set({
      assessmentType: "user",
      assessmentId: metadata.id,
      assessmentMetadata: metadata,
      canonicalBoundary: boundaryCm,
      calibrationProvenance: calibration,
      floorplanImageBlobUrl: imageBlobUrl,
      activeProfileId: defaultProfile.id,
      activeProfile: defaultProfile,
      activeStage: "layout",
      rooms: [],
      walls: [],
      doors: [],
      furniture: [],
      hazards: [],
      routeWaypoints: [],
      routeResult: null,
      selectedFurnitureId: null,
      selectedHazardId: null,
      selectedWaypointId: null,
      history: [],
      future: [],
      proposedFurniture: [],
      approvalStatus: "draft",
      viewMode: "2d",
      activeOptimizationResult: null,
      selectedCandidateId: null,
      appliedCandidateId: null,
      baselineFurnitureSnapshot: null,
      storageStatus: "saved",
      storageError: null,
      placementError: null,
    });

    return { success: true, isSaved: true, assessmentId: metadata.id };
  },

  loadDemoAssessment: (initialStage?: unknown) => {
    get().resetToDemo(initialStage);
  },

  resetDemoAssessment: (initialStage?: unknown) => {
    get().resetToDemo(initialStage);
  },

  clearUserAssessment: async () => {
    const currentId = get().assessmentId;
    const delRes = await coordinatedDeleteAssessment(currentId);
    if (!delRes.success) {
      set({
        storageStatus: "error",
        storageError: delRes.error || "Failed to completely delete assessment data from storage.",
      });
      return delRes;
    }

    const currentUrl = get().floorplanImageBlobUrl;
    if (currentUrl) {
      try { URL.revokeObjectURL(currentUrl); } catch {}
    }

    set({
      floorplanImageBlobUrl: null,
      storageStatus: "saved",
      storageError: null,
      placementError: null,
    });
    get().loadDemoAssessment();
    return delRes;
  },

  hydrateFromStorage: () => {
    const res = loadPersistedAssessment();
    if (!res.success) {
      if (res.isCorrupted) {
        set({
          storageStatus: "error",
          storageError: res.error,
        });
      }
      return;
    }

    const data = res.data;
    if (data.assessmentType === "user" && data.canonicalBoundary) {
      const baseProfile =
        MOBILITY_PROFILES.find((p) => p.id === data.activeProfileId) || MOBILITY_PROFILES[0];
      const profile: MobilityProfileData = data.activeProfileSnapshot
        ? {
            ...baseProfile,
            ...data.activeProfileSnapshot,
            minClearanceCm:
              typeof data.activeProfileSnapshot.minClearanceCm === "number" &&
              Number.isFinite(data.activeProfileSnapshot.minClearanceCm) &&
              data.activeProfileSnapshot.minClearanceCm > 0
                ? data.activeProfileSnapshot.minClearanceCm
                : baseProfile.minClearanceCm,
            turningSpaceCm:
              typeof data.activeProfileSnapshot.turningSpaceCm === "number" &&
              Number.isFinite(data.activeProfileSnapshot.turningSpaceCm) &&
              data.activeProfileSnapshot.turningSpaceCm > 0
                ? data.activeProfileSnapshot.turningSpaceCm
                : baseProfile.turningSpaceCm,
          }
        : baseProfile;

      const routeResult = computeStoreRoute(
        data.furniture || [],
        [],
        profile,
        data.routeWaypoints || [],
        [],
        [],
        data.canonicalBoundary
      );

      set({
        assessmentType: "user",
        assessmentId: data.metadata?.id || `assessment-${Date.now()}`,
        assessmentMetadata: data.metadata,
        canonicalBoundary: data.canonicalBoundary,
        calibrationProvenance: data.calibration,
        activeProfileId: profile.id,
        activeProfile: profile,
        furniture: data.furniture || [],
        routeWaypoints: data.routeWaypoints || [],
        rooms: [],
        walls: [],
        doors: [],
        hazards: [],
        routeResult,
        baselineFurnitureSnapshot: data.appliedLayoutBaseline || null,
        appliedCandidateId: data.appliedCandidateId || null,
        appliedSceneFingerprint: data.appliedSceneFingerprint || null,
        storageStatus: "saved",
        storageError: null,
      });

      if (data.metadata?.id) {
        const targetId = data.metadata.id;
        getFloorplanImage(targetId).then((imgRecord) => {
          if (imgRecord && get().assessmentId === targetId) {
            const oldUrl = get().floorplanImageBlobUrl;
            if (oldUrl) {
              try { URL.revokeObjectURL(oldUrl); } catch {}
            }
            const blobUrl = URL.createObjectURL(imgRecord.blob);
            set({ floorplanImageBlobUrl: blobUrl });
          }
        }).catch(() => {});
      }
    }
  },
}));
