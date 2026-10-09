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
  type Polygon2D,
  type RouteResult,
} from "@/lib/spatial";
import {
  SAFESPACE_STORAGE_VERSION,
  savePersistedAssessment,
  loadPersistedAssessment,
  clearPersistedAssessment,
  saveActiveWorkspace,
  type AssessmentMetadata,
  type CalibrationProvenance,
  type PersistedAssessmentState,
} from "@/lib/storage/persistence";

export type WorkflowStage = "layout" | "profile" | "routes" | "analysis" | "improve";

export type EditorTool = "select" | "pan" | "furniture" | "hazard" | "measure";

export interface SafeSpaceState {
  // Assessment Identity & Isolation
  assessmentType: "demo" | "user";
  assessmentId: string;
  assessmentMetadata: AssessmentMetadata | null;
  canonicalBoundary: Polygon2D | null;
  calibrationProvenance: CalibrationProvenance | null;
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
  selectFurniture: (id: string | null) => void;
  selectHazard: (id: string | null) => void;

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

  // Computed helper
  getLiveMetrics: () => ReturnType<typeof calculateLiveMetrics>;
  resetToDemo: () => void;

  // Assessment Lifecycle
  createAndLoadUserAssessment: (payload: {
    metadata: AssessmentMetadata;
    boundaryCm: Polygon2D;
    calibration: CalibrationProvenance;
  }) => { success: boolean; error?: string };
  loadDemoAssessment: () => void;
  resetDemoAssessment: () => void;
  clearUserAssessment: () => void;
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

function computeStoreRoute(
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

function persistUserMutation(
  get: () => SafeSpaceState,
  set: (partial: Partial<SafeSpaceState>) => void
) {
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
    });
    if (saveRes.success) {
      set({ storageStatus: "saved", storageError: null });
    } else {
      set({ storageStatus: "error", storageError: saveRes.error });
    }
  }
}

