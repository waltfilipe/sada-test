"use client";

import { useMemo, useState } from "react";
import { ConstructionProfileBars, type TendencyBarEntry } from "@/components/position/ConstructionProfileBars";
import { flattenAspects } from "@/lib/aspectLookup";
import { familyBySlug } from "@/lib/positions";
import { longPassProgressiveRate, progressiveNotLong, progressiveThatAreLong } from "@/lib/progressiveShort";
import { clampPercent } from "@/lib/scoutTheme";
import type { AspectItem, PlayerProfile, PositionFamily } from "@/lib/types";

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

function formatRate(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatCoef(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function passVolume(player: PlayerProfile, label: string): number | null {
  const item = flattenAspects(player).find((row) => row.label === label && row.kind === "pass_certos");
  if (!item) return null;
  if (typeof item.certos_per90 === "number" && Number.isFinite(item.certos_per90)) return item.certos_per90;
  return parseDisplay(item.display_value);
}

type ShortProgressive = {
  progressive: number;
  alsoLong: number;
  notLong: number;
};

function shortProgressive(player: PlayerProfile): ShortProgressive | null {
  const progressive = passVolume(player, "Passes Progressivos");
  const long = passVolume(player, "Passes Longos");
  if (progressive == null || long == null) return null;
  const family = player.position_family;
  return {
    progressive,
    alsoLong: progressiveThatAreLong(progressive, long, family),
    notLong: progressiveNotLong(progressive, long, family),
  };
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

function ShortProgressiveBar({
  value,
  average,
  family,
}: {
  value: number;
  average: number;
  family: PositionFamily;
}) {
  const scale = Math.max(6, value, average);
  const playerPos = clampPercent((value / scale) * 100);
  const avgPos = clampPercent((average / scale) * 100);
  const rate = formatCoef(longPassProgressiveRate(family));
  const familyLabel = familyBySlug(family).label.toLocaleLowerCase("pt-BR");

  return (
    <div className="constr-share-bar">
      <div className="constr-share-head">
        <span className="constr-share-label">Progressivos sem longo</span>
        <span className="constr-share-value">{formatRate(value)}</span>
      </div>
      <div className="constr-share-track" aria-hidden>
        <span className="constr-share-rail" />
        <span className="constr-share-center" style={{ left: `${avgPos}%` }} />
        <span className="constr-share-dot" style={{ left: `${playerPos}%` }} />
      </div>
      <div className="constr-share-foot">
        <span>0</span>
        <span className="constr-share-avg">média {formatRate(average)}</span>
        <span>{formatRate(scale)}</span>
      </div>
      <p className="pass-tendencies-note">
        Por 90. Para {familyLabel}, cada passe longo conta como {rate} progressivo. A marca é a média da posição nesta
        série.
      </p>
    </div>
  );
}

export function PassTendencies({ player, players }: { player: PlayerProfile; players: PlayerProfile[] }) {
  const [open, setOpen] = useState<"tendencias" | "curta" | null>(null);
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

  const shortPass = useMemo(() => {
    const current = shortProgressive(player);
    if (!current) return null;
    const pool = (players.length ? players : [player])
      .map(shortProgressive)
      .filter((row): row is ShortProgressive => row != null);
    const average = mean(pool.map((row) => row.notLong));
    return { ...current, average };
  }, [player, players]);

  function toggle(next: "tendencias" | "curta") {
    setOpen((current) => (current === next ? null : next));
  }

  return (
    <div className="pass-tendencies">
      <div className="pass-insights-actions">
        <button
          type="button"
          className={`btn btn-ghost pass-tendencies-btn${open === "tendencias" ? " open" : ""}`}
          aria-expanded={open === "tendencias"}
          onClick={() => toggle("tendencias")}
        >
          <i className="fa-solid fa-chart-line" aria-hidden="true" /> Tendências
          <i className={`fa-solid fa-chevron-${open === "tendencias" ? "up" : "down"}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost pass-tendencies-btn${open === "curta" ? " open" : ""}`}
          aria-expanded={open === "curta"}
          onClick={() => toggle("curta")}
        >
          <i className="fa-solid fa-arrow-up-right" aria-hidden="true" /> Progressão curta
          <i className={`fa-solid fa-chevron-${open === "curta" ? "up" : "down"}`} aria-hidden="true" />
        </button>
      </div>
      {open === "tendencias" ? (
        <div className="tendencies-pop-panel pass-tendencies-panel" role="region" aria-label="Tendências">
          <p className="pass-tendencies-note">Comparado à média da posição nesta série.</p>
          {entries.length ? (
            <ConstructionProfileBars entries={entries} embedded />
          ) : (
            <p className="pass-tendencies-note">Sem amostra de passes para esta posição.</p>
          )}
        </div>
      ) : null}
      {open === "curta" ? (
        <div className="tendencies-pop-panel pass-tendencies-panel" role="region" aria-label="Progressão curta">
          {shortPass && shortPass.average != null ? (
            <>
              <ShortProgressiveBar value={shortPass.notLong} average={shortPass.average} family={player.position_family} />
              <ul className="short-prog-split">
                <li>
                  <span>Progressivos</span>
                  <strong>{formatRate(shortPass.progressive)}</strong>
                </li>
                <li>
                  <span>Também longos</span>
                  <strong>{formatRate(shortPass.alsoLong)}</strong>
                </li>
                <li>
                  <span>Sem longo</span>
                  <strong>{formatRate(shortPass.notLong)}</strong>
                </li>
              </ul>
            </>
          ) : (
            <p className="pass-tendencies-note">Sem amostra de passes progressivos para esta posição.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
