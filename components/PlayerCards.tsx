"use client";

import { formatRating, ratingColor } from "@/lib/positions";
import type { PlayerProfile } from "@/lib/types";

export function PlayerIdentityCard({ player }: { player: PlayerProfile }) {
  return (
    <div className="identity-card">
      <p className="identity-position">{player.position}</p>
      <h2>{player.name}</h2>
      <p className="identity-club">{player.club}</p>
      <div className="identity-grid">
        <div><span>Ano</span><strong>{player.birth_year ?? "—"}</strong></div>
        <div><span>Nacionalidade</span><strong>{player.nationality ?? "—"}</strong></div>
        <div><span>Altura</span><strong>{player.height ?? "—"}</strong></div>
        <div><span>Pé dominante</span><strong>{player.foot ?? "—"}</strong></div>
      </div>
      <div className="identity-stats">
        <div><span>Minutagem</span><strong>{player.minutes}</strong></div>
        <div><span>Gols</span><strong>{player.goals}</strong></div>
        <div><span>Assist.</span><strong>{player.assists}</strong></div>
      </div>
    </div>
  );
}

export function RatingStrip({ player }: { player: PlayerProfile }) {
  const items = [
    { label: "Rating Geral", value: player.ratings.geral, rank: player.ranks.geral, tone: "primary" },
    { label: "Combativo", value: player.ratings.combativo, rank: player.ranks.combativo, tone: "combat" },
    { label: "Construtor", value: player.ratings.construtor, rank: player.ranks.construtor, tone: "build" },
    { label: "Posicional", value: player.ratings.posicional, rank: player.ranks.posicional, tone: "anchor" },
  ];

  return (
    <div className="rating-strip">
      {items.map((item) => (
        <div key={item.label} className={`rating-box tone-${item.tone}`}>
          <span>{item.label}</span>
          <strong style={{ color: ratingColor(item.value) }}>{formatRating(item.value)}</strong>
          <em>#{item.rank}</em>
        </div>
      ))}
    </div>
  );
}

export function AspectPanel({ title, items }: { title: string; items: PlayerProfile["aspects"]["defensivos"] }) {
  return (
    <div className="aspect-panel">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            <div className="aspect-meta">
              {item.medal && <span className={`medal ${item.medal}`} />}
              <strong>{item.grade}</strong>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TendencyBars({ tendencies }: { tendencies: PlayerProfile["tendencies"] }) {
  const entries = [
    ["Construção", tendencies.construcao],
    ["Ofensividade", tendencies.ofensividade],
    ["1vs1 - Defensivo", tendencies.def1v1],
    ["Contenção", tendencies.contencao],
    ["Duelo Aéreo", tendencies.duelo_aereo],
  ] as const;

  return (
    <div className="tendency-bars">
      {entries.map(([label, value]) => (
        <div key={label} className="tendency-row">
          <span>{label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${value}%` }} />
          </div>
          <strong>{Math.round(value)}</strong>
        </div>
      ))}
    </div>
  );
}
