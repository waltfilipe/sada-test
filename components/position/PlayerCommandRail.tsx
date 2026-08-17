"use client";

import { useMemo, useState } from "react";
import { formatRating, ratingColor } from "@/lib/positions";
import { profileTone, sortPlayers } from "@/lib/scoutUi";
import type { PlayerProfile } from "@/lib/types";

type Props = {
  players: PlayerProfile[];
  selectedId: string;
  profilesFilter: string[];
  onSelect: (id: string) => void;
  onToggleProfile: (profile: string) => void;
  profilesAvailable: string[];
};

export function PlayerCommandRail({
  players,
  selectedId,
  profilesFilter,
  onSelect,
  onToggleProfile,
  profilesAvailable,
}: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"rating" | "name" | "minutes">("rating");

  const visible = useMemo(() => {
    const filtered = players.filter((player) => {
      if (profilesFilter.length && !profilesFilter.includes(player.profile) && player.profile !== "Híbrido") {
        return false;
      }
      if (!query) return true;
      const q = query.toLowerCase();
      return player.name.toLowerCase().includes(q) || player.club.toLowerCase().includes(q);
    });
    return sortPlayers(filtered, sort);
  }, [players, profilesFilter, query, sort]);

  return (
    <aside className="scout-rail">
      <div className="scout-rail-sticky">
        <header>
          <p className="scout-kicker">Explorar atletas</p>
          <h2>Jogadores</h2>
        </header>

        <label className="scout-search">
          <span>Buscar jogador ou clube</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: Robert Renan, Vasco..."
          />
        </label>

        <label className="scout-search">
          <span>Ordenar por</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="rating">Rating</option>
            <option value="minutes">Minutagem</option>
            <option value="name">Nome</option>
          </select>
        </label>

        <div className="profile-filter-chips">
          <span>Filtrar perfil</span>
          <div>
            {profilesAvailable.map((profile) => (
              <button
                key={profile}
                type="button"
                className={`chip-filter ${profilesFilter.includes(profile) ? "active" : ""} profile-${profileTone(profile)}`}
                onClick={() => onToggleProfile(profile)}
              >
                {profile}
              </button>
            ))}
          </div>
        </div>

        <p className="rail-count">{visible.length} jogadores</p>

        <div className="rail-list">
          {visible.map((player, index) => (
            <button
              key={player.player_id}
              type="button"
              className={`rail-item ${selectedId === player.player_id ? "active" : ""}`}
              onClick={() => onSelect(player.player_id)}
            >
              <span className="rail-rank">#{index + 1}</span>
              <span className="rail-body">
                <strong>{player.name}</strong>
                <em>
                  {player.club} · {player.profile}
                </em>
              </span>
              <span className="rail-rating" style={{ color: ratingColor(player.rating) }}>
                {formatRating(player.rating)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
