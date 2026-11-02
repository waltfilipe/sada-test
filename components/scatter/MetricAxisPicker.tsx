"use client";

import type { StatSectionSpec } from "@/lib/aspectStatSections";

type Metric = { key: string; label: string };

type Props = {
  axis: "x" | "y";
  metrics: Metric[];
  groups?: StatSectionSpec[];
  value: string;
  otherValue: string;
  plottedLabel?: string;
  /** Render only the grouped select — for embedding inside the chart. */
  bare?: boolean;
  onChange: (key: string) => void;
  onSwap: () => void;
};

function metricLabel(metrics: Metric[], key: string): string {
  return metrics.find((metric) => metric.key === key)?.label ?? key;
}

export function MetricAxisPicker({
  axis,
  metrics,
  groups,
  value,
  otherValue,
  plottedLabel,
  bare = false,
  onChange,
  onSwap,
}: Props) {
  const groupedKeys = new Set<string>();
  const sections =
    groups?.map((section) => {
      const options = section.labels
        .map((label) => metrics.find((metric) => metric.key === label || metric.label === label))
        .filter((metric): metric is Metric => Boolean(metric));
      for (const metric of options) groupedKeys.add(metric.key);
      return { title: section.title, options };
    }).filter((section) => section.options.length) ?? [];

  const extra = metrics.filter((metric) => !groupedKeys.has(metric.key));

  const selectEl = (
    <label className="axis-select-wrap">
      <span className="sr-only">{axis === "x" ? "Métrica do eixo X" : "Métrica do eixo Y"}</span>
      <select
        className="axis-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={axis === "x" ? "Métrica do eixo X" : "Métrica do eixo Y"}
      >
        {sections.map((section) => (
          <optgroup key={section.title} label={section.title}>
            {section.options.map((metric) => (
              <option key={metric.key} value={metric.key} disabled={metric.key === otherValue}>
                {metric.label}
              </option>
            ))}
          </optgroup>
        ))}
        {extra.length ? (
          <optgroup label="Outras métricas">
            {extra.map((metric) => (
              <option key={metric.key} value={metric.key} disabled={metric.key === otherValue}>
                {metric.label}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </label>
  );

  if (bare) return selectEl;

  return (
    <div className={`axis-picker axis-${axis}`}>
      <div className="axis-picker-head">
        <span className="axis-badge">{axis === "x" ? "Eixo X" : "Eixo Y"}</span>
        {axis === "y" ? (
          <button type="button" className="axis-swap" onClick={onSwap} title="Trocar eixos X e Y">
            ⇄ Trocar
          </button>
        ) : null}
      </div>
      {plottedLabel ? <p className="axis-plotted">No gráfico: {plottedLabel}</p> : null}

      {selectEl}

      <p className="axis-select-hint">
        Selecionado: <strong>{plottedLabel ?? metricLabel(metrics, value)}</strong>
      </p>
    </div>
  );
}
