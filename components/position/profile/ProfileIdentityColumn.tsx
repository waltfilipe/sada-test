"use client";

import Link from "next/link";
import { ClubLogo } from "@/components/ClubLogo";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { profileDescription } from "./PositionFilterBar";

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

export function ProfileIdentityColumn({ player, family }: Props) {
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const tm = player.transfermarkt;
  const profile = profileDescription(player);
  const contract =
    tm?.contract_remaining ?? (tm?.contract_until ? formatDate(tm.contract_until) : null);

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
              {player.club} · {player.position}
            </p>

            <div
              className="profile-cluster-card profile-cluster-inline"
              style={{
                borderColor: `${profile.accent}44`,
                boxShadow: `inset 0 1px 0 ${profile.accent}18`,
              }}
            >
              <div className="profile-cluster-body">
                <span className="profile-cluster-icon" style={{ color: profile.accent }} aria-hidden="true">
                  <i className="fa-solid fa-fingerprint" />
                </span>
                <div className="profile-cluster-copy">
                  <span className="profile-cluster-eyebrow">Perfil</span>
                  <p className="profile-cluster-title">{profile.title}</p>
                  <p className="profile-cluster-summary">{profile.summary}</p>
                </div>
              </div>
            </div>
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
