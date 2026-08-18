"use client";

import { useMemo, useState } from "react";
import { formatRating, playerInitials, ratingTier, tierVars } from "@/lib/scoutTheme";
import { profileTone, sortPlayers } from "@/lib/scoutUi";
import type { PlayerProfile } from "@/lib/types";

type Sort = "rating" | "minutes" | "name";

const SORTS: { key: Sort; label: string }[] = [
  { key: "rating", label: "Rating" },
  { key: "minutes", label: "Minutos" },
  { key: "name", label: "A–Z" },
];

type Props = {
  players: PlayerProfile[];
  selectedId: string;
  profilesFilter: string[];
  onSelect: (id: string) => void;
  onToggleProfile: (profile: string) => void;
  profilesAvailable: string[];
};

export function RosterRail({
  players,
  selectedId,
  profilesFilter,
  onSelect,
  onToggleProfile,
  profilesAvailable,
}: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("rating");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = players.filter((player) => {
      if (profilesFilter.length && !profilesFilter.includes(player.profile)) return false;
      if (!q) return true;
      return player.name.toLowerCase().includes(q) || player.club.toLowerCase().includes(q);
    });
    return sortPlayers(filtered, sort);
  }, [players, profilesFilter, query, sort]);

  return (
    <aside className="roster">
      <div className="roster-inner">
        <div className="roster-search">
          <svg viewBox="0 0 16 16" aria-hidden>
            <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.6 10.6 3.2 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar atleta ou clube"
            aria-label="Buscar atleta ou clube"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca">
              ×
            </button>
          )}
        </div>

        <div className="roster-sort" role="group" aria-label="Ordenar lista">
          {SORTS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={sort === option.key ? "active" : ""}
              onClick={() => setSort(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="roster-filters">
          {profilesAvailable.map((profile) => (
            <button
              key={profile}
              type="button"
              className={`filter-chip profile-${profileTone(profile)} ${
                profilesFilter.includes(profile) ? "active" : ""
              }`}
              onClick={() => onToggleProfile(profile)}
              aria-pressed={profilesFilter.includes(profile)}
            >
              {profile}
            </button>
          ))}
        </div>

        <p className="roster-count">
          <strong>{visible.length}</strong> de {players.length} atletas
        </p>

        <div className="roster-list">
          {visible.map((player, index) => {
            const token = ratingTier(player.rating);
            const active = player.player_id === selectedId;

            return (
              <button
                key={player.player_id}
                type="button"
                className={`roster-item ${active ? "active" : ""}`}
                style={tierVars(token)}
                onClick={() => onSelect(player.player_id)}
                aria-current={active}
              >
                <span className="roster-pos">{index + 1}</span>

                <span className="roster-avatar">
                  {player.transfermarkt?.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={player.transfermarkt.photo} alt="" loading="lazy" />
                  ) : (
                    playerInitials(player.name)
                  )}
                </span>

                <span className="roster-info">
                  <strong>{player.name}</strong>
                  <em>
                    {player.club} · {player.profile}
                    {player.hybrid_lean ? ` ${player.hybrid_lean}` : ""}
                  </em>
                </span>

                <span className="roster-rating">{formatRating(player.rating)}</span>
              </button>
            );
          })}

          {visible.length === 0 && <p className="roster-empty">Nenhum atleta encontrado.</p>}
        </div>
      </div>
    </aside>
  );
}
