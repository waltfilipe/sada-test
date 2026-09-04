"use client";

import type { PlayerHeatmapData } from "@/lib/types";

type Props = {
  heatmap?: PlayerHeatmapData | null;
  playerName: string;
};

export function PlayerHeatmap({ heatmap, playerName }: Props) {
  if (!heatmap?.image_url && !heatmap?.points?.length) {
    return (
      <div className="heatmap-empty">
        <span className="heatmap-empty-icon" aria-hidden="true">
          <i className="fa-solid fa-map-location-dot" />
        </span>
        <p className="heatmap-placeholder-copy">Mapa de calor indisponível para este atleta.</p>
      </div>
    );
  }

  const meta = [
    heatmap.competition,
    heatmap.scope !== "overall" ? heatmap.scope : null,
    heatmap.point_count ? `${heatmap.point_count} toques` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="heatmap-body">
      {heatmap.image_url ? (
        <img
          src={heatmap.image_url}
          alt={`Heatmap de ${playerName}${meta ? ` — ${meta}` : ""}`}
          className="heatmap-img"
        />
      ) : null}
      {meta ? <p className="heatmap-meta">{meta}</p> : null}
    </div>
  );
}
