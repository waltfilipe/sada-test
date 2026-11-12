"use client";

import { useMemo, useState } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  atArchetypeMetaFor,
  exArchetypeMetaFor,
  latArchetypeMetaFor,
  mcArchetypeMetaFor,
  archetypeMetaFor,
  type ArchetypeTrait,
} from "@/lib/clusterMeta";
import { activeProfileKeys, archetypeClusterSlug, archetypeGrade, archetypeRank, profileAccent, sortedProfileShareRows } from "@/lib/profileShares";
import { gradeTier, tierVars } from "@/lib/scoutTheme";
import { SectionRadar } from "@/components/position/profile/PlayerReport";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
};

function profileMetaForLabel(label: string, family: PositionFamily) {
  if (family === "laterais") {
    return latArchetypeMetaFor(label as "Defensivo" | "Construtor" | "Ofensivo" | "Híbrido");
  }
  if (family === "meio-campistas") {
    return mcArchetypeMetaFor(label as "Contenção" | "Construtor" | "Box-to-box" | "Híbrido");
  }
  if (family === "extremos") {
    return exArchetypeMetaFor(label as "Driblador" | "Meia Ponta" | "Ruptura" | "Híbrido");
  }
  if (family === "atacantes") {
    return atArchetypeMetaFor(label as "Finalizador" | "Alvo" | "Móvel" | "Híbrido");
  }
  if (family === "zagueiros") {
    return archetypeMetaFor(label as "Defensor de Área" | "Construtor" | "Combativo");
  }
  return undefined;
}

function ProfileTooltipContent({
  label,
  grade,
  rank,
  poolSize,
  histPct,
  family,
}: {
  label: string;
  grade: string | null;
  rank: number | null;
  poolSize: number;
  histPct: number | null;
  family: PositionFamily;
}) {
  const meta = profileMetaForLabel(label, family);
  const accent = profileAccent(label);
  const ups = meta?.traits.filter((item) => item.direction === "up") ?? [];
  const downs = meta?.traits.filter((item) => item.direction === "down") ?? [];

  return (
    <div className="profile-archetype-tip">
      <div className="profile-archetype-tip-head">
        <span className="profile-archetype-tip-label">{label}</span>
        <span className="profile-archetype-tip-rating tabular" style={{ color: accent }}>
          {grade ?? "—"}
          {rank ? ` · ${rank}º de ${poolSize}` : ""}
        </span>
      </div>
      {histPct != null ? (
        <p className="profile-archetype-tip-copy">Nota calculada contra o pool multi-temporada da liga (P{Math.round(histPct)})</p>
      ) : null}
      {meta?.description ? <p className="profile-archetype-tip-copy">{meta.description}</p> : null}
      <TraitList title="Valoriza" traits={ups} direction="up" />
      <TraitList title="Desvaloriza" traits={downs} direction="down" />
    </div>
  );
}

function TraitList({
  title,
  traits,
  direction,
}: {
  title: string;
  traits: ArchetypeTrait[];
  direction: "up" | "down";
}) {
  if (!traits.length) return null;
  return (
    <div className="profile-archetype-tip-traits">
      <span className="profile-archetype-tip-traits-title">{title}</span>
      <ul className={`profile-archetype-tip-list profile-archetype-tip-list-${direction}`}>
        {traits.map((trait) => (
          <li key={trait.label}>{trait.label}</li>
        ))}
      </ul>
    </div>
  );
}

