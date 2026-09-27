export type Point = { x: number; y: number };
export type FurnitureKind = "chair" | "desk" | "plant" | "cabinet" | "bench" | "shelf" | "tv";
export type EditorFurniture = {
  id: string; label: string; kind: FurnitureKind;
  x: number; y: number; width: number; depth: number;
  rotation?: number; movable?: boolean;
};
export type EditorRoom = { id: string; label: string; x: number; y: number; width: number; depth: number };
export type EditorPlan = { width: number; depth: number; rooms: EditorRoom[]; furniture: EditorFurniture[]; route: Point[] };
export type EditorViewProps = {
  plan?: EditorPlan; selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onFurnitureMove?: (id: string, position: Point) => void;
  showHeatmap?: boolean; showRoute?: boolean; className?: string;
};

export const editorPalette = {
  ink: "#243238", muted: "#75848a", line: "#bdc8c9",
  floor: "#eef1ed", room: "#f8faf7",
  teal: "#237d78", tealSoft: "#b8d9d4",
  amber: "#d99132", red: "#c9574d", route: "#176c68",
};

/*
 * Harmony Elder Care Centre — Activity Room
 * Scale 1:50 → 1 unit ≈ 1 cm
 * Room ~800×600 cm (8 × 6 m)
 *
 * Layout: Main activity room with group tables, seating,
 * kitchenette alcove, storage, and corridor to WC.
 *
 * Risk scenario: Mrs. Chan, 78, uses walker.
 * Route from entrance → activity area → WC corridor.
 * Current: chairs and table block primary route, clearance 52 cm (need 90 cm).
 */
export const currentPlan: EditorPlan = {
  width: 800, depth: 600,
  rooms: [
    { id: "activity", label: "ACTIVITY ROOM", x: 40, y: 40, width: 480, depth: 400 },
    { id: "kitchen", label: "KITCHENETTE", x: 520, y: 40, width: 240, depth: 200 },
    { id: "storage", label: "STORAGE", x: 520, y: 240, width: 240, depth: 200 },
    { id: "corridor", label: "WC CORRIDOR", x: 40, y: 440, width: 720, depth: 120 },
  ],
  furniture: [
    // Group table A — center of activity room (blocks route)
    { id: "table-a", label: "Group table A", kind: "desk", x: 180, y: 150, width: 160, depth: 90, movable: true },
    // Chairs around table A
    { id: "chair-1", label: "Chair 1", kind: "chair", x: 150, y: 120, width: 48, depth: 48, movable: true },
    { id: "chair-2", label: "Chair 2", kind: "chair", x: 310, y: 120, width: 48, depth: 48, movable: true },
    { id: "chair-3", label: "Chair 3", kind: "chair", x: 150, y: 250, width: 48, depth: 48, movable: true },
    { id: "chair-4", label: "Chair 4", kind: "chair", x: 310, y: 250, width: 48, depth: 48, movable: true },
    // Group table B — near wall, less problematic
    { id: "table-b", label: "Group table B", kind: "desk", x: 80, y: 310, width: 120, depth: 80, movable: true },
    // Chairs around table B
    { id: "chair-5", label: "Chair 5", kind: "chair", x: 60, y: 290, width: 48, depth: 48, movable: true },
    { id: "chair-6", label: "Chair 6", kind: "chair", x: 170, y: 290, width: 48, depth: 48, movable: true },
    // Bookshelf — against east wall of activity room
    { id: "bookshelf", label: "Bookshelf", kind: "shelf", x: 430, y: 100, width: 60, depth: 30 },
    // Cabinet — near corridor entry, creates pinch point
    { id: "cabinet", label: "Supply cabinet", kind: "cabinet", x: 400, y: 350, width: 50, depth: 80, movable: true },
    // Plants
    { id: "plant-1", label: "Indoor plant", kind: "plant", x: 60, y: 60, width: 40, depth: 40 },
    { id: "plant-2", label: "Indoor plant", kind: "plant", x: 465, y: 60, width: 40, depth: 40 },
    // TV on wall stand — kitchenette area
    { id: "tv", label: "Wall TV", kind: "tv", x: 580, y: 60, width: 100, depth: 20 },
    // Kitchenette counter
    { id: "counter", label: "Kitchen counter", kind: "desk", x: 560, y: 130, width: 180, depth: 60 },
    // Bench in corridor
    { id: "bench", label: "Rest bench", kind: "bench", x: 200, y: 465, width: 140, depth: 45, movable: true },
  ],
  // Mrs. Chan's route: Entrance (left wall) → across activity room → WC corridor (right side)
  route: [
    { x: 50, y: 240 },   // entrance door
    { x: 130, y: 240 },  // into room
    { x: 200, y: 200 },  // forced detour around table A
    { x: 280, y: 160 },  // squeeze between chairs
    { x: 370, y: 200 },  // past table A
    { x: 420, y: 320 },  // near cabinet — pinch point (52 cm!)
    { x: 440, y: 440 },  // into corridor
    { x: 700, y: 490 },  // toward WC
  ],
};

