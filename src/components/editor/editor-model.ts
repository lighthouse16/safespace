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
  readOnly?: boolean;
};

export const editorPalette = {
  ink: "#243238", muted: "#75848a", line: "#bdc8c9",
  floor: "#eef1ed", room: "#f8faf7",
  teal: "#237d78", tealSoft: "#b8d9d4",
  amber: "#d99132", red: "#c9574d", route: "#176c68",
};

/*
 * Queen Care Clinic — Waiting Area and Consultation Corridor
 * Scale 1:50 → 1 unit ≈ 1 cm
 * Area ~800×600 cm (8 × 6 m)
 *
 * Mobility profile: Older adult using a walker (min 90 cm clearance).
 * Critical route: Entrance → Reception → Waiting Seat → Consultation Room.
 * Current: Waiting chair and desk corner narrow route, clearance 54 cm (need 90 cm).
 * Proposed: Relocated chairs, wall handrail, doorway lighting, clearance 96 cm.
 */
export const currentPlan: EditorPlan = {
  width: 800, depth: 600,
  rooms: [
    { id: "waiting", label: "WAITING AREA", x: 40, y: 40, width: 460, depth: 380 },
    { id: "reception", label: "RECEPTION ALCOVE", x: 500, y: 40, width: 260, depth: 200 },
    { id: "storage", label: "RECORDS & STORAGE", x: 500, y: 240, width: 260, depth: 180 },
    { id: "corridor", label: "CONSULTATION CORRIDOR", x: 40, y: 420, width: 720, depth: 140 },
  ],
  furniture: [
    // Reception desk with corner close to route
    { id: "reception-desk", label: "Reception counter", kind: "desk", x: 520, y: 100, width: 180, depth: 70, movable: false },
    // Waiting chairs (Chair 1 narrows route clearance to 54 cm)
    { id: "chair-1", label: "Waiting chair A", kind: "chair", x: 235, y: 235, width: 52, depth: 52, movable: true },
    { id: "chair-2", label: "Waiting chair B", kind: "chair", x: 295, y: 235, width: 52, depth: 52, movable: true },
    { id: "chair-3", label: "Waiting chair C", kind: "chair", x: 235, y: 140, width: 52, depth: 52, movable: true },
    { id: "chair-4", label: "Waiting chair D", kind: "chair", x: 295, y: 140, width: 52, depth: 52, movable: true },
    // Rest bench in waiting area
    { id: "bench", label: "Waiting bench", kind: "bench", x: 80, y: 80, width: 140, depth: 45, movable: true },
    // Magazine table (sharp corner)
    { id: "corner-table", label: "Magazine table", kind: "desk", x: 400, y: 170, width: 50, depth: 50, movable: true },
    // Water dispenser
    { id: "dispenser", label: "Water dispenser", kind: "cabinet", x: 430, y: 60, width: 45, depth: 45 },
    // Pamphlet rack / bookshelf
    { id: "bookshelf", label: "Health brochure rack", kind: "shelf", x: 80, y: 310, width: 60, depth: 30 },
    // Plants
    { id: "plant-1", label: "Indoor plant", kind: "plant", x: 60, y: 60, width: 40, depth: 40 },
    { id: "plant-2", label: "Corridor planter", kind: "plant", x: 465, y: 440, width: 40, depth: 40 },
    // Patient queue display
    { id: "tv", label: "Queue display TV", kind: "tv", x: 580, y: 60, width: 100, depth: 20 },
    // Corridor rest bench
    { id: "corridor-bench", label: "Corridor bench", kind: "bench", x: 200, y: 465, width: 140, depth: 45, movable: true },
    // Consultation room desk
    { id: "consultation-desk", label: "Consultation desk", kind: "desk", x: 560, y: 450, width: 160, depth: 60 },
    // Records cabinet
    { id: "records-cabinet", label: "Records cabinet", kind: "cabinet", x: 560, y: 280, width: 60, depth: 80 },
  ],
  // Critical route: Entrance → Reception → Waiting Seat → Consultation Room (clearance 54 cm at chair-1)
  route: [
    { x: 50, y: 240 },   // Entrance door
    { x: 150, y: 240 },  // Entry foyer
    { x: 220, y: 200 },  // Approach toward reception
    { x: 290, y: 190 },  // Squeeze past Chair A (54 cm clearance pinch point!)
    { x: 400, y: 230 },  // Turn past sharp corner
    { x: 450, y: 330 },  // Poor doorway lighting threshold
    { x: 450, y: 440 },  // Into corridor (2.1m section without handrail)
    { x: 700, y: 490 },  // To Consultation Room
  ],
};

