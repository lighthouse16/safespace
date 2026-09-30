import type { BoundaryState, Point2D } from "./intake-view-types";

export const MIN_BOUNDARY_VERTICES = 3;

export function canCloseBoundary(vertices: Point2D[]): boolean {
  return vertices.length >= MIN_BOUNDARY_VERTICES;
}

export function addBoundaryVertex(vertices: Point2D[], point: Point2D): Point2D[] {
  return [...vertices, point];
}

export function undoBoundaryVertex(vertices: Point2D[]): Point2D[] {
  if (vertices.length === 0) return [];
  return vertices.slice(0, -1);
}

export function closeBoundary(boundary: BoundaryState): BoundaryState {
  if (!canCloseBoundary(boundary.vertices) || boundary.isClosed) {
    return boundary;
  }
  return {
    ...boundary,
    isClosed: true,
    selectedVertexIndex: null,
  };
}

export function moveBoundaryVertex(
  vertices: Point2D[],
  index: number,
  newPoint: Point2D
): Point2D[] {
  if (index < 0 || index >= vertices.length) return vertices;
  const next = [...vertices];
  next[index] = newPoint;
  return next;
}

export function resetBoundaryForSourceChange(prevBoundary: BoundaryState): BoundaryState {
  return {
    vertices: [],
    isClosed: false,
    selectedVertexIndex: null,
    gridSnap: prevBoundary.gridSnap,
  };
}
