"use client";

import Link from "next/link";
import { familyBySlug } from "@/lib/positions";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { MinutesStat } from "./MinutesStat";
import { ProfileTag, profileTagProps } from "./ProfileTag";
import { RatingDial } from "./RatingDial";

type Props = {
  player: PlayerProfile;
  poolSize: number;
  poolMedian: number;
  family: PositionFamily;
};

export function DossierHeader({ player, poolSize, poolMedian, family }: Props) {
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const positionLabel = player.position || familyBySlug(family).label;
  const tm = player.transfermarkt;

  const contract =
    tm?.contract_remaining ?? (tm?.contract_until ? `até ${formatDate(tm.contract_until)}` : null);

  const facts = [
    { label: "Idade", value: age ? `${age}` : "—", unit: age ? "anos" : undefined },
    { label: "Altura", value: player.height ? `${player.height}` : "—", unit: player.height ? "cm" : undefined },
    { label: "Pé", value: player.foot ?? "—" },
    { label: "País", value: player.nationality ?? "—" },
  ];

  return (
    <section className="dossier-card">
      <div className="dossier-portrait">
        {tm?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tm.photo} alt={player.name} />
        ) : (
          <span className="portrait-fallback">{playerInitials(player.name)}</span>
        )}
      </div>

      <div className="dossier-identity">
        <p className="dossier-eyebrow">
          <span>{positionLabel}</span>
          <i aria-hidden />
          <ProfileTag {...profileTagProps(player)} />
        </p>

        <h1>{player.name}</h1>
        <p className="dossier-club">{player.club}</p>

        <dl className="dossier-facts">
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
      </div>

      <div className="dossier-dial">
        <RatingDial value={player.ratings.geral} rank={player.ranks.geral} poolSize={poolSize} reference={poolMedian} />
      </div>

      <footer className="dossier-bar">
        <div className="bar-group bar-market">
          <div className="bar-item">
            <span>Valor de mercado</span>
            <strong>{tm?.market_value ?? "—"}</strong>
          </div>
          <div className="bar-item">
            <span>Contrato</span>
            <strong>{contract ?? "—"}</strong>
          </div>
        </div>

        <MinutesStat minutes={player.minutes} minutesPct={player.minutes_pct} variant="prominent" />

        <div className="bar-group bar-output">
          <div className="bar-item">
            <span>Gols</span>
            <strong>{player.goals}</strong>
          </div>
          <div className="bar-item">
            <span>Assistências</span>
            <strong>{player.assists}</strong>
          </div>
        </div>

        <div className="bar-actions">
          <Link className="bar-compare" href={`/comparar?posicao=${family}&a=${player.player_id}`}>
            <svg viewBox="0 0 14 14" aria-hidden>
              <path
                d="M5.5 3.5 2.5 7l3 3.5M8.5 3.5 11.5 7l-3 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Comparar
          </Link>

          {tm?.profile_url && (
            <a className="bar-source" href={tm.profile_url} target="_blank" rel="noreferrer">
              Transfermarkt
              <svg viewBox="0 0 12 12" aria-hidden>
                <path d="M4 2h6v6M10 2 2.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </a>
          )}
        </div>
      </footer>
    </section>
  );
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}
