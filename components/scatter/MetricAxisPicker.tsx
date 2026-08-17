"use client";

type Metric = { key: string; label: string };

type Props = {
  axis: "x" | "y";
  metrics: Metric[];
  value: string;
  otherValue: string;
  onChange: (key: string) => void;
  onSwap: () => void;
};

export function MetricAxisPicker({ axis, metrics, value, otherValue, onChange, onSwap }: Props) {
  return (
    <div className={`axis-picker axis-${axis}`}>
      <div className="axis-picker-head">
        <span className="axis-badge">{axis === "x" ? "Eixo X" : "Eixo Y"}</span>
        {axis === "y" && (
          <button type="button" className="axis-swap" onClick={onSwap} title="Trocar eixos">
            ⇄
          </button>
        )}
      </div>

      <div className="axis-options" role="radiogroup" aria-label={axis === "x" ? "Métrica do eixo X" : "Métrica do eixo Y"}>
        {metrics.map((metric) => {
          const disabled = metric.key === otherValue;
          const active = metric.key === value;
          return (
            <button
              key={metric.key}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              className={active ? "active" : ""}
              onClick={() => onChange(metric.key)}
            >
              {metric.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
