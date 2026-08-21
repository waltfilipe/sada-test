"use client";

import { useMemo } from "react";

import { formatRating, ratingTier, tierVars } from "@/lib/scoutTheme";
import {
  LAT_ARCHETYPE_META,
  ZAG_ARCHETYPE_META,
  archetypeTone,
  isLatCluster,
  latArchetypeTone,
  type LatArchetype,
  type PositionCluster,
  type ZagArchetype,
} from "@/lib/clusterMeta";
import type { PlayerProfile } from "@/lib/types";

type MixRow = {
  key: string;
  label: string;
  tone: string;
  shareA: number;
  shareB: number;
  ratingA: number;
  ratingB: number;
};

function buildRows(a: PositionCluster, b: PositionCluster): MixRow[] {
  if (isLatCluster(a) && isLatCluster(b)) {
    const shareMapA: Record<LatArchetype, number | undefined> = {
      Defensivo: a.shares.defensivo,
      Construtor: a.shares.construtor,
      Ofensivo: a.shares.ofensivo,
      Híbrido: undefined,
    };
    const shareMapB: Record<LatArchetype, number | undefined> = {
      Defensivo: b.shares.defensivo,
      Construtor: b.shares.construtor,
      Ofensivo: b.shares.ofensivo,
      Híbrido: undefined,
    };
    const ratingMapA: Record<Exclude<LatArchetype, "Híbrido">, number> = {
      Defensivo: a.ratings.defensivo,
      Construtor: a.ratings.construtor,
      Ofensivo: a.ratings.ofensivo,
    };
    const ratingMapB: Record<Exclude<LatArchetype, "Híbrido">, number> = {
      Defensivo: b.ratings.defensivo,
      Construtor: b.ratings.construtor,
      Ofensivo: b.ratings.ofensivo,
    };

    return LAT_ARCHETYPE_META.filter((item) => item.archetype !== "Híbrido").map((item) => ({
      key: item.archetype,
      label: item.archetype,
      tone: latArchetypeTone(item.archetype),
      shareA: shareMapA[item.archetype] ?? 0,
      shareB: shareMapB[item.archetype] ?? 0,
      ratingA: ratingMapA[item.archetype as Exclude<LatArchetype, "Híbrido">],
      ratingB: ratingMapB[item.archetype as Exclude<LatArchetype, "Híbrido">],
    }));
  }

  if (!isLatCluster(a) && !isLatCluster(b)) {
    const shareMapA = {
      "Defensor de Área": a.shares.defensor_area,
      Construtor: a.shares.construtor,
      Combativo: a.shares.combativo,
    };
    const shareMapB = {
      "Defensor de Área": b.shares.defensor_area,
      Construtor: b.shares.construtor,
      Combativo: b.shares.combativo,
    };
    const ratingMapA = {
      "Defensor de Área": a.ratings.defensor_area,
      Construtor: a.ratings.construtor,
      Combativo: a.ratings.combativo,
    };
    const ratingMapB = {
      "Defensor de Área": b.ratings.defensor_area,
      Construtor: b.ratings.construtor,
      Combativo: b.ratings.combativo,
    };

    return ZAG_ARCHETYPE_META.map((item) => ({
      key: item.archetype,
      label: item.archetype,
      tone: archetypeTone(item.archetype as ZagArchetype),
      shareA: shareMapA[item.archetype as ZagArchetype],
      shareB: shareMapB[item.archetype as ZagArchetype],
      ratingA: ratingMapA[item.archetype as ZagArchetype],
      ratingB: ratingMapB[item.archetype as ZagArchetype],
    }));
  }

  return [];
}

type Props = {
  a: PlayerProfile;
  b: PlayerProfile;
};

export function ArchetypeVersus({ a, b }: Props) {
  const rows = useMemo(() => {
    if (!a.cluster || !b.cluster) return [];
    return buildRows(a.cluster, b.cluster);
  }, [a.cluster, b.cluster]);

  if (!rows.length) return null;

  return (
    <div className="archetype-versus">
      <ul className="archetype-versus-rows">
        {rows.map((item) => {
          const shareLeads =
            item.shareA === item.shareB ? "tie" : item.shareA > item.shareB ? "a" : "b";
          const ratingLeads =
            item.ratingA === item.ratingB ? "tie" : item.ratingA > item.ratingB ? "a" : "b";

          return (
            <li key={item.key} className={`archetype-versus-item cluster-${item.tone}`}>
              <div className="archetype-versus-head">
                <span className={`archetype-versus-name cluster-${item.tone}`}>{item.label}</span>
              </div>

              <div className={`archetype-versus-metric leads-${shareLeads}`}>
                <span className="archetype-versus-side side-a">{Math.round(item.shareA)}%</span>
                <span className="archetype-versus-label">Afinidade</span>
                <span className="archetype-versus-side side-b">{Math.round(item.shareB)}%</span>
              </div>

              <div className={`archetype-versus-metric leads-${ratingLeads}`}>
                <span className="archetype-versus-side side-a" style={tierVars(ratingTier(item.ratingA))}>
                  {formatRating(item.ratingA)}
                </span>
                <span className="archetype-versus-label">Rating no arquétipo</span>
                <span className="archetype-versus-side side-b" style={tierVars(ratingTier(item.ratingB))}>
                  {formatRating(item.ratingB)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
