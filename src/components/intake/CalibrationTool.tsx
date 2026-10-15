"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Info, Check } from "lucide-react";
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
    calibration.realLength != null ? String(calibration.realLength) : ""
  );
  const [unit, setUnit] = useState<CalibrationUnit>(calibration.unit ?? "m");
  const [inputError, setInputError] = useState<string | null>(null);

  // Sync state if calibration changes externally
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLengthInput(calibration.realLength != null ? String(calibration.realLength) : "");
    if (calibration.unit) {
      setUnit(calibration.unit);
    }
  }, [calibration.realLength, calibration.unit]);

  const p1 = calibration.p1;
  const p2 = calibration.p2;
  const hasTwoPoints = p1 !== null && p2 !== null;
  const pixelDist = hasTwoPoints ? computePixelDistance(p1, p2) : 0;

  const validation = validateMeasurement(lengthInput);

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasTwoPoints) {
      setInputError("Click two points on the floorplan to draw a calibration line first.");
      return;
    }

    if (!validation.isValid || validation.value === undefined) {
      setInputError(validation.error ?? "Please enter a valid positive number.");
      return;
    }

    const pixelsPerCm = computePixelsPerCm(p1, p2, validation.value, unit);
    if (pixelsPerCm <= 0) {
      setInputError("Points cannot be at the exact same position.");
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
    onResetCalibration();
  };

  // Only applied calibration is authoritative; typed draft is not a saved scale.
  const scaleDisplay = calibration.isCalibrated && calibration.pixelsPerCm && calibration.pixelsPerCm > 0 && calibration.realLength != null && hasTwoPoints
    ? `${pixelDist.toFixed(0)} px = ${calibration.realLength} ${calibration.unit} (${(1 / (calibration.pixelsPerCm * 100)).toFixed(3)} m/px)`
    : "Not calibrated";

  return (
    <div className="space-y-4 text-xs">
      {/* Section Header matching 04-calibration-and-boundary.png */}
      <div>
        <h3 className="text-sm font-bold text-[#17252B]">Set the scale</h3>
        <p className="mt-1 text-xs text-[#647078] leading-relaxed">
          Draw a line on the floorplan between two known points and enter the real-world length. This sets the scale for accurate measurements.
        </p>
      </div>

      {/* Input Card Container */}
      <div className="rounded-xl bg-[#F8FAFA] p-3.5 border border-[#E2E6E8] space-y-2.5">
        <label htmlFor="ref-length-input" className="block text-xs font-bold text-[#17252B]">
          Reference length (real-world)
        </label>

        {/* Input + Unit Selector Group - flex with min-w-0 to prevent any overflow */}
        <div className="flex items-center gap-2 w-full min-w-0">
          <input
            id="ref-length-input"
            type="number"
            step="any"
            min="0.01"
            placeholder="3.0"
            value={lengthInput}
            onChange={(e) => {
              setLengthInput(e.target.value);
              if (inputError) setInputError(null);
            }}
            className="flex-1 min-w-0 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#17252B] outline-none transition focus:border-[#0B514B] focus:ring-2 focus:ring-[#0B514B]/20"
          />
          <select
            aria-label="Measurement unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as CalibrationUnit)}
            className="w-18 shrink-0 rounded-lg border border-[#CBD5E1] bg-white px-2 py-2 text-xs font-semibold text-[#17252B] outline-none transition focus:border-[#0B514B] focus:ring-2 focus:ring-[#0B514B]/20 cursor-pointer"
          >
            <option value="m">m</option>
            <option value="cm">cm</option>
          </select>
        </div>

        {inputError && (
          <p role="alert" className="text-[11px] font-medium text-[#dc2626]">
            {inputError}
          </p>
        )}

        {/* Helper Note matching 04-calibration-and-boundary.png */}
        <div className="pt-0.5">
          {!hasTwoPoints ? (
            <div className="flex items-start gap-1.5 text-[11px] text-[#647078]">
              <Info size={14} className="shrink-0 mt-0.5 text-[#8C9BA5]" />
              <span>
                {!p1
                  ? "Click two points on the floorplan to draw a calibration line."
                  : "Click second point on the floorplan to complete the line."}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-[#0B514B] font-medium">
              <span className="flex items-center gap-1">
                <Check size={13} strokeWidth={2.5} />
                <span>Reference line drawn ({pixelDist.toFixed(1)} px)</span>
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] font-semibold text-[#DC2626] hover:underline cursor-pointer"
              >
                Clear line
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Current Scale Display matching 04-calibration-and-boundary.png */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-[#17252B]">
          Current scale
        </label>
        <div className="rounded-lg bg-[#F8FAFA] border border-[#E2E6E8] px-3.5 py-2.5 text-xs font-mono text-[#475569]">
          {scaleDisplay}
        </div>
      </div>

      {/* Primary Action Button */}
      {hasTwoPoints && (
        <Button
          type="button"
          onClick={() => handleApply()}
          className="w-full bg-[#0B514B] hover:bg-[#073D38] text-white font-semibold text-xs py-2 shadow-xs transition cursor-pointer"
        >
          {calibration.isCalibrated ? "Update scale & continue" : "Apply scale & draw boundary"} &rarr;
        </Button>
      )}
    </div>
  );
}
