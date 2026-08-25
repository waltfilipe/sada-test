"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ClubLogo } from "@/components/ClubLogo";
import { formatRating, playerInitials } from "@/lib/scoutTheme";
import { sortPlayers } from "@/lib/scoutUi";
import { playerMatchesClusterFilter } from "../ArchetypeMixCard";
import type { PlayerProfile } from "@/lib/types";

type Props = {
  players: PlayerProfile[];
  selectedId: string;
  onSelect: (id: string) => void;
  clusterMode?: boolean;
  clusterFilters?: string[];
  profilesFilter?: string[];
};

export function PositionPlayerPicker({
  players,
  selectedId,
  onSelect,
  clusterMode = false,
  clusterFilters = [],
  profilesFilter = [],
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = players.filter((player) => {
      if (clusterMode) {
        if (!playerMatchesClusterFilter(player, clusterFilters)) return false;
      } else if (profilesFilter.length && !profilesFilter.includes(player.profile)) {
        return false;
      }
      if (!q) return true;
      return player.name.toLowerCase().includes(q) || player.club.toLowerCase().includes(q);
    });
    return sortPlayers(filtered, "rating");
  }, [players, clusterMode, clusterFilters, profilesFilter, query]);

  const selected = players.find((p) => p.player_id === selectedId) ?? visible[0] ?? null;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (visible[0]) onSelect(visible[0].player_id);
  }

  return (
    <div className="player-search-row position-player-picker" ref={rootRef}>
      <form className="player-search-form" onSubmit={onSearchSubmit}>
        <label className="filter-label" htmlFor="player-search">
          Buscar atleta
        </label>
        <div className="player-search-input-wrap">
          <input
            id="player-search"
            type="search"
            className="player-search-input"
            placeholder="Nome ou clube…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </form>

      <div className="player-select-field position-player-select-wrap">
        <label className="filter-label">Atleta</label>
        <button
          type="button"
          className="position-player-trigger"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {selected ? <PlayerOptionRow player={selected} selected /> : "Selecionar…"}
          <span className="position-player-chevron" aria-hidden>
            ▾
          </span>
        </button>

        {open ? (
          <ul className="position-player-menu" role="listbox">
            {visible.map((player) => (
              <li key={player.player_id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={player.player_id === selectedId}
                  className={player.player_id === selectedId ? "active" : ""}
                  onClick={() => {
                    onSelect(player.player_id);
                    setOpen(false);
                  }}
                >
                  <PlayerOptionRow player={player} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function PlayerOptionRow({ player, selected = false }: { player: PlayerProfile; selected?: boolean }) {
  const photo = player.transfermarkt?.photo;
  return (
    <span className={`position-player-option${selected ? " is-selected" : ""}`}>
      <span className="position-player-photo">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" />
        ) : (
          <span>{playerInitials(player.name)}</span>
        )}
      </span>
      <span className="position-player-copy">
        <span className="position-player-name">{player.name}</span>
        <span className="position-player-meta">
          <strong className="tabular">({formatRating(player.ratings.geral ?? player.rating)})</strong>
          <span> — </span>
          <ClubLogo club={player.club} size={14} />
          {player.club}
        </span>
      </span>
    </span>
  );
}
