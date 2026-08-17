"use client";

import { clampPercent } from "@/lib/scoutTheme";

type Props = {
  label: string;
  hint?: string;
  valueA: number;
  valueB: number;
  max?: number;
  format?: (value: number) => string;
};

/**
 * A single metric rendered as two bars growing outward from a centre label, so
 * the reader compares lengths against a shared baseline instead of eyeballing
 * two separate charts.
 */
export function VersusBar({ label, hint, valueA, valueB, max = 100, format }: Props) {
  const display = (value: number) => (format ? format(value) : String(Math.round(value)));
  const widthA = clampPercent((valueA / max) * 100);
  const widthB = clampPercent((valueB / max) * 100);

  const leads = valueA === valueB ? "tie" : valueA > valueB ? "a" : "b";
  const gap = Math.abs(valueA - valueB);

  return (
    <div className={`versus-row leads-${leads}`}>
      <span className="versus-value side-a">{display(valueA)}</span>

      <div className="versus-track side-a">
        <i style={{ width: `${widthA}%` }} />
      </div>

      <div className="versus-label">
        <span title={hint}>{label}</span>
        {gap > 0 && <em>{display(gap)}</em>}
      </div>

      <div className="versus-track side-b">
        <i style={{ width: `${widthB}%` }} />
      </div>

      <span className="versus-value side-b">{display(valueB)}</span>
    </div>
  );
}
