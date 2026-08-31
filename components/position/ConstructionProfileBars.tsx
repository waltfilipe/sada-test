"use client";

import { clampPercent } from "@/lib/scoutTheme";
import { Tooltip } from "@/components/ui/Tooltip";
import type { AspectItem } from "@/lib/types";

export type TendencyBarEntry = {
  item: AspectItem;
  displayLabel?: string;
  infoTip?: string;
};

function formatPct(value: number, decimals = 0): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

function InfoTip({ tip }: { tip?: string }) {
  if (!tip) return null;
  return (
    <Tooltip content={tip}>
      <button type="button" className="tendency-info-btn" aria-label="Mais informações">
        <i className="fa-solid fa-circle-info" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

function ShareBarClassic({ entry }: { entry: TendencyBarEntry }) {
  const { item, displayLabel, infoTip } = entry;
  const share = item.share_pct ?? 0;
  const avg = item.pool_avg_pct ?? 0;
  const scale = Math.max(item.scale_max_pct ?? 40, share, avg, 1);
  const avgPos = clampPercent((avg / scale) * 100);
  const playerPos = clampPercent((share / scale) * 100);

  return (
    <div className="constr-share-bar">
      <div className="constr-share-head">
        <span className="constr-share-label">
          {displayLabel ?? item.label}
          <InfoTip tip={infoTip} />
        </span>
        <span className="constr-share-value">{item.display_value ?? formatPct(share)}</span>
      </div>

      <div className="constr-share-track" aria-hidden>
        <span className="constr-share-rail" />
        <span className="constr-share-center" style={{ left: `${avgPos}%` }} />
        <span className="constr-share-dot" style={{ left: `${playerPos}%` }} />
      </div>

      <div className="constr-share-foot">
        <span>0%</span>
        <span className="constr-share-avg">média {formatPct(avg)}</span>
        <span>{formatPct(scale)}</span>
      </div>
    </div>
  );
}

function SpectrumFillBar({ entry }: { entry: TendencyBarEntry }) {
  const { item, displayLabel, infoTip } = entry;
  const share = item.share_pct ?? 0;
  const scale = Math.max(item.scale_max_pct ?? 100, 1);
  const fill = clampPercent((share / scale) * 100);
  const leftLabel = item.axis_left ?? "";
  const rightLabel = item.axis_right ?? "";
  const emphasizeLeft = fill < 50;
  const emphasizeRight = fill >= 50;

  return (
    <div className="spectrum-fill-bar">
      <div className="constr-share-head">
        <span className="constr-share-label">
          {displayLabel ?? item.label}
          <InfoTip tip={infoTip} />
        </span>
      </div>

      <div className="spectrum-fill-wrap" aria-hidden>
        <div className="spectrum-fill-track">
          <span className="spectrum-fill-progress" style={{ width: `${fill}%` }} />
          <span className="spectrum-fill-divider" style={{ left: "33.333%" }} />
          <span className="spectrum-fill-divider" style={{ left: "66.666%" }} />
        </div>
        <div className="spectrum-fill-ticks">
          <span style={{ left: "33.333%" }} />
          <span style={{ left: "66.666%" }} />
        </div>
      </div>

      <div className="spectrum-fill-foot">
        <span className={emphasizeLeft ? "is-active" : ""}>{leftLabel}</span>
        <span className={emphasizeRight ? "is-active" : ""}>{rightLabel}</span>
      </div>
    </div>
  );
}

type Props = {
  items?: AspectItem[];
  entries?: TendencyBarEntry[];
  embedded?: boolean;
};

export function ConstructionProfileBars({ items, entries, embedded = false }: Props) {
  const rows: TendencyBarEntry[] =
    entries ??
    (items ?? []).map((item) => ({
      item,
      displayLabel: item.label,
    }));

  const stack = (
    <div className="constr-share-stack">
      {rows.map((entry) =>
        entry.item.bar_key ? (
          <SpectrumFillBar key={entry.displayLabel ?? entry.item.label} entry={entry} />
        ) : (
          <ShareBarClassic key={entry.displayLabel ?? entry.item.label} entry={entry} />
        ),
      )}
    </div>
  );

  if (embedded) return stack;

  return (
    <article className="dossier-profile-card-panel aspect-group-constr">
      <header>
        <h3>Perfil de construção</h3>
      </header>
      {stack}
    </article>
  );
}
