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

export type WorkflowStage = "layout" | "profile" | "routes" | "analysis" | "improve";

export type EditorTool = "select" | "pan" | "furniture" | "hazard" | "measure";

export interface SafeSpaceState {
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
  recalculateRoute: () => void;
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

export const useSafeSpaceStore = create<SafeSpaceState>((set, get) => ({
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
    const { furniture, history } = get();
    const item = furniture.find((f) => f.id === id);
    if (!item || item.isFixed) return;

    const newHistory = [...history, cloneFurniture(furniture)].slice(-20);
    const updated = furniture.map((f) => (f.id === id ? { ...f, x, y } : f));
    set({
      furniture: updated,
      history: newHistory,
      future: [],
    });
  },

  rotateFurniture: (id) => {
    const { furniture, history } = get();
    const item = furniture.find((f) => f.id === id);
    if (!item || item.isFixed) return;

    const newHistory = [...history, cloneFurniture(furniture)].slice(-20);
    const newRot = (item.rotation + 90) % 360;
    const updated = furniture.map((f) => (f.id === id ? { ...f, rotation: newRot } : f));
    set({
      furniture: updated,
      history: newHistory,
      future: [],
    });
  },

  confirmFurniture: (id) => {
    const { furniture } = get();
    const updated = furniture.map((f) => (f.id === id ? { ...f, isConfirmed: true } : f));
    set({ furniture: updated });
  },

  confirmAllRemaining: () => {
    const { furniture } = get();
    const updated = furniture.map((f) => ({ ...f, isConfirmed: true }));
    set({ furniture: updated });
  },

  deleteFurniture: (id) => {
    const { furniture, history } = get();
    const item = furniture.find((f) => f.id === id);
    if (!item || item.isFixed) return;

    const newHistory = [...history, cloneFurniture(furniture)].slice(-20);
    const updated = furniture.filter((f) => f.id !== id);
    set({
      furniture: updated,
      selectedFurnitureId: null,
      history: newHistory,
      future: [],
    });
  },

  addFurniture: (category) => {
    const { furniture, history } = get();
    const newHistory = [...history, cloneFurniture(furniture)].slice(-20);
    const id = `item-${Date.now()}`;
    const newItem: SpatialFurniture = {
      id,
      name: `Added ${category}`,
      category,
      roomId: "room-waiting",
      x: 200,
      y: 180,
      width: category === "chair" ? 55 : category === "table" ? 60 : 70,
      depth: category === "chair" ? 55 : category === "table" ? 60 : 50,
      height: 80,
      rotation: 0,
      isFixed: false,
      isStableSupport: category === "chair" || category === "bench",
      isConfirmed: true,
      detectionConfidence: 1.0,
    };
    set({
      furniture: [...furniture, newItem],
      selectedFurnitureId: id,
      history: newHistory,
      future: [],
    });
  },

  undo: () => {
    const { history, furniture, future } = get();
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    set({
      furniture: prev,
      history: history.slice(0, -1),
      future: [cloneFurniture(furniture), ...future],
    });
  },

  redo: () => {
    const { future, furniture, history } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      furniture: next,
      history: [...history, cloneFurniture(furniture)],
      future: future.slice(1),
    });
  },

  // Stage 2
  activeProfileId: "walker",
  activeProfile: MOBILITY_PROFILES[0],
  setProfile: (id) => {
    const found = MOBILITY_PROFILES.find((p) => p.id === id) || MOBILITY_PROFILES[0];
    set({ activeProfileId: id, activeProfile: { ...found } });
  },
  updateProfile: (updates) => {
    set((state) => ({
      activeProfile: { ...state.activeProfile, ...updates },
    }));
  },

  // Stage 3
  selectedWaypointId: null,
  selectWaypoint: (id) => set({ selectedWaypointId: id }),
  moveRouteWaypoint: (id, x, y) => {
    set((state) => ({
      routeWaypoints: state.routeWaypoints.map((pt) => (pt.id === id ? { ...pt, x, y } : pt)),
    }));
  },
  removeRouteWaypoint: (id) => {
    set((state) => ({
      routeWaypoints: state.routeWaypoints.filter((pt) => pt.id !== id),
      selectedWaypointId: null,
    }));
  },
  recalculateRoute: () => {
    set({ routeWaypoints: INITIAL_ROUTE });
  },
  isWalkerAnimating: true,
  setIsWalkerAnimating: (val) => set({ isWalkerAnimating: val }),

  // Transition
  isTransitioning: false,
  transitionStep: 0,
  runAnalysisTransition: () => {
    set({ isTransitioning: true, transitionStep: 0 });
    const interval = setInterval(() => {
      const current = get().transitionStep;
      if (current < 4) {
        set({ transitionStep: current + 1 });
      } else {
        clearInterval(interval);
        setTimeout(() => {
          set({ isTransitioning: false, activeStage: "analysis" });
        }, 400);
      }
    }, 450);
  },

  // Stage 4
  viewMode: "2d",
  setViewMode: (viewMode) => set({ viewMode }),
  cameraPreset: "isometric",
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
      layerToggles: {
        ...state.layerToggles,
        [layer]: !state.layerToggles[layer],
      },
    })),

  // Stage 5
  optimisationObjective: "balanced",
  setOptimisationObjective: (optimisationObjective) => set({ optimisationObjective }),
  selectedAlternativeId: "balanced",
  selectAlternative: (altId) => {
    const proposed = generateProposedFurniture(get().furniture, altId);
    set({ selectedAlternativeId: altId, proposedFurniture: proposed });
  },
  compareMode: "side-by-side",
  setCompareMode: (compareMode) => set({ compareMode }),
  compareSliderPosition: 50,
  setCompareSliderPosition: (compareSliderPosition) => set({ compareSliderPosition }),
  proposedFurniture: generateProposedFurniture(INITIAL_FURNITURE, "balanced"),
  moveProposedFurniture: (id, x, y) => {
    const { proposedFurniture } = get();
    const updated = proposedFurniture.map((f) => (f.id === id ? { ...f, x, y } : f));
    set({ proposedFurniture: updated });
  },
  approvalStatus: "draft",
  approvePlan: () => set({ approvalStatus: "approved" }),
  requestChanges: () => set({ approvalStatus: "changes-requested" }),
  reportModalOpen: false,
  setReportModalOpen: (reportModalOpen) => set({ reportModalOpen }),

  getLiveMetrics: () => {
    const { activeStage, furniture, proposedFurniture, selectedAlternativeId, routeWaypoints } = get();
    const activeFurn = activeStage === "improve" ? proposedFurniture : furniture;
    const alt = activeStage === "improve" ? selectedAlternativeId : null;
    return calculateLiveMetrics(activeFurn, alt, routeWaypoints);
  },

  resetToDemo: () => {
    set({
      activeStage: "layout",
      furniture: cloneFurniture(INITIAL_FURNITURE),
      hazards: INITIAL_HAZARDS,
      routeWaypoints: INITIAL_ROUTE,
      selectedFurnitureId: null,
      selectedHazardId: null,
      selectedAlternativeId: "balanced",
      proposedFurniture: generateProposedFurniture(INITIAL_FURNITURE, "balanced"),
      approvalStatus: "draft",
      viewMode: "2d",
    });
  },
}));
