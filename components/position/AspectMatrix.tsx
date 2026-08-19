"use client";

import type { CSSProperties } from "react";

import { clampPercent, percentileTier, tierVars } from "@/lib/scoutTheme";
import type { AccuracyBadgeKind, AspectItem, PlayerProfile } from "@/lib/types";
import { ConstructionProfileGauges } from "./ConstructionProfileGauges";

const BAR_GROUPS = [
  { key: "defensivos", title: "Defensivos" },
  { key: "construcao", title: "Construção" },
  { key: "ofensivos", title: "Ofensivos" },
] as const;

const BADGE_BORDER: Record<AccuracyBadgeKind, string> = {
  gold: "rgba(242, 193, 78, 0.28)",
  silver: "rgba(203, 213, 225, 0.22)",
  bronze: "rgba(209, 138, 81, 0.24)",
};

function badgeBorderStyle(badge: AccuracyBadgeKind | null | undefined): CSSProperties | undefined {
  if (!badge) return undefined;
  return { borderColor: BADGE_BORDER[badge] };
}

function displayValue(item: AspectItem): string {
  if (item.display_value) return item.display_value;
  if (item.certos_per90 != null) return item.certos_per90.toFixed(1).replace(".", ",");
  return "—";
}

function MetricTrack({
  pct,
  value,
  title,
}: {
  pct: number;
  value: string;
  title?: string;
}) {
  const token = percentileTier(pct);

  return (
    <div className="aspect-metric-track" style={tierVars(token)} title={title}>
      <div className="aspect-stat-bar aspect-metric-bar">
        <i style={{ width: `${clampPercent(pct)}%` }} />
      </div>
      <span className="aspect-metric-value">{value}</span>
    </div>
  );
}

function EfficiencyRow({ pct, value }: { pct: number; value?: string | null }) {
  if (value == null && pct == null) return null;
  const token = percentileTier(pct ?? 0);

  return (
    <div className="aspect-metric-eff" style={tierVars(token)}>
      <span className="aspect-metric-eff-label">Eficiência</span>
      <span className="aspect-metric-eff-value">{value ?? "—"}</span>
    </div>
  );
}

function SecondaryRow({
  label,
  value,
  pct,
}: {
  label?: string;
  value?: string;
  pct?: number;
}) {
  const token = percentileTier(pct ?? 0);

  return (
    <div className="aspect-metric-secondary" style={tierVars(token)}>
      <span className="aspect-metric-secondary-label">{label}</span>
      <span className="aspect-metric-secondary-value">{value ?? "—"}</span>
    </div>
  );
}

function MetricAspectRow({ item }: { item: AspectItem }) {
  const pct = item.percentile ?? 0;
  const badge = item.accuracy_badge;

  if (item.kind === "efficiency_def") {
    return (
      <li
        className="aspect-row aspect-row-metric aspect-row-efficiency"
        style={badgeBorderStyle(badge)}
      >
        <div className="aspect-metric-head">
          <span className="aspect-name">{item.label}</span>
        </div>
        <MetricTrack pct={pct} value={displayValue(item)} title="Custo def. ajustado (menor = melhor)" />
        <SecondaryRow
          label={item.secondary_label ?? "Ações def. c/ êxito"}
          value={item.secondary_value}
          pct={item.secondary_percentile}
        />
      </li>
    );
  }

  return (
    <li className="aspect-row aspect-row-metric" style={badgeBorderStyle(badge)}>
      <div className="aspect-metric-head">
        <span className="aspect-name">{item.label}</span>
      </div>
      <MetricTrack pct={pct} value={displayValue(item)} />
      {item.efficiency_pct != null ? (
        <EfficiencyRow pct={item.efficiency_pct} value={item.efficiency_value} />
      ) : null}
    </li>
  );
}

function AspectRow({ item }: { item: AspectItem }) {
  if (item.kind === "metric" || item.kind === "pass_certos" || item.kind === "efficiency_def") {
    return <MetricAspectRow item={item} />;
  }

  const pct =
    item.percentile ??
    (item.stats.length ? item.stats.reduce((sum, stat) => sum + stat.percentile, 0) / item.stats.length : 0);

  return <MetricAspectRow item={{ ...item, kind: "metric", percentile: pct }} />;
}

export function AspectMatrix({ player }: { player: PlayerProfile }) {
  return (
    <div className="aspect-groups aspect-groups-quad">
      {BAR_GROUPS.map((group) => (
        <article key={group.key} className="aspect-group">
          <header>
            <h3>{group.title}</h3>
          </header>

          <ul>
            {player.aspects[group.key].map((item) => (
              <AspectRow key={item.label} item={item} />
            ))}
          </ul>
        </article>
      ))}

      <ConstructionProfileGauges items={player.aspects.perfil_construcao} />
    </div>
  );
}
