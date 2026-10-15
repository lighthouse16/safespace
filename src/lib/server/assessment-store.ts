import crypto from "node:crypto";
import type { PersistedAssessmentState } from "@/lib/storage/persistence";

export interface StoredAssessment {
  id: string;
  userId: string;
  name: string;
  facilityName: string;
  spaceName: string;
  environmentType: string;
  notes: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  bundle?: PersistedAssessmentState;
  media?: {
    id: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    url: string;
    createdAt: string;
  };
}

// Module-level durable store for server runtime
const assessmentsMap = new Map<string, StoredAssessment>();

export const serverAssessmentStore = {
  list(userId: string): StoredAssessment[] {
    const results: StoredAssessment[] = [];
    for (const item of assessmentsMap.values()) {
      if (item.userId === userId) {
        results.push(item);
      }
    }
    return results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  create(userId: string, data: {
    name: string;
    facilityName?: string;
    spaceName?: string;
    environmentType?: string;
    notes?: string;
  }): StoredAssessment {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const item: StoredAssessment = {
      id,
      userId,
      name: data.name,
      facilityName: data.facilityName || "",
      spaceName: data.spaceName || "",
      environmentType: data.environmentType || "residential",
      notes: data.notes || "",
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    assessmentsMap.set(id, item);
    return item;
  },

  get(id: string, userId?: string): StoredAssessment | null {
    const item = assessmentsMap.get(id);
    if (!item) return null;
    if (userId && item.userId !== userId) return null;
    return item;
  },

  saveBundle(id: string, userId: string, bundle: PersistedAssessmentState): boolean {
    const item = assessmentsMap.get(id);
    const now = new Date().toISOString();
    if (item) {
      if (item.userId !== userId) return false;
      item.bundle = bundle;
      item.name = bundle.metadata?.name || item.name;
      item.facilityName = bundle.metadata?.facilityName || item.facilityName;
      item.spaceName = bundle.metadata?.spaceName || item.spaceName;
      item.environmentType = bundle.metadata?.environmentType || item.environmentType;
      item.notes = bundle.metadata?.notes || item.notes;
      item.updatedAt = now;
      return true;
    }
    // Create if not exists
    const newItem: StoredAssessment = {
      id,
      userId,
      name: bundle.metadata?.name || "Untitled Assessment",
      facilityName: bundle.metadata?.facilityName || "",
      spaceName: bundle.metadata?.spaceName || "",
      environmentType: bundle.metadata?.environmentType || "residential",
      notes: bundle.metadata?.notes || "",
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      bundle,
    };
    assessmentsMap.set(id, newItem);
    return true;
  },

  delete(id: string, userId: string): boolean {
    const item = assessmentsMap.get(id);
    if (!item) return false;
    if (item.userId !== userId) return false;
    return assessmentsMap.delete(id);
  },

  saveMedia(id: string, userId: string, media: { fileName: string; mimeType: string; fileSizeBytes: number; url: string }): boolean {
    const item = assessmentsMap.get(id);
    if (!item || item.userId !== userId) return false;
    item.media = {
      id: crypto.randomUUID(),
      ...media,
      createdAt: new Date().toISOString(),
    };
    item.updatedAt = new Date().toISOString();
    return true;
  },

  getMedia(id: string, userId?: string) {
    const item = assessmentsMap.get(id);
    if (!item) return null;
    if (userId && item.userId !== userId) return null;
    return item.media || null;
  },

  deleteMedia(id: string, userId: string): boolean {
    const item = assessmentsMap.get(id);
    if (!item || item.userId !== userId) return false;
    item.media = undefined;
    item.updatedAt = new Date().toISOString();
    return true;
  },
};
