"use client";
import { create } from "zustand";
import { mockData } from "@/lib/mock-data";
import type { DomainData, ID, Point, WorkflowStep } from "@/lib/types";

type Snapshot = Pick<DomainData, "assessments" | "furniture">;
type Camera = { zoom: number; offset: Point; view: "2d" | "3d" };
interface AssessmentStore extends DomainData {
  selectedId?: ID;
  camera: Camera;
  past: Snapshot[];
  future: Snapshot[];
  select: (id?: ID) => void;
  setCamera: (camera: Partial<Camera>) => void;
  moveFurniture: (id: ID, position: Point, commit?: boolean) => void;
  setStep: (assessmentId: ID, step: WorkflowStep) => void;
  chooseScenario: (assessmentId: ID, scenarioId: ID) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}
const initialDomain = () => structuredClone(mockData);
const snapshot = (state: AssessmentStore): Snapshot => structuredClone({ assessments: state.assessments, furniture: state.furniture });
const command = (state: AssessmentStore) => ({ past: [...state.past.slice(-19), snapshot(state)], future: [] });
export const useAssessmentStore = create<AssessmentStore>((set) => ({
  ...initialDomain(), selectedId: undefined, camera: { zoom: 1, offset: { x: 0, y: 0 }, view: "2d" }, past: [], future: [],
  select: (selectedId) => set({ selectedId }),
  setCamera: (camera) => set((state) => ({ camera: { ...state.camera, ...camera } })),
  moveFurniture: (id, position, commit = true) => set((state) => state.furniture[id] ? ({ ...(commit ? command(state) : {}), furniture: { ...state.furniture, [id]: { ...state.furniture[id], position } } }) : state),
  setStep: (assessmentId, step) => set((state) => state.assessments[assessmentId] ? ({ ...command(state), assessments: { ...state.assessments, [assessmentId]: { ...state.assessments[assessmentId], step, version: state.assessments[assessmentId].version + 1 } } }) : state),
  chooseScenario: (assessmentId, scenarioId) => set((state) => state.assessments[assessmentId] && state.scenarios[scenarioId] ? ({ ...command(state), assessments: { ...state.assessments, [assessmentId]: { ...state.assessments[assessmentId], selectedScenarioId: scenarioId, version: state.assessments[assessmentId].version + 1 } } }) : state),
  undo: () => set((state) => { const previous = state.past.at(-1); return previous ? { ...previous, past: state.past.slice(0, -1), future: [snapshot(state), ...state.future] } : state; }),
  redo: () => set((state) => { const next = state.future[0]; return next ? { ...next, past: [...state.past, snapshot(state)], future: state.future.slice(1) } : state; }),
  reset: () => ({ ...initialDomain(), selectedId: undefined, camera: { zoom: 1, offset: { x: 0, y: 0 }, view: "2d" }, past: [], future: [] })
}));