export const useSafeSpaceStore = create<SafeSpaceState>((set, get) => ({
  // Assessment Identity
  assessmentType: "demo",
  assessmentId: "demo-queen-care",
  assessmentMetadata: null,
  canonicalBoundary: null,
  calibrationProvenance: null,
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
  selectFurniture: (id) =>
    set({ selectedFurnitureId: id, selectedHazardId: null }),
  selectHazard: (id) =>
    set({ selectedHazardId: id, selectedFurnitureId: null }),

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

  history: [],
  future: [],

  moveFurniture: (id, x, y) => {
    const { furniture, history, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary } = get();
    const item = furniture.find((f) => f.id === id);
    if (!item || item.isFixed) return;

    const newHistory = [...history, cloneFurniture(furniture)].slice(-20);
    const updated = furniture.map((f) => (f.id === id ? { ...f, x, y } : f));
    const newRouteResult = computeStoreRoute(updated, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary);
    set({
      furniture: updated,
      history: newHistory,
      future: [],
      routeResult: newRouteResult,
    });
    persistUserMutation(get, set);
  },

  rotateFurniture: (id) => {
    const { furniture, history, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary } = get();
    const item = furniture.find((f) => f.id === id);
    if (!item || item.isFixed) return;

    const newHistory = [...history, cloneFurniture(furniture)].slice(-20);
    const newRot = (item.rotation + 90) % 360;
    const updated = furniture.map((f) => (f.id === id ? { ...f, rotation: newRot } : f));
    const newRouteResult = computeStoreRoute(updated, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary);
    set({
      furniture: updated,
      history: newHistory,
      future: [],
      routeResult: newRouteResult,
    });
    persistUserMutation(get, set);
  },

  confirmFurniture: (id) => {
    const { furniture } = get();
    const updated = furniture.map((f) => (f.id === id ? { ...f, isConfirmed: true } : f));
    set({ furniture: updated });
    persistUserMutation(get, set);
  },

  confirmAllRemaining: () => {
    const { furniture } = get();
    const updated = furniture.map((f) => ({ ...f, isConfirmed: true }));
    set({ furniture: updated });
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
    const newItem: SpatialFurniture = {
      id,
      name: def.name,
      category,
      roomId: canonicalBoundary ? "user-space" : rooms[0]?.id || "room-1",
      x: 240,
      y: 200,
      width: def.w,
      depth: def.d,
      height: def.h,
      rotation: 0,
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
    });
    persistUserMutation(get, set);
  },

  // Stage 2
  activeProfileId: "walker",
  activeProfile: MOBILITY_PROFILES[0],
  setProfile: (id) => {
    const found = MOBILITY_PROFILES.find((p) => p.id === id) || MOBILITY_PROFILES[0];
    const { activeStage, proposedFurniture, furniture, rooms, routeWaypoints, walls, doors, canonicalBoundary } = get();
    const activeFurn = activeStage === "improve" ? proposedFurniture : furniture;
    const newRouteResult = computeStoreRoute(activeFurn, rooms, found, routeWaypoints, walls, doors, canonicalBoundary);
    set({ activeProfileId: found.id, activeProfile: { ...found }, routeResult: newRouteResult });
    persistUserMutation(get, set);
  },
  updateProfile: (updates) => {
    const updatedProfile = { ...get().activeProfile, ...updates };
    const { activeStage, proposedFurniture, furniture, rooms, routeWaypoints, walls, doors, canonicalBoundary } = get();
    const activeFurn = activeStage === "improve" ? proposedFurniture : furniture;
    const newRouteResult = computeStoreRoute(activeFurn, rooms, updatedProfile, routeWaypoints, walls, doors, canonicalBoundary);
    set({
      activeProfile: updatedProfile,
      routeResult: newRouteResult,
    });
    persistUserMutation(get, set);
  },

  // Stage 3
  selectedWaypointId: null,
  selectWaypoint: (id) => set({ selectedWaypointId: id }),
  moveRouteWaypoint: (id, x, y) => {
    const { routeWaypoints, activeStage, proposedFurniture, furniture, rooms, activeProfile, walls, doors, canonicalBoundary } = get();
    const updated = routeWaypoints.map((pt) => (pt.id === id ? { ...pt, x, y } : pt));
    const activeFurn = activeStage === "improve" ? proposedFurniture : furniture;
    const newRouteResult = computeStoreRoute(activeFurn, rooms, activeProfile, updated, walls, doors, canonicalBoundary);
    set({
      routeWaypoints: updated,
      routeResult: newRouteResult,
    });
    persistUserMutation(get, set);
  },
  removeRouteWaypoint: (id) => {
    const { routeWaypoints, activeStage, proposedFurniture, furniture, rooms, activeProfile, walls, doors, canonicalBoundary } = get();
    const updated = routeWaypoints.filter((pt) => pt.id !== id);
    const activeFurn = activeStage === "improve" ? proposedFurniture : furniture;
    const newRouteResult = computeStoreRoute(activeFurn, rooms, activeProfile, updated, walls, doors, canonicalBoundary);
    set({
      routeWaypoints: updated,
      selectedWaypointId: null,
      routeResult: newRouteResult,
    });
    persistUserMutation(get, set);
  },
  addRouteWaypoint: (name, x, y) => {
    const { routeWaypoints, activeStage, proposedFurniture, furniture, rooms, activeProfile, walls, doors, canonicalBoundary } = get();
    const activeFurn = activeStage === "improve" ? proposedFurniture : furniture;

    let posX = x;
    let posY = y;

    if (posX === undefined || posY === undefined) {
      if (canonicalBoundary && canonicalBoundary.length >= 3) {
        if (routeWaypoints.length === 0) {
          const pt = findInteriorProvisionalPoint(canonicalBoundary, "start");
          posX = pt.x;
          posY = pt.y;
        } else if (routeWaypoints.length === 1) {
          const pt = findInteriorProvisionalPoint(canonicalBoundary, "end", routeWaypoints);
          posX = pt.x;
          posY = pt.y;
        } else {
          const pt = findInteriorProvisionalPoint(canonicalBoundary, "intermediate", routeWaypoints);
          posX = pt.x;
          posY = pt.y;
        }
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
      id: `pt-${Date.now()}`,
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
    });
    persistUserMutation(get, set);
  },
  recalculateRoute: () => {
    const { activeStage, proposedFurniture, furniture, rooms, activeProfile, walls, doors, canonicalBoundary, routeWaypoints } = get();
    const activeFurn = activeStage === "improve" ? proposedFurniture : furniture;
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
    set({ isTransitioning: true, transitionStep: 1 });
    setTimeout(() => set({ transitionStep: 2 }), 700);
    setTimeout(() => set({ transitionStep: 3 }), 1400);
    setTimeout(() => {
      set({ isTransitioning: false, activeStage: "analysis" });
    }, 2100);
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
    const { proposedFurniture, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary } = get();
    const updated = proposedFurniture.map((f) => (f.id === id ? { ...f, x, y } : f));
    const newRouteResult = computeStoreRoute(updated, rooms, activeProfile, routeWaypoints, walls, doors, canonicalBoundary);
    set({ proposedFurniture: updated, routeResult: newRouteResult });
  },
  approvalStatus: "draft",
  approvePlan: () => set({ approvalStatus: "approved" }),
  requestChanges: () => set({ approvalStatus: "changes-requested" }),
  reportModalOpen: false,
  setReportModalOpen: (reportModalOpen) => set({ reportModalOpen }),

  getLiveMetrics: () => {
    const {
      assessmentType,
      activeStage,
      furniture,
      proposedFurniture,
      selectedAlternativeId,
      routeWaypoints,
      routeResult,
      activeProfile,
    } = get();

    if (assessmentType === "user") {
      const isSuccess = routeResult?.status === "success";
      const requiredRadiusCm = activeProfile.minClearanceCm / 2;
      const minClearanceCm = isSuccess ? Math.round(routeResult.minimumClearanceCm) : 0;
      const routeLengthM = isSuccess ? Number((routeResult.pathLengthCm / 100).toFixed(1)) : 0;
      const isDeficit = isSuccess && routeResult.minimumClearanceCm < requiredRadiusCm;

      return {
        riskIndex: null,
        riskLevel: "Pending Review" as const,
        minClearanceCm,
        routeLengthM,
        constraintWarning: isDeficit
          ? `Narrowest path margin (${minClearanceCm} cm) is below required margin (≥ ${requiredRadiusCm} cm).`
          : null,
        activeHazardsCount: 0,
        highPriorityHazardsCount: 0,
      };
    }

    const activeFurn = activeStage === "improve" ? proposedFurniture : furniture;
    const alt = activeStage === "improve" ? selectedAlternativeId : null;
    return calculateLiveMetrics(activeFurn, alt, routeWaypoints);
  },

  resetToDemo: () => {
    saveActiveWorkspace("demo");
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
    set({
      assessmentType: "demo",
      assessmentId: "demo-queen-care",
      assessmentMetadata: null,
      canonicalBoundary: null,
      calibrationProvenance: null,
      activeStage: "layout",
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
      storageStatus: "idle",
      storageError: null,
    });
  },

  createAndLoadUserAssessment: (payload) => {
    const { metadata, boundaryCm, calibration } = payload;

    // Validate geometry and inputs
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
    };

    const saveRes = savePersistedAssessment(savePayload);
    if (!saveRes.success) {
      set({
        storageStatus: "error",
        storageError: saveRes.error,
      });
      return { success: false, error: saveRes.error };
    }

    saveActiveWorkspace("user");

    set({
      assessmentType: "user",
      assessmentId: metadata.id,
      assessmentMetadata: metadata,
      canonicalBoundary: boundaryCm,
      calibrationProvenance: calibration,
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
      storageStatus: "saved",
      storageError: null,
    });

    return { success: true };
  },

  loadDemoAssessment: () => {
    get().resetToDemo();
  },

  resetDemoAssessment: () => {
    get().resetToDemo();
  },

  clearUserAssessment: () => {
    clearPersistedAssessment();
    get().loadDemoAssessment();
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
        storageStatus: "saved",
        storageError: null,
      });
    }
  },
}));
