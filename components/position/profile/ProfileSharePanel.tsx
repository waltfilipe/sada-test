"use client";

import { useMemo } from "react";
import {
  LAT_ARCHETYPE_META,
  ZAG_ARCHETYPE_META,
  isLatCluster,
  latArchetypeTone,
  archetypeTone,
} from "@/lib/clusterMeta";
import { formatRating, ratingTier, tierVars } from "@/lib/scoutTheme";
import type { PlayerProfile } from "@/lib/types";
import { ConstructionProfileBars } from "../ConstructionProfileBars";

type ShareRow = {
  key: string;
  label: string;
  tone: string;
  share: number;
  rating: number;
};

function buildShareRows(player: PlayerProfile): ShareRow[] {
  if (!player.cluster) return [];
  if (isLatCluster(player.cluster)) {
    const cluster = player.cluster;
    return LAT_ARCHETYPE_META.filter((m) => m.archetype !== "Híbrido").map((item) => ({
      key: item.archetype,
      label: item.archetype,
      tone: latArchetypeTone(item.archetype),
      share:
        item.archetype === "Defensivo"
          ? cluster.shares.defensivo
          : item.archetype === "Construtor"
            ? cluster.shares.construtor
            : cluster.shares.ofensivo,
      rating:
        item.archetype === "Defensivo"
          ? cluster.ratings.defensivo
          : item.archetype === "Construtor"
            ? cluster.ratings.construtor
            : cluster.ratings.ofensivo,
    }));
  }
  const cluster = player.cluster;
  return ZAG_ARCHETYPE_META.map((item) => ({
    key: item.archetype,
    label: item.archetype,
    tone: archetypeTone(item.archetype),
    share:
      item.archetype === "Defensor de Área"
        ? cluster.shares.defensor_area
        : item.archetype === "Construtor"
          ? cluster.shares.construtor
          : cluster.shares.combativo,
    rating:
      item.archetype === "Defensor de Área"
        ? cluster.ratings.defensor_area
        : item.archetype === "Construtor"
          ? cluster.ratings.construtor
          : cluster.ratings.combativo,
  }));
}

export function ProfileSharePanel({ player }: { player: PlayerProfile }) {
  const rows = useMemo(() => {
    const built = buildShareRows(player);
    return [...built].sort((a, b) => b.share - a.share);
  }, [player]);

  const activeKey = player.cluster?.archetype === "Híbrido" ? null : player.cluster?.archetype;

  if (!rows.length) return null;

  return (
    <div className="player-card profile-share-card">
      <h3 className="section-label">Composição de perfil</h3>
      <ul className="profile-share-list">
        {rows.map((row) => {
          const token = ratingTier(row.rating);
          const active = row.key === activeKey;
          return (
            <li key={row.key} className={`profile-share-row cluster-${row.tone}${active ? " active" : ""}`}>
              <div className="profile-share-head">
                <span className="profile-share-label">{row.label}</span>
                <span className="profile-share-meta">
                  <span className="profile-share-pct tabular">{Math.round(row.share)}%</span>
                  <span className="profile-share-rating-label">Rating</span>
                  <span className="profile-share-grade tabular" style={tierVars(token)}>
                    {formatRating(row.rating)}
                  </span>
                </span>
              </div>
              <div className="profile-share-track" aria-hidden>
                <span className="profile-share-fill" style={{ width: `${Math.min(100, row.share)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ProfilePillarBars({ player }: { player: PlayerProfile }) {
  const constr = player.aspects.perfil_construcao ?? [];
  const def = player.aspects.perfil_defensivo ?? [];

  return (
    <div className="player-card xp-profile-panel-card">
      <h3 className="section-label">Tendências de jogo</h3>
      <div className="xp-profile-pillar-stack">
        <article className="xp-profile-pillar-card xp-profile-pillar-productivity">
          <header className="xp-profile-pillar-head">
            <span className="xp-profile-pillar-icon" aria-hidden="true">
              <i className="fa-solid fa-chart-simple" />
            </span>
            <div className="xp-profile-pillar-title-wrap">
              <h4 className="xp-profile-pillar-title">Perfil de construção</h4>
            </div>
          </header>
          <div className="xp-profile-pillar-body">
            <ConstructionProfileBars items={constr} embedded />
          </div>
        </article>

        {def.length ? (
          <article className="xp-profile-pillar-card xp-profile-pillar-precision">
            <header className="xp-profile-pillar-head">
              <span className="xp-profile-pillar-icon" aria-hidden="true">
                <i className="fa-solid fa-shield-halved" />
              </span>
              <div className="xp-profile-pillar-title-wrap">
                <h4 className="xp-profile-pillar-title">Perfil defensivo</h4>
              </div>
            </header>
            <div className="xp-profile-pillar-body">
              <ConstructionProfileBars items={def} embedded />
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
