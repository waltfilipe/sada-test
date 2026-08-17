"use client";

type Props = {
  label: string;
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  format?: (value: number) => string;
};

export function RangeFilter({ label, min, max, value, onChange, format }: Props) {
  const display = (n: number) => (format ? format(n) : String(Math.round(n)));

  return (
    <div className="range-filter">
      <div className="range-filter-head">
        <span>{label}</span>
        <span className="muted">
          {display(value[0])} – {display(value[1])}
        </span>
      </div>
      <div className="range-inputs">
        <input
          type="range"
          min={min}
          max={max}
          value={value[0]}
          onChange={(e) => onChange([Math.min(Number(e.target.value), value[1]), value[1]])}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value[1]}
          onChange={(e) => onChange([value[0], Math.max(Number(e.target.value), value[0])])}
        />
      </div>
    </div>
  );
}
