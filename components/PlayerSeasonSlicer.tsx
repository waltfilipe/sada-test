"use client";

import { CURRENT_SEASON, type BrasileiraoSeason } from "@/lib/seasons";

type Props = {
  active: string;
  archiveYears: BrasileiraoSeason[];
  loading?: boolean;
  onSelect: (year: BrasileiraoSeason | typeof CURRENT_SEASON) => void;
};

export function PlayerSeasonSlicer({ active, archiveYears, loading, onSelect }: Props) {
  if (!archiveYears.length) return null;
  return (
    <div className="player-season-slicer" aria-label="Temporada da ficha">
      <span className="player-season-slicer-label">Ficha</span>
      <div className="player-season-slicer-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={active === CURRENT_SEASON}
          className={active === CURRENT_SEASON ? "is-active" : ""}
          onClick={() => onSelect(CURRENT_SEASON)}
        >
          {CURRENT_SEASON}
        </button>
        {archiveYears.map((year) => (
          <button
            key={year}
            type="button"
            role="tab"
            aria-selected={active === year}
            className={active === year ? "is-active" : ""}
            disabled={loading && active !== year}
            onClick={() => onSelect(year)}
          >
            {year}
          </button>
        ))}
      </div>
      {loading ? <span className="player-season-slicer-loading">Carregando…</span> : null}
    </div>
  );
}
