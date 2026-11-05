import { useEffect, useId, useState } from "react";

import { InfoIcon } from "./Icons";

export const DEFAULT_SYSTEM_LOSS_PERCENT = 14;
export const MAX_SYSTEM_LOSS_PERCENT = 30;

export function isValidSystemLoss(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= MAX_SYSTEM_LOSS_PERCENT;
}

export function SystemLossControl({
  id,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const tooltipId = useId();
  const errorId = useId();
  const [manual, setManual] = useState(value !== DEFAULT_SYSTEM_LOSS_PERCENT);
  const valid = isValidSystemLoss(value);

  useEffect(() => {
    if (value !== DEFAULT_SYSTEM_LOSS_PERCENT) setManual(true);
  }, [value]);

  function toggleManual(enabled: boolean) {
    setManual(enabled);
    if (!enabled) onChange(DEFAULT_SYSTEM_LOSS_PERCENT);
  }

  function resetToDefault() {
    onChange(DEFAULT_SYSTEM_LOSS_PERCENT);
    setManual(false);
  }

  return <fieldset className="system-loss-control">
    <legend className="sr-only">System losses</legend>
    <div className="system-loss-summary">
      <div className="system-loss-label">
        <span>System losses</span>
        <span className="system-loss-info">
          <button type="button" aria-label="About system losses" aria-describedby={tooltipId} disabled={disabled}><InfoIcon /></button>
          <span className="system-loss-tooltip" id={tooltipId} role="tooltip">System losses are the energy lost during solar system operation due to the inverter, cables, dirt and other factors. A standard solar system uses an estimated value of 14%.</span>
        </span>
      </div>
      <strong>{Number.isFinite(value) ? value : "—"}<small>%</small></strong>
      <span className="system-loss-default">{value === DEFAULT_SYSTEM_LOSS_PERCENT ? "Recommended default" : "Manual estimate"}</span>
    </div>

    <label className="system-loss-manual-toggle">
      <input type="checkbox" checked={manual} disabled={disabled} onChange={(event) => toggleManual(event.target.checked)} />
      <span><strong>Manually adjust system losses</strong><small>Only change this when you have a project-specific estimate.</small></span>
    </label>

    {manual && <div className="system-loss-manual-panel">
      <label htmlFor={id}>Loss percentage <span>0–{MAX_SYSTEM_LOSS_PERCENT}%</span></label>
      <div className="system-loss-input-row">
        <div className="system-loss-input-wrap">
          <input
            id={id}
            type="number"
            min="0"
            max={MAX_SYSTEM_LOSS_PERCENT}
            step="0.1"
            required
            value={Number.isFinite(value) ? value : ""}
            disabled={disabled}
            aria-invalid={!valid}
            aria-describedby={!valid ? errorId : undefined}
            onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
          />
          <span>%</span>
        </div>
        {value !== DEFAULT_SYSTEM_LOSS_PERCENT && <button className="system-loss-reset" type="button" disabled={disabled} onClick={resetToDefault}>Use 14% default</button>}
      </div>
      {!valid && <small className="system-loss-error" id={errorId} role="alert">Enter a value from 0% to 30%.</small>}
    </div>}
  </fieldset>;
}
