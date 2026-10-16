"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/field";
import {
  type AssessmentDetails,
  type EnvironmentType,
  ENVIRONMENT_TYPE_LABELS,
} from "./intake-view-types";
import { validateAssessmentDetails } from "./intake-validation";

export type AssessmentDetailsStepProps = {
  initialDetails: AssessmentDetails;
  onChange?: (details: AssessmentDetails) => void;
  onContinue: (details: AssessmentDetails) => void;
};

export function AssessmentDetailsStep({
  initialDetails,
  onChange,
  onContinue,
}: AssessmentDetailsStepProps) {
  const [details, setDetails] = useState<AssessmentDetails>(initialDetails);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    field: keyof AssessmentDetails,
    value: string
  ) => {
    const next = { ...details, [field]: value };
    setDetails(next);
    onChange?.(next);
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fieldErrors = validateAssessmentDetails(details);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onContinue(details);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="rounded-2xl border border-[#E2E6E8] bg-white p-6 sm:p-8 shadow-xs">
        {/* Step Badge */}
        <div className="mb-4">
          <span className="inline-block rounded-md bg-[#F0F3F4] px-2.5 py-1 text-xs font-semibold text-[#17252B]">
            Step 1 of 4
          </span>
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-[#17252B]">
          Assessment details
        </h2>
        <p className="mt-1.5 text-xs text-[#647078]">
          Provide some basic information about the assessment and the space you&apos;re analysing.
        </p>

        <div className="mt-8 space-y-5">
          <div>
            <Input
              label="Assessment name"
              name="assessmentName"
              placeholder="e.g. Q1 2025 Fire Safety Assessment"
              value={details.assessmentName}
              onChange={(e) => handleChange("assessmentName", e.target.value)}
              error={errors.assessmentName}
              required
            />
            <p className="mt-1 text-[11px] text-[#647078]">
              A clear name to help you identify this assessment later.
            </p>
          </div>

          <div>
            <Input
              label="Facility or residence name"
              name="facilityName"
              placeholder="e.g. Riverside Apartments"
              value={details.facilityName}
              onChange={(e) => handleChange("facilityName", e.target.value)}
              error={errors.facilityName}
              required
            />
            <p className="mt-1 text-[11px] text-[#647078]">
              The name of the building, facility or residence.
            </p>
          </div>

          <div>
            <Input
              label="Space or area name"
              name="spaceName"
              placeholder="e.g. Level 2, East Wing"
              value={details.spaceName}
              onChange={(e) => handleChange("spaceName", e.target.value)}
              error={errors.spaceName}
              required
            />
            <p className="mt-1 text-[11px] text-[#647078]">
              Name the specific space or area within the facility.
            </p>
          </div>

          <div>
            <Select
              label="Environment type"
              name="environmentType"
              value={details.environmentType || ""}
              onChange={(e) =>
                handleChange("environmentType", e.target.value as EnvironmentType)
              }
              error={errors.environmentType}
              required
            >
              <option value="" disabled>
                Select an environment type
              </option>
              {(Object.keys(ENVIRONMENT_TYPE_LABELS) as EnvironmentType[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {ENVIRONMENT_TYPE_LABELS[key]}
                  </option>
                )
              )}
            </Select>
            <p className="mt-1 text-[11px] text-[#647078]">
              Choose the type of environment this assessment is for.
            </p>
          </div>

          <div>
            <Textarea
              label="Notes"
              name="notes"
              placeholder="Add any additional context, goals or notes (optional)."
              value={details.notes ?? ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              optional
              rows={3}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 pt-4">
          <Link
            href="/assessments"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E2E6E8] bg-white px-4 py-2.5 text-xs font-semibold text-[#17252B] hover:bg-[#F7F8F8] transition-colors"
          >
            <ChevronLeft size={16} />
            <span>Back to assessments</span>
          </Link>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0B514B] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#073D38] transition-colors cursor-pointer"
          >
            <span>Continue to floorplan source</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}
