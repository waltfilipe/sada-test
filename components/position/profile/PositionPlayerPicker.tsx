"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClubLogo } from "@/components/ClubLogo";
import type { StatLetterFilters } from "@/lib/playerStatFilters";
import { playerMatchesStatLetterFilters } from "@/lib/playerStatFilters";
import { playerInitials } from "@/lib/scoutTheme";
import { sortPlayers } from "@/lib/scoutUi";
import { playerMatchesClusterFilter } from "../ArchetypeMixCard";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  players: PlayerProfile[];
  family: PositionFamily;
  selectedId: string;
  onSelect: (id: string) => void;
  clusterMode?: boolean;
  clusterFilters?: string[];
  profilesFilter?: string[];
  statLetterFilters?: StatLetterFilters;
};

export function PositionPlayerPicker({
  players,
  family,
  selectedId,
  onSelect,
  clusterMode = false,
  clusterFilters = [],
  profilesFilter = [],
  statLetterFilters = {},
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = players.filter((player) => {
      if (clusterMode) {
        if (!playerMatchesClusterFilter(player, clusterFilters)) return false;
      } else if (profilesFilter.length && !profilesFilter.includes(player.profile)) {
        return false;
      }
      if (!playerMatchesStatLetterFilters(player, family, statLetterFilters)) {
        return false;
      }
      if (!q) return true;
      return player.name.toLowerCase().includes(q) || player.club.toLowerCase().includes(q);
    });
    return sortPlayers(filtered, "name");
  }, [
    players,
    family,
    clusterMode,
    clusterFilters,
    profilesFilter,
    statLetterFilters,
    query,
  ]);

  const selected = players.find((p) => p.player_id === selectedId) ?? visible[0] ?? null;
  const showSuggestions = open && query.trim().length > 0;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, visible.length]);

  function pick(player: PlayerProfile) {
    onSelect(player.player_id);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || !visible.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && visible[activeIndex]) {
      e.preventDefault();
      pick(visible[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="profile-top-picker" ref={rootRef}>
      <div className="profile-top-picker-search">
        <label className="filter-label filter-label-compact" htmlFor="player-search">
          Buscar
        </label>
        <input
          ref={inputRef}
          id="player-search"
          type="search"
          className="player-search-input player-search-input-compact"
          placeholder="Nome do atleta…"
          value={query}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />

        {showSuggestions ? (
          <ul className="position-player-suggestions position-player-suggestions-compact" role="listbox">
            {visible.length ? (
              visible.slice(0, 10).map((player, index) => (
                <li key={player.player_id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={index === activeIndex ? "active" : ""}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => pick(player)}
                  >
                    <PlayerOptionRow player={player} />
                  </button>
                </li>
              ))
            ) : (
              <li className="position-player-suggestion-empty">Nenhum atleta encontrado.</li>
            )}
          </ul>
        ) : null}
      </div>

      <div className="profile-top-picker-current">
        <label className="filter-label filter-label-compact">Atleta</label>
        <button
          type="button"
          className="position-player-trigger position-player-trigger-compact"
          aria-expanded={open && !query.trim()}
          onClick={() => {
            setOpen((v) => !v);
            inputRef.current?.focus();
          }}
        >
          {selected ? <PlayerOptionRow player={selected} selected /> : "Selecionar…"}
          <span className="position-player-chevron" aria-hidden>
            ▾
          </span>
        </button>

        {open && !query.trim() ? (
          <ul className="position-player-menu position-player-menu-compact" role="listbox">
            {visible.map((player) => (
              <li key={player.player_id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={player.player_id === selectedId}
                  className={player.player_id === selectedId ? "active" : ""}
                  onClick={() => pick(player)}
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
    <span className={`position-player-option position-player-option-inline position-player-option-compact${selected ? " is-selected" : ""}`}>
      <span className="position-player-photo position-player-photo-compact">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" />
        ) : (
          <span>{playerInitials(player.name)}</span>
        )}
      </span>
      <span className="position-player-name">{player.name}</span>
      <ClubLogo club={player.club} size={14} />
      <span className="position-player-club">{player.club}</span>
    </span>
  );
}
