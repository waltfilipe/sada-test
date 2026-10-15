"use client";

import { useMemo, useState } from "react";
import { ConstructionProfileBars, type TendencyBarEntry } from "@/components/position/ConstructionProfileBars";
import { flattenAspects } from "@/lib/aspectLookup";
import type { AspectItem, PlayerProfile } from "@/lib/types";

type BarSpec = {
  label: string;
  share: number;
  average: number;
};

function parseDisplay(value?: string | null): number | null {
  if (!value) return null;
  const normalized = value.trim().replace("%", "").replace(/\s/g, "").replace(",", ".");
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function exactItem(player: PlayerProfile, label: string): number | null {
  const item = flattenAspects(player).find((row) => row.label === label);
  return parseDisplay(item?.display_value);
}

function exactSub(player: PlayerProfile, parent: string, label: string): number | null {
  const item = flattenAspects(player).find((row) => row.label === parent);
  const sub = item?.sub_metrics?.find((row) => row.label === label);
  return parseDisplay(sub?.display_value);
}

function storedShare(player: PlayerProfile, key: "pass_tendency" | "progressive_share"): AspectItem | null {
  return (player.aspects.perfil_construcao ?? []).find((item) => item.bar_key === key) ?? null;
}

function longPassShare(player: PlayerProfile): number | null {
  const stored = storedShare(player, "pass_tendency");
  if (stored?.share_pct != null) return stored.share_pct;
  const long = exactItem(player, "Passes Longos");
  const total = exactSub(player, "Distribuição", "Passes");
  if (long == null || total == null || total <= 0) return null;
  return (long / total) * 100;
}

function progressiveShare(player: PlayerProfile): number | null {
  const stored = storedShare(player, "progressive_share");
  if (stored?.share_pct != null) return stored.share_pct;
  const progressive = exactItem(player, "Passes Progressivos");
  const total = exactSub(player, "Distribuição", "Passes");
  if (progressive == null || total == null || total <= 0) return null;
  return (progressive / total) * 100;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function barEntry(spec: BarSpec, tip: string): TendencyBarEntry {
  const scale = Math.max(40, spec.share, spec.average, 1);
  return {
    displayLabel: spec.label,
    infoTip: tip,
    item: {
      label: spec.label,
      grade: "",
      stats: [],
      share_pct: spec.share,
      pool_avg_pct: spec.average,
      scale_max_pct: scale,
      display_value: `${Math.round(spec.share)}%`,
    },
  };
}

export function PassTendencies({ player, players }: { player: PlayerProfile; players: PlayerProfile[] }) {
  const [open, setOpen] = useState(false);
  const entries = useMemo(() => {
    const pool = players.length ? players : [player];
    const longStored = storedShare(player, "pass_tendency");
    const progStored = storedShare(player, "progressive_share");
    const long = longPassShare(player);
    const progressive = progressiveShare(player);
    const longAverage =
      longStored?.pool_avg_pct ??
      mean(pool.map(longPassShare).filter((value): value is number => value != null));
    const progressiveAverage =
      progStored?.pool_avg_pct ??
      mean(pool.map(progressiveShare).filter((value): value is number => value != null));

    const rows: TendencyBarEntry[] = [];
    if (long != null && longAverage != null) {
      rows.push(
        barEntry(
          { label: "Passe curto e longo", share: long, average: longAverage },
          "Parcela de passes longos no total de passes. A marca é a média da posição nesta série. Mais à esquerda, passe curto. Mais à direita, passe longo.",
        ),
      );
    }
    if (progressive != null && progressiveAverage != null) {
      rows.push(
        barEntry(
          { label: "Passes progressivos", share: progressive, average: progressiveAverage },
          "Parcela de passes progressivos no total de passes, comparada à média da posição nesta série.",
        ),
      );
    }
    return rows;
  }, [player, players]);

  return (
    <div className="pass-tendencies">
      <button
        type="button"
        className={`btn btn-ghost pass-tendencies-btn${open ? " open" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <i className="fa-solid fa-chart-line" aria-hidden="true" /> Tendências
        <i className={`fa-solid fa-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
      </button>
      {open ? (
        <div className="tendencies-pop-panel pass-tendencies-panel" role="region" aria-label="Tendências">
          <p className="pass-tendencies-note">Comparado à média da posição nesta série.</p>
          {entries.length ? (
            <ConstructionProfileBars entries={entries} embedded />
          ) : (
            <p className="pass-tendencies-note">Sem amostra de passes para esta posição.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