/*
 * Proposed layout — "Balanced" option
 * Moves: table A shifted north, cabinet relocated, chair-4 rotated
 * Result: clearance 52→96 cm, risk 68→27, cost HK$850
 */
export const proposedPlan: EditorPlan = {
  ...currentPlan,
  furniture: [
    // Table A — shifted north, away from main route
    { id: "table-a", label: "Group table A", kind: "desk", x: 180, y: 80, width: 160, depth: 90, movable: true },
    // Chairs repositioned around new table A position
    { id: "chair-1", label: "Chair 1", kind: "chair", x: 150, y: 55, width: 48, depth: 48, movable: true },
    { id: "chair-2", label: "Chair 2", kind: "chair", x: 310, y: 55, width: 48, depth: 48, movable: true },
    { id: "chair-3", label: "Chair 3", kind: "chair", x: 150, y: 180, width: 48, depth: 48, movable: true },
    { id: "chair-4", label: "Chair 4", kind: "chair", x: 310, y: 180, width: 48, depth: 48, movable: true },
    // Table B — unchanged
    { id: "table-b", label: "Group table B", kind: "desk", x: 80, y: 310, width: 120, depth: 80, movable: true },
    { id: "chair-5", label: "Chair 5", kind: "chair", x: 60, y: 290, width: 48, depth: 48, movable: true },
    { id: "chair-6", label: "Chair 6", kind: "chair", x: 170, y: 290, width: 48, depth: 48, movable: true },
    // Bookshelf — unchanged
    { id: "bookshelf", label: "Bookshelf", kind: "shelf", x: 430, y: 100, width: 60, depth: 30 },
    // Cabinet — relocated to storage room
    { id: "cabinet", label: "Supply cabinet", kind: "cabinet", x: 560, y: 280, width: 50, depth: 80, movable: true },
    // Plants — unchanged
    { id: "plant-1", label: "Indoor plant", kind: "plant", x: 60, y: 60, width: 40, depth: 40 },
    { id: "plant-2", label: "Indoor plant", kind: "plant", x: 465, y: 60, width: 40, depth: 40 },
    // TV — unchanged
    { id: "tv", label: "Wall TV", kind: "tv", x: 580, y: 60, width: 100, depth: 20 },
    // Counter — unchanged
    { id: "counter", label: "Kitchen counter", kind: "desk", x: 560, y: 130, width: 180, depth: 60 },
    // Bench — unchanged
    { id: "bench", label: "Rest bench", kind: "bench", x: 200, y: 465, width: 140, depth: 45, movable: true },
  ],
  // Clear straight route after reorganization
  route: [
    { x: 50, y: 240 },
    { x: 150, y: 250 },
    { x: 280, y: 260 },  // straight through — no detour needed
    { x: 400, y: 280 },  // wide clearance (96 cm)
    { x: 440, y: 400 },
    { x: 440, y: 460 },
    { x: 700, y: 490 },
  ],
};

// Keep backward compat alias
export const clinicPlan = currentPlan;

export function clampFurniture(item: EditorFurniture, point: Point, plan: EditorPlan): Point {
  return {
    x: Math.max(8, Math.min(plan.width - item.width - 8, point.x)),
    y: Math.max(8, Math.min(plan.depth - item.depth - 8, point.y)),
  };
}