/*
 * Proposed layout — "Balanced" option
 * Moves: Waiting chairs relocated to perimeter, handrail mounted, doorway lighting upgraded
 * Result: clearance 54→96 cm, risk 68→27, cost HK$850
 */
export const proposedPlan: EditorPlan = {
  ...currentPlan,
  furniture: [
    { id: "reception-desk", label: "Reception counter", kind: "desk", x: 520, y: 100, width: 180, depth: 70, movable: false },
    // Chairs A & B moved to perimeter wall away from transit path
    { id: "chair-1", label: "Waiting chair A", kind: "chair", x: 80, y: 160, width: 52, depth: 52, movable: true },
    { id: "chair-2", label: "Waiting chair B", kind: "chair", x: 140, y: 160, width: 52, depth: 52, movable: true },
    { id: "chair-3", label: "Waiting chair C", kind: "chair", x: 235, y: 110, width: 52, depth: 52, movable: true },
    { id: "chair-4", label: "Waiting chair D", kind: "chair", x: 295, y: 110, width: 52, depth: 52, movable: true },
    { id: "bench", label: "Waiting bench", kind: "bench", x: 80, y: 80, width: 140, depth: 45, movable: true },
    { id: "corner-table", label: "Magazine table", kind: "desk", x: 430, y: 110, width: 50, depth: 50, movable: true },
    { id: "dispenser", label: "Water dispenser", kind: "cabinet", x: 430, y: 60, width: 45, depth: 45 },
    { id: "bookshelf", label: "Health brochure rack", kind: "shelf", x: 80, y: 310, width: 60, depth: 30 },
    { id: "plant-1", label: "Indoor plant", kind: "plant", x: 60, y: 60, width: 40, depth: 40 },
    { id: "plant-2", label: "Corridor planter", kind: "plant", x: 465, y: 440, width: 40, depth: 40 },
    { id: "tv", label: "Queue display TV", kind: "tv", x: 580, y: 60, width: 100, depth: 20 },
    { id: "corridor-bench", label: "Corridor bench", kind: "bench", x: 200, y: 465, width: 140, depth: 45, movable: true },
    { id: "consultation-desk", label: "Consultation desk", kind: "desk", x: 560, y: 450, width: 160, depth: 60 },
    { id: "records-cabinet", label: "Records cabinet", kind: "cabinet", x: 560, y: 280, width: 60, depth: 80 },
  ],
  // Wide straight route with 96 cm clearance throughout
  route: [
    { x: 50, y: 240 },
    { x: 180, y: 240 },
    { x: 320, y: 240 },  // Straight through transit zone (96 cm clearance)
    { x: 450, y: 260 },
    { x: 450, y: 440 },  // Along handrail-equipped corridor
    { x: 700, y: 490 },  // Consultation Room
  ],
};

// Backward compatibility alias
export const clinicPlan = currentPlan;

export function clampFurniture(item: EditorFurniture, point: Point, plan: EditorPlan): Point {
  return {
    x: Math.max(8, Math.min(plan.width - item.width - 8, point.x)),
    y: Math.max(8, Math.min(plan.depth - item.depth - 8, point.y)),
  };
}
