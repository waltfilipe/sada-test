"use client";

import Link from "next/link";
import { ClubLogo } from "@/components/ClubLogo";
import { MinutesStat } from "@/components/position/MinutesStat";
import { ProfileTag, profileTagProps } from "@/components/position/ProfileTag";
import { playerInitials } from "@/lib/scoutTheme";
import type { FamilyBadgeOption } from "@/lib/statBadges";
import type { PlayerSearchRow } from "@/lib/types";

const CURRENT_YEAR = new Date().getFullYear();

export function PlayerResultRow({
  player,
  catalog,
}: {
  player: PlayerSearchRow;
  catalog: FamilyBadgeOption[];
}) {
  const age = player.birth_year ? CURRENT_YEAR - player.birth_year : null;
  const tm = player.transfermarkt;
  const earned = catalog.filter((badge) => player.badges.includes(badge.key));

  const facts = [
    { label: "Idade", value: age ? `${age}` : "—", unit: age ? "anos" : undefined },
    { label: "Altura", value: player.height ? `${player.height}` : "—", unit: player.height ? "cm" : undefined },
    { label: "Pé", value: player.foot ?? "—" },
    { label: "Minutos", value: player.minutes.toLocaleString("pt-BR") },
  ];

  return (
    <Link
      href={`/posicao/${player.position_family}?atleta=${player.player_id}&origem=filtros`}
      className="result-row"
    >
      <div className="row-photo">
        {tm?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tm.photo} alt="" loading="lazy" />
        ) : (
          <span>{playerInitials(player.name)}</span>
        )}
      </div>

      <div className="row-identity">
        <div className="row-name">
          <h3>{player.name}</h3>
          <ProfileTag {...profileTagProps(player)} />
        </div>
        <p className="row-club">
          <ClubLogo club={player.club} size={16} />
          {player.club}
          <i aria-hidden>·</i>
          <span>{player.position}</span>
        </p>

        <dl className="row-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>
                {fact.value}
                {fact.unit && <em>{fact.unit}</em>}
              </dd>
            </div>
          ))}
        </dl>

        {earned.length ? (
          <ul className="row-badges" aria-label="Badges">
            {earned.map((badge) => (
              <li key={badge.key} className={`row-badge tone-${badge.tone}`} title={badge.title}>
                <i className={`fa-solid ${badge.icon}`} aria-hidden="true" />
                {badge.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="row-badges-empty">Sem badges nesta posição</p>
        )}
      </div>

      <div className="row-aside">
        <MinutesStat
          minutes={player.minutes}
          minutesPct={player.minutes_pct}
          variant="compact"
          className="row-minutes"
        />

        <div className="row-market">
          <div>
            <span>Valor</span>
            <strong>{tm?.market_value ?? "—"}</strong>
          </div>
          <div>
            <span>Contrato</span>
            <strong>{tm?.contract_remaining ?? "—"}</strong>
          </div>
        </div>
      </div>
    </Link>
  );
}
