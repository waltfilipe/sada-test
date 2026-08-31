"use client";

import Link from "next/link";
import { ClubLogo } from "@/components/ClubLogo";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
};

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function InlineFact({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span className="identity-inline-sep" aria-hidden="true">
        ·
      </span>
      <span className="identity-inline-fact">{children}</span>
    </>
  );
}

export function ProfileIdentityColumn({ player, family }: Props) {
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const tm = player.transfermarkt;
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
            <p className="identity-subline identity-subline-extended">
              <ClubLogo club={player.club} size={15} /> {player.club} · {player.position}
              {age != null ? <InlineFact>{age} anos</InlineFact> : null}
              {player.height ? <InlineFact>{player.height} cm</InlineFact> : null}
              {player.nationality ? <InlineFact>{player.nationality}</InlineFact> : null}
              {player.foot ? <InlineFact>{player.foot}</InlineFact> : null}
              {tm?.market_value ? <InlineFact>{tm.market_value}</InlineFact> : null}
              {contract ? <InlineFact>{contract}</InlineFact> : null}
              <InlineFact>
                <span className="identity-inline-minutes">
                  {player.minutes.toLocaleString("pt-BR")} min
                  {player.minutes_pct != null ? (
                    <span
                      className="identity-minutes-track identity-minutes-track-inline"
                      role="img"
                      aria-label={`${Math.round(player.minutes_pct)}% dos minutos possíveis`}
                    >
                      <span
                        className="identity-minutes-cover"
                        style={{ left: `${Math.max(0, Math.min(100, player.minutes_pct))}%` }}
                      />
                    </span>
                  ) : null}
                </span>
              </InlineFact>
            </p>
          </div>
        </div>
      </div>

      <div className="heatmap-placeholder" aria-label="Heatmap em breve">
        <span className="section-label-sm">Heatmap</span>
        <p className="heatmap-placeholder-copy">Mapa de origem de ações — em breve.</p>
      </div>
    </div>
  );
}
