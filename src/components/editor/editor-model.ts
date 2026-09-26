export type Point = { x: number; y: number };
export type FurnitureKind = "chair" | "desk" | "plant" | "cabinet" | "bench";
export type EditorFurniture = { id: string; label: string; kind: FurnitureKind; x: number; y: number; width: number; depth: number; rotation?: number; movable?: boolean };
export type EditorRoom = { id: string; label: string; x: number; y: number; width: number; depth: number };
export type EditorPlan = { width: number; depth: number; rooms: EditorRoom[]; furniture: EditorFurniture[]; route: Point[] };
export type EditorViewProps = { plan?: EditorPlan; selectedId?: string | null; onSelect?: (id: string | null) => void; onFurnitureMove?: (id: string, position: Point) => void; showHeatmap?: boolean; showRoute?: boolean; className?: string };

export const editorPalette = { ink: "#243238", muted: "#75848a", line: "#bdc8c9", floor: "#eef1ed", room: "#f8faf7", teal: "#237d78", tealSoft: "#b8d9d4", amber: "#d99132", red: "#c9574d", route: "#176c68" };

export const clinicPlan: EditorPlan = {
  width: 960, depth: 620,
  rooms: [
    { id: "waiting", label: "WAITING AREA", x: 60, y: 55, width: 550, depth: 360 },
    { id: "reception", label: "RECEPTION", x: 610, y: 55, width: 290, depth: 210 },
    { id: "consult", label: "CONSULT 01", x: 610, y: 265, width: 290, depth: 300 },
    { id: "corridor", label: "ACCESS ROUTE", x: 60, y: 415, width: 550, depth: 150 },
  ],
  furniture: [
    { id: "chair-a", label: "Visitor chair A", kind: "chair", x: 145, y: 130, width: 58, depth: 58, movable: true },
    { id: "chair-b", label: "Visitor chair B", kind: "chair", x: 145, y: 225, width: 58, depth: 58, movable: true },
    { id: "chair-c", label: "Visitor chair C", kind: "chair", x: 145, y: 320, width: 58, depth: 58, movable: true },
    { id: "bench", label: "Waiting bench", kind: "bench", x: 355, y: 100, width: 170, depth: 52, movable: true },
    { id: "route-chair", label: "Chair — route obstruction", kind: "chair", x: 435, y: 335, width: 62, depth: 62, movable: true },
    { id: "reception-desk", label: "Reception desk", kind: "desk", x: 660, y: 125, width: 190, depth: 68 },
    { id: "cabinet", label: "Clinical cabinet", kind: "cabinet", x: 805, y: 330, width: 54, depth: 150 },
    { id: "consult-desk", label: "Consultation desk", kind: "desk", x: 670, y: 350, width: 110, depth: 70, movable: true },
    { id: "plant", label: "Indoor plant", kind: "plant", x: 545, y: 105, width: 44, depth: 44, movable: true },
  ],
  route: [{ x: 80, y: 490 }, { x: 235, y: 490 }, { x: 300, y: 420 }, { x: 385, y: 360 }, { x: 480, y: 300 }, { x: 590, y: 285 }, { x: 660, y: 300 }, { x: 710, y: 345 }],
};

export function clampFurniture(item: EditorFurniture, point: Point, plan: EditorPlan): Point {
  return { x: Math.max(8, Math.min(plan.width - item.width - 8, point.x)), y: Math.max(8, Math.min(plan.depth - item.depth - 8, point.y)) };
}
