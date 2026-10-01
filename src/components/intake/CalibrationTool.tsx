"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import {
  type CalibrationState,
  type CalibrationUnit,
} from "./intake-view-types";
import {
  computePixelDistance,
  computePixelsPerCm,
  validateMeasurement,
} from "./intake-validation";

export type CalibrationToolProps = {
  calibration: CalibrationState;
  onApplyCalibration: (newCalibration: CalibrationState) => void;
  onResetCalibration: () => void;
};

export function CalibrationTool({
  calibration,
  onApplyCalibration,
  onResetCalibration,
}: CalibrationToolProps) {
  const [lengthInput, setLengthInput] = useState<string>(
    calibration.realLength ? String(calibration.realLength) : ""
  );
  const [unit, setUnit] = useState<CalibrationUnit>(calibration.unit ?? "cm");
  const [inputError, setInputError] = useState<string | null>(null);

  const p1 = calibration.p1;
  const p2 = calibration.p2;
  const hasTwoPoints = p1 !== null && p2 !== null;
  const pixelDist = hasTwoPoints ? computePixelDistance(p1, p2) : 0;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasTwoPoints) {
      setInputError("Please select two reference points on the canvas first.");
      return;
    }

    const validation = validateMeasurement(lengthInput);
    if (!validation.isValid || validation.value === undefined) {
      setInputError(validation.error ?? "Invalid measurement value.");
      return;
    }

    const pixelsPerCm = computePixelsPerCm(p1, p2, validation.value, unit);
    if (pixelsPerCm <= 0) {
      setInputError("Could not calculate valid scale. Ensure points are not identical.");
      return;
    }

    setInputError(null);
    onApplyCalibration({
      p1,
      p2,
      realLength: validation.value,
      unit,
      pixelsPerCm,
      isCalibrated: true,
    });
  };

  const handleReset = () => {
    setInputError(null);
    setLengthInput("");
    onResetCalibration();
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Scale Calibration
        </h4>
        {calibration.isCalibrated ? (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
            Calibrated
          </span>
        ) : (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
            Uncalibrated
          </span>
        )}
      </div>

      <p className="text-xs text-[#64748b]">
        {!hasTwoPoints
          ? !p1
            ? "Click point 1 on the canvas to begin reference line."
            : "Click point 2 on the canvas to complete reference line."
          : "Reference line drawn. Enter known ground-truth length:"}
      </p>

      {hasTwoPoints && (
        <form onSubmit={handleApply} className="space-y-3 pt-1">
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <Input
              label="Real-world length"
              name="realLength"
              type="number"
              step="any"
              min="0.01"
              placeholder="e.g. 120"
              value={lengthInput}
              onChange={(e) => {
                setLengthInput(e.target.value);
                if (inputError) setInputError(null);
              }}
              error={inputError ?? undefined}
              required
            />
            <Select
              label="Unit"
              name="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as CalibrationUnit)}
            >
              <option value="cm">cm</option>
              <option value="m">m</option>
            </Select>
          </div>

          <div className="rounded bg-slate-50 p-2.5 text-[11px] text-[#475569] space-y-1 border border-slate-200">
            <div className="flex justify-between">
              <span>Pixel span:</span>
              <span className="font-mono font-medium">{pixelDist.toFixed(1)} px</span>
            </div>
            {calibration.pixelsPerCm && (
              <div className="flex justify-between font-semibold text-[#1e7168]">
                <span>Calculated scale:</span>
                <span className="font-mono">
                  {calibration.pixelsPerCm.toFixed(2)} px/cm (
                  {(calibration.pixelsPerCm * 100).toFixed(0)} px/m)
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" size="xs" className="flex-1">
              {calibration.isCalibrated ? "Update scale" : "Apply scale"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={handleReset}
            >
              Reset
            </Button>
          </div>
        </form>
      )}

      {calibration.isCalibrated && !hasTwoPoints && (
        <div className="space-y-2 pt-1">
          <div className="rounded bg-slate-50 p-2.5 text-[11px] text-[#475569] border border-slate-200">
            <div className="flex justify-between">
              <span>Length:</span>
              <span className="font-medium">
                {calibration.realLength} {calibration.unit}
              </span>
            </div>
            <div className="flex justify-between font-semibold text-[#1e7168] mt-1">
              <span>Scale:</span>
              <span className="font-mono">
                {calibration.pixelsPerCm?.toFixed(2)} px/cm
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={handleReset}
            className="w-full"
          >
            Reset calibration
          </Button>
        </div>
      )}
    </div>
  );
}
