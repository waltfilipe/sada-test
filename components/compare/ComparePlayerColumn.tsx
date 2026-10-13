"use client";

import Link from "next/link";
import { useLeague } from "@/components/LeagueProvider";
import { ClubLogo } from "@/components/ClubLogo";
import { ProfileTag, profileTagProps } from "@/components/position/ProfileTag";
import { PlayerHeatmap } from "@/components/position/profile/PlayerHeatmap";
import { ProfileCard } from "@/components/position/profile/ProfileCard";
import { ScoutStatsSections } from "@/components/position/profile/ScoutStatsSections";
import { AddToShadowMenu } from "@/components/shadow/AddToShadowMenu";
import { playerInitials } from "@/lib/scoutTheme";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

export type CompareSide = "a" | "b" | "c";

type Props = {
  side: CompareSide;
  label: string;
  player: PlayerProfile;
  players: PlayerProfile[];
  family: PositionFamily;
  pool: PlayerProfile[];
  excludeIds: Set<string>;
  onChange: (id: string) => void;
  activeSection: string | null;
  onSectionChange: (title: string | null) => void;
  peers: PlayerProfile[];
};

function monthsRemaining(iso?: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month) return "—";
  const end = new Date(year, month - 1, day || 1);
  const now = new Date();
  let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (end.getDate() < now.getDate()) months -= 1;
  if (months < 0) return "Expirado";
  return `${months} ${months === 1 ? "mês" : "meses"}`;
}

export function ComparePlayerColumn({
  side,
  label,
  player,
  players,
  family,
  pool,
  excludeIds,
  onChange,
  activeSection,
  onSectionChange,
  peers,
  heatmapsEnabled = true,
}: Props & { heatmapsEnabled?: boolean }) {
  const { href } = useLeague();
  const tm = player.transfermarkt;
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;

  return (
    <article className={`compare-player-column side-${side}`} aria-label={`Coluna ${label}: ${player.name}`}>
      <header className={`compare-identity-card player-card side-${side}`}>
        <label className="compare-col-picker">
          <span>{label}</span>
          <select
            value={player.player_id}
            onChange={(event) => {
              const next = event.target.value;
              if (!excludeIds.has(next)) onChange(next);
            }}
          >
            {players.map((option) => (
              <option
                key={option.player_id}
                value={option.player_id}
                disabled={excludeIds.has(option.player_id) && option.player_id !== player.player_id}
              >
                {option.name} — {option.club}
              </option>
            ))}
          </select>
        </label>

        <div className="compare-head-top">
          <div className="compare-col-photo">
            <PlayerPhoto
              src={tm?.photo}
              alt={player.name}
              fallback={<span className="compare-col-photo-fallback">{playerInitials(player.name)}</span>}
            />
          </div>

          <div className="compare-col-side">
            <div className="compare-col-identity">
              <h2 className="compare-col-name">{player.name}</h2>
              <p className="compare-col-club">
                <ClubLogo club={player.club} size={16} />
                <span>{player.club}</span>
                <span aria-hidden="true">·</span>
                <span className="compare-col-position">{player.position}</span>
              </p>
              <div className="compare-col-tag-row">
                <ProfileTag {...profileTagProps(player)} />
              </div>
            </div>

            <div className="compare-col-actions">
              <Link className="btn btn-ghost btn-sm" href={href(`/posicao/${family}?atleta=${player.player_id}`)}>
                <i className="fa-solid fa-user" aria-hidden="true" /> Ver perfil
              </Link>
              {tm?.profile_url ? (
                <a className="btn btn-ghost btn-sm" href={tm.profile_url} target="_blank" rel="noreferrer">
                  <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Transfermarkt
                </a>
              ) : null}
              <AddToShadowMenu playerId={player.player_id} family={family} />
            </div>
          </div>
        </div>

        <div className={`compare-head-bottom${heatmapsEnabled ? "" : " compare-head-bottom-no-heatmap"}`}>
          {heatmapsEnabled ? (
            <div className="compare-col-pitch">
              <PlayerHeatmap compact heatmap={player.heatmap} playerName={player.name} />
            </div>
          ) : null}
          <dl className="compare-fact-grid">
            <div>
              <dt>Valor</dt>
              <dd>{tm?.market_value ?? "—"}</dd>
            </div>
            <div>
              <dt>Contrato</dt>
              <dd>{monthsRemaining(tm?.contract_until)}</dd>
            </div>
            <div>
              <dt>Minutos</dt>
              <dd className="tabular">
                {player.minutes.toLocaleString("pt-BR")}
                {player.minutes_pct != null ? <em>{Math.round(player.minutes_pct)}%</em> : null}
              </dd>
            </div>
            <div>
              <dt>Idade</dt>
              <dd>{age ?? "—"}</dd>
            </div>
            <div>
              <dt>Gols</dt>
              <dd className="tabular">{player.goals}</dd>
            </div>
            <div>
              <dt>Assistências</dt>
              <dd className="tabular">{player.assists}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="compare-col-stack">
        <div className="compare-col-profile">
          <ProfileCard player={player} family={family} players={pool} />
        </div>

        <div className="player-card compare-col-stats">
          <ScoutStatsSections
            player={player}
            family={family}
            active={activeSection}
            onActiveChange={onSectionChange}
            peers={peers}
          />
        </div>
      </div>
    </article>
  );
}
