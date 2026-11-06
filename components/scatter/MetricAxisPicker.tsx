"use client";

import { useEffect, useRef, useState } from "react";

import type { StatSectionSpec } from "@/lib/aspectStatSections";

type Metric = { key: string; label: string; section?: string };

type Props = {
  axis: "x" | "y";
  metrics: Metric[];
  groups?: StatSectionSpec[];
  /** Chave composta — stats somados separam por "||". */
  value: string;
  otherValue: string;
  plottedLabel?: string;
  /** Render only the picker control — for embedding inside the chart. */
  bare?: boolean;
  onChange: (key: string) => void;
  onSwap: () => void;
};

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
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const selectedKeys = value.split("||").filter(Boolean);
  const otherKeys = otherValue.split("||").filter(Boolean);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function toggleKey(key: string) {
    const next = selectedKeys.includes(key) ? selectedKeys.filter((item) => item !== key) : [...selectedKeys, key];
    if (!next.length) return; // eixo precisa de ao menos uma stat
    onChange(next.join("||"));
  }

  const bySection = (title: string) => metrics.filter((metric) => metric.section === title);
  const grouped = (groups ?? [])
    .map((section) => {
      const options = bySection(section.title);
      return { title: section.title, options };
    })
    .filter((section) => section.options.length);
  const sectioned = new Set(grouped.flatMap((section) => section.options.map((option) => option.key)));
  const extra = metrics.filter((metric) => !sectioned.has(metric.key));

  const summary =
    selectedKeys.length > 1
      ? `${metricLabel(metrics, selectedKeys[0])} +${selectedKeys.length - 1}`
      : metricLabel(metrics, value) || plottedLabel || "Escolher métricas";

  const panel = (
    <div className="axis-multiselect" ref={wrapRef}>
      <button
        type="button"
        className="axis-select axis-multiselect-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={axis === "x" ? "Métricas do eixo X" : "Métricas do eixo Y"}
        title={selectedKeys.map((key) => metricLabel(metrics, key)).join(" + ")}
      >
        <span className="axis-multiselect-label">{summary}</span>
        {selectedKeys.length > 1 ? <span className="axis-multiselect-count">{selectedKeys.length}</span> : null}
        <i className={`fa-solid fa-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
      </button>
      {open ? (
        <div className="axis-multiselect-panel" role="group" aria-label="Stats do eixo">
          {grouped.map((section) => (
            <div key={section.title} className="axis-multiselect-group">
              <span className="axis-multiselect-group-title">{section.title}</span>
              {section.options.map((metric) => (
                <label key={metric.key} className="axis-multiselect-option">
                  <input
                    type="checkbox"
                    checked={selectedKeys.includes(metric.key)}
                    onChange={() => toggleKey(metric.key)}
                  />
                  <span>{metric.label}</span>
                  {otherKeys.includes(metric.key) ? <em className="axis-multiselect-other">no outro eixo</em> : null}
                </label>
              ))}
            </div>
          ))}
          {extra.length ? (
            <div className="axis-multiselect-group">
              <span className="axis-multiselect-group-title">Outras métricas</span>
              {extra.map((metric) => (
                <label key={metric.key} className="axis-multiselect-option">
                  <input
                    type="checkbox"
                    checked={selectedKeys.includes(metric.key)}
                    onChange={() => toggleKey(metric.key)}
                  />
                  <span>{metric.label}</span>
                  {otherKeys.includes(metric.key) ? <em className="axis-multiselect-other">no outro eixo</em> : null}
                </label>
              ))}
            </div>
          ) : null}
          <p className="axis-multiselect-hint">Marque várias stats para somá-las no eixo.</p>
        </div>
      ) : null}
    </div>
  );

  if (bare) return panel;

  return (
    <div className="axis-picker">
      {panel}
      <button type="button" className="axis-swap" onClick={onSwap} title="Trocar eixos X e Y" aria-label="Trocar eixos X e Y">
        ⇄
      </button>
    </div>
  );
}

function metricLabel(metrics: Metric[], key: string): string {
  return metrics.find((metric) => metric.key === key)?.label ?? key;
}