export function ProfileCard({ player, family, players }: Props) {
  const shareRows = useMemo(() => sortedProfileShareRows(player), [player]);
  const activeKeys = useMemo(() => activeProfileKeys(player, shareRows), [player, shareRows]);
  const poolSize = players.length;

  if (!shareRows.length) {
    return player.profile ? (
      <div className="player-card profile-perfil-card profile-perfil-card-score">
        <div className="profile-card-head">
          <span className="section-label">Perfil</span>
        </div>
        <p className="profile-share-inline-fallback">{player.profile}</p>
      </div>
    ) : null;
  }

  return (
    <div className="player-card profile-perfil-card profile-perfil-card-score">
      <div className="profile-card-head">
        <span className="section-label">Perfil</span>
        <span className="profile-card-head-hint">Classificação e colocação</span>
      </div>
      <ul className="profile-perfil-list">
        {shareRows.map((row) => {
          const active = activeKeys.has(row.key);
          const accent = profileAccent(row.label);
          const rank = archetypeRank(player, players, row.label, family);
          const grade = archetypeGrade(player, row.label, rank, poolSize);
          const histPct = (() => {
            const slug = archetypeClusterSlug(row.label);
            return slug ? (player.cluster?.hist?.[slug]?.pct ?? null) : null;
          })();
          const token = gradeTier(grade ?? "C");
          const shareWidth = Math.max(3, Math.min(100, row.share));
          return (
            <li key={row.key}>
              <Tooltip
                content={
                  <ProfileTooltipContent
                    label={row.label}
                    grade={grade}
                    rank={rank}
                    poolSize={poolSize}
                    histPct={histPct}
                    family={family}
                  />
                }
                block
              >
                <div
                  className={`profile-perfil-row cluster-${row.tone}${active ? " active" : ""}`}
                  style={{ "--profile-accent": accent } as React.CSSProperties}
                >
                  <div className="profile-perfil-row-top">
                    <div className="profile-perfil-row-copy">
                      <span className="profile-perfil-row-label">
                        {row.label}
                        <i className="fa-solid fa-circle-info profile-perfil-row-info" aria-hidden="true" />
                      </span>
                      <span className="profile-perfil-row-rank tabular">
                        {rank ? (
                          <>
                            <strong>{rank}º</strong> de {poolSize}
                          </>
                        ) : (
                          "Sem colocação"
                        )}
                      </span>
                    </div>
                    <span
                      className="profile-perfil-grade tabular"
                      style={tierVars(token)}
                      aria-label={`Classificação ${grade ?? "indisponível"}`}
                    >
                      {grade ?? "—"}
                    </span>
                  </div>
                  <div className="profile-perfil-row-affinity" title="Afinidade com o arquétipo">
                    <span className="profile-perfil-row-affinity-label">Afinidade</span>
                    <span className="profile-perfil-row-bar" aria-hidden="true">
                      <span style={{ width: `${shareWidth}%` }} />
                    </span>
                    <span className="profile-perfil-row-share tabular">{Math.round(row.share)}%</span>
                  </div>
                </div>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Radar of the position profiles: each axis is the player's percentile in that archetype ranking. */
export function ProfileRadarCard({ player, family, players }: Props) {
  const shareRows = useMemo(() => sortedProfileShareRows(player), [player]);
  const activeKeys = useMemo(() => activeProfileKeys(player, shareRows), [player, shareRows]);
  const [hovered, setHovered] = useState<string | null>(null);
  const poolSize = players.length;
  const rows = useMemo(
    () =>
      shareRows.map((row) => {
        const rank = archetypeRank(player, players, row.label, family);
        const grade = archetypeGrade(player, row.label, rank, poolSize);
        const slug = archetypeClusterSlug(row.label);
        const histPct = slug ? (player.cluster?.hist?.[slug]?.pct ?? null) : null;
        return {
          ...row,
          rank,
          grade,
          histPct,
          main: activeKeys.has(row.key),
          score: Math.round(row.share),
          accent: profileAccent(row.label),
        };
      }),
    [shareRows, player, players, family, poolSize, activeKeys],
  );

  if (rows.length < 3) return <ProfileCard player={player} family={family} players={players} />;

  const scores = rows.map((row) => ({
    title: row.label,
    tone: row.tone,
    score: row.score,
    color: row.accent,
    display: `${row.score}%`,
  }));

  return (
    <div className="player-card profile-perfil-card stat-radar-card profile-radar-card">
      <div className="profile-card-head">
        <span className="section-label">Perfil</span>
        <span className="profile-card-head-hint">Estilo de jogo e nota em cada perfil</span>
      </div>
      <div className="profile-radar-body">
        <div className="stat-radar-figure">
          <SectionRadar scores={scores} variant="screen" shape="sectors" activeTitle={hovered} onHoverTitle={setHovered} />
        </div>
        <div className="profile-radar-panel">
          <div className="profile-radar-cols" aria-hidden="true">
            <span>Perfil · afinidade</span>
            <span>Nota</span>
          </div>
          <ul className="profile-radar-list">
            {rows.map((row) => (
              <li key={row.key}>
                <Tooltip
                  content={
                    <ProfileTooltipContent
                      label={row.label}
                      grade={row.grade}
                      rank={row.rank}
                      poolSize={poolSize}
                      histPct={row.histPct}
                      family={family}
                    />
                  }
                  block
                >
                  <div
                    className={`profile-radar-row${row.main ? " is-main" : ""}${hovered === row.label ? " is-hover" : hovered ? " is-dim" : ""}`}
                    style={{ "--profile-accent": row.accent } as React.CSSProperties}
                    onMouseEnter={() => setHovered(row.label)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <span className="profile-radar-row-label">
                      <i aria-hidden="true" />
                      <b>{row.label}</b>
                      {row.main ? <em>Principal</em> : null}
                    </span>
                    <span className="profile-radar-row-affinity">
                      <span className="profile-radar-row-bar" aria-hidden="true">
                        <span style={{ width: `${Math.max(3, Math.min(100, row.score))}%` }} />
                      </span>
                      <span className="profile-radar-row-pct tabular">{row.score}%</span>
                    </span>
                    <span className="profile-radar-row-rank tabular">
                      {row.rank ? `${row.rank}º de ${poolSize} na liga` : "Sem colocação"}
                    </span>
                    <span
                      className="profile-perfil-grade tabular"
                      style={tierVars(gradeTier(row.grade ?? "C"))}
                      aria-label={`Nota ${row.grade ?? "indisponível"}`}
                    >
                      {row.grade ?? "—"}
                    </span>
                  </div>
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
