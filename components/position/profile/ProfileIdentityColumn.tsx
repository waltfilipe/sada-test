"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClubLogo } from "@/components/ClubLogo";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  latArchetypeMetaFor,
  archetypeMetaFor,
  type ArchetypeTrait,
} from "@/lib/clusterMeta";
import { profileAccent, sortedProfileShareRows } from "@/lib/profileShares";
import { formatRating, playerInitials, ratingTier, tierVars } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
};

function FactIcon({ icon }: { icon: string }) {
  return (
    <span className="identity-fact-icon" aria-hidden="true">
      <i className={`fa-solid ${icon}`} />
    </span>
  );
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function profileMetaForLabel(label: string, family: PositionFamily) {
  if (family === "laterais") {
    return latArchetypeMetaFor(label as "Defensivo" | "Construtor" | "Ofensivo" | "Híbrido");
  }
  if (family === "zagueiros") {
    return archetypeMetaFor(label as "Defensor de Área" | "Construtor" | "Combativo");
  }
  return undefined;
}

function ProfileTooltipContent({
  label,
  rating,
  family,
}: {
  label: string;
  rating: number;
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
          Rating {formatRating(rating)}
        </span>
      </div>
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

export function ProfileIdentityColumn({ player, family }: Props) {
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const tm = player.transfermarkt;
  const contract =
    tm?.contract_remaining ?? (tm?.contract_until ? formatDate(tm.contract_until) : null);

  const shareRows = useMemo(() => sortedProfileShareRows(player), [player]);
  const activeKey = player.cluster?.archetype === "Híbrido" ? null : player.cluster?.archetype;

  return (
    <div className="pa-col pa-col-identity">
      <div className="player-card profile-identity-head-card">
        <div className="profile-identity-head-grid">
          <div className="identity-photo-column">
            <div className="identity-photo-side profile-identity-photo">
              {tm?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tm.photo} alt={player.name} className="identity-photo" />
              ) : (
                <div className="identity-photo-placeholder identity-photo-placeholder-side">
                  {playerInitials(player.name)}
                </div>
              )}
            </div>
            <div className="identity-photo-actions">
              <Link className="btn btn-ghost btn-sm btn-block" href={`/comparar?posicao=${family}&a=${player.player_id}`}>
                <i className="fa-solid fa-scale-balanced" aria-hidden="true" /> Comparar
              </Link>
              {tm?.profile_url ? (
                <a className="btn btn-ghost btn-sm btn-block" href={tm.profile_url} target="_blank" rel="noreferrer">
                  <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Transfermarkt
                </a>
              ) : null}
            </div>
          </div>

          <div className="profile-identity-head-copy">
            <h2 className="identity-title">{player.name}</h2>
            <p className="identity-subline">
              <ClubLogo club={player.club} size={15} /> {player.club} · {player.position}
            </p>

            {shareRows.length ? (
              <div className="profile-perfil-card">
                <div className="profile-perfil-card-head">
                  <span className="profile-perfil-card-title">Perfil</span>
                </div>
                <ul className="profile-perfil-list">
                  {shareRows.map((row) => {
                    const token = ratingTier(row.rating);
                    const active = row.key === activeKey;
                    const accent = profileAccent(row.label);
                    return (
                      <li key={row.key}>
                        <Tooltip
                          content={
                            <ProfileTooltipContent label={row.label} rating={row.rating} family={family} />
                          }
                          block
                        >
                          <div
                            className={`profile-perfil-row cluster-${row.tone}${active ? " active" : ""}`}
                            style={{ "--profile-accent": accent } as React.CSSProperties}
                          >
                            <span className="profile-perfil-row-label">
                              {row.label}
                              <i className="fa-solid fa-circle-info profile-perfil-row-info" aria-hidden="true" />
                            </span>
                            <span className="profile-perfil-row-meta tabular">
                              <span className="profile-perfil-row-share">{Math.round(row.share)}%</span>
                              <span className="profile-perfil-row-sep">·</span>
                              <span className="profile-perfil-row-rating" style={tierVars(token)}>
                                Rating {formatRating(row.rating)}
                              </span>
                            </span>
                          </div>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="profile-share-inline-fallback">{player.profile}</p>
            )}
          </div>
        </div>
      </div>

      <div className="identity-card identity-card-bare">
        <div className="identity-facts identity-facts-side">
          <div className="identity-fact">
            <FactIcon icon="fa-cake-candles" />
            <span className="identity-fact-label">Idade</span>
            <span className="identity-fact-value tabular">{age ?? "—"}</span>
          </div>
          <div className="identity-fact">
            <FactIcon icon="fa-ruler-vertical" />
            <span className="identity-fact-label">Altura</span>
            <span className="identity-fact-value">{player.height ? `${player.height} cm` : "—"}</span>
          </div>
          <div className="identity-fact">
            <FactIcon icon="fa-earth-americas" />
            <span className="identity-fact-label">País</span>
            <span className="identity-fact-value">{player.nationality ?? "—"}</span>
          </div>
          <div className="identity-fact">
            <FactIcon icon="fa-shoe-prints" />
            <span className="identity-fact-label">Pé</span>
            <span className="identity-fact-value">{player.foot ?? "—"}</span>
          </div>
        </div>

        <div className="identity-meta-row">
          <div className="identity-meta-pill">
            <span>
              <FactIcon icon="fa-coins" /> Valor
            </span>
            <strong>{tm?.market_value ?? "—"}</strong>
          </div>
          <div className="identity-meta-pill">
            <span>
              <FactIcon icon="fa-calendar-days" /> Contrato
            </span>
            <strong>{contract ?? "—"}</strong>
          </div>
          <div className="identity-meta-pill">
            <span>
              <FactIcon icon="fa-clock" /> Minutos
            </span>
            <strong className="tabular">{player.minutes.toLocaleString("pt-BR")}</strong>
          </div>
        </div>

        <div className="heatmap-placeholder" aria-label="Heatmap em breve">
          <span className="section-label-sm">Heatmap</span>
          <p className="heatmap-placeholder-copy">Mapa de origem de ações — em breve.</p>
        </div>
      </div>
    </div>
  );
}
