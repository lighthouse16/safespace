"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import {
  type AssessmentDetails,
  type EnvironmentType,
  ENVIRONMENT_TYPE_LABELS,
} from "./intake-view-types";
import { validateAssessmentDetails } from "./intake-validation";

export type AssessmentDetailsStepProps = {
  initialDetails: AssessmentDetails;
  onContinue: (details: AssessmentDetails) => void;
};

export function AssessmentDetailsStep({
  initialDetails,
  onContinue,
}: AssessmentDetailsStepProps) {
  const [details, setDetails] = useState<AssessmentDetails>(initialDetails);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    field: keyof AssessmentDetails,
    value: string
  ) => {
    setDetails((prev) => ({ ...prev, [field]: value }));
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
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="text-base font-semibold text-[#192329]">
          Assessment Details
        </h2>
        <p className="mt-1 text-xs text-[#64748b]">
          Specify the facility and area parameters for this environmental evaluation.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Assessment name"
              name="assessmentName"
              placeholder="e.g. Annual Fall-Risk Survey 2026"
              value={details.assessmentName}
              onChange={(e) => handleChange("assessmentName", e.target.value)}
              error={errors.assessmentName}
              required
            />
          </div>

          <div>
            <Input
              label="Facility or residence name"
              name="facilityName"
              placeholder="e.g. Pinecrest Senior Community"
              value={details.facilityName}
              onChange={(e) => handleChange("facilityName", e.target.value)}
              error={errors.facilityName}
              required
            />
          </div>

          <div>
            <Input
              label="Space or area name"
              name="spaceName"
              placeholder="e.g. Activity Hall & North Corridor"
              value={details.spaceName}
              onChange={(e) => handleChange("spaceName", e.target.value)}
              error={errors.spaceName}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <Select
              label="Environment type"
              name="environmentType"
              value={details.environmentType}
              onChange={(e) =>
                handleChange("environmentType", e.target.value as EnvironmentType)
              }
              error={errors.environmentType}
              required
            >
              {(Object.keys(ENVIRONMENT_TYPE_LABELS) as EnvironmentType[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {ENVIRONMENT_TYPE_LABELS[key]}
                  </option>
                )
              )}
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Textarea
              label="Notes or specific observations"
              name="notes"
              placeholder="Optional notes regarding floor transitions, known resident mobility aids, or assessment objectives..."
              value={details.notes ?? ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              optional
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="md">
          Continue to Floorplan Source
        </Button>
      </div>
    </form>
  );
}
