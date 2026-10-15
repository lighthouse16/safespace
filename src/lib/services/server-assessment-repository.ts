import type {
  PersistedAssessmentState,
  StorageSaveResult,
  StorageLoadResult,
} from "@/lib/storage/persistence";

export interface RemoteAssessmentSummary {
  id: string;
  name: string;
  facilityName: string;
  spaceName: string;
  environmentType: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteMediaResult {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  url: string | null;
}

/**
 * Client-side service communicating with `/api/v1/assessments` Route Handlers.
 */
export const serverAssessmentService = {
  async listAssessments(): Promise<{ success: boolean; assessments: RemoteAssessmentSummary[]; error?: string }> {
    try {
      const res = await fetch("/api/v1/assessments", {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, assessments: [], error: data.error || `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { success: true, assessments: data.assessments || [] };
    } catch (err: unknown) {
      return { success: false, assessments: [], error: err instanceof Error ? err.message : "Network error" };
    }
  },

  async createAssessment(payload: {
    id?: string;
    name: string;
    facilityName?: string;
    spaceName?: string;
    environmentType?: string;
    notes?: string;
  }): Promise<{ success: boolean; assessment?: RemoteAssessmentSummary; error?: string }> {
    try {
      const res = await fetch("/api/v1/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      return { success: true, assessment: data.assessment };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },

  async getAssessment(id: string): Promise<StorageLoadResult> {
    try {
      const res = await fetch(`/api/v1/assessments/${id}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || `HTTP ${res.status}`, isCorrupted: false };
      }
      const data = await res.json();
      if (!data.assessment) {
        return { success: false, error: "Assessment payload missing in response", isCorrupted: false };
      }
      return { success: true, data: data.assessment };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error",
        isCorrupted: false,
      };
    }
  },

  async saveAssessment(id: string, state: PersistedAssessmentState): Promise<StorageSaveResult> {
    try {
      const res = await fetch(`/api/v1/assessments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },

  async deleteAssessment(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/v1/assessments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },

  async uploadMedia(id: string, file: File): Promise<{ success: boolean; asset?: RemoteMediaResult; error?: string }> {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/v1/assessments/${id}/media`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      return { success: true, asset: data.asset };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },

  async getMediaUrl(id: string): Promise<{ success: boolean; url?: string | null; error?: string }> {
    try {
      const res = await fetch(`/api/v1/assessments/${id}/media`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { success: true, url: data.asset?.url || null };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },

  async deleteMedia(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/v1/assessments/${id}/media`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },

  /**
   * Transparently migrates local draft assessment state to cloud upon user login.
   */
  async syncLocalToRemote(localState: PersistedAssessmentState): Promise<{ success: boolean; remoteId?: string; error?: string }> {
    if (!localState.metadata?.name) {
      return { success: false, error: "Local assessment missing name" };
    }

    // 1. Create remote assessment
    const created = await this.createAssessment({
      name: localState.metadata.name,
      facilityName: localState.metadata.facilityName,
      spaceName: localState.metadata.spaceName,
      environmentType: localState.metadata.environmentType,
      notes: localState.metadata.notes,
    });

    if (!created.success || !created.assessment) {
      return { success: false, error: created.error || "Failed to create remote assessment record" };
    }

    const remoteId = created.assessment.id;

    // 2. Upload full state
    const updatedState: PersistedAssessmentState = {
      ...localState,
      metadata: {
        ...localState.metadata,
        id: remoteId,
      },
    };

    const saved = await this.saveAssessment(remoteId, updatedState);
    if (!saved.success) {
      return { success: false, error: saved.error };
    }

    return { success: true, remoteId };
  },
};
