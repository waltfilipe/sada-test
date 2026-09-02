"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClubLogo } from "@/components/ClubLogo";
import { EX_ARCHETYPE_META, LAT_ARCHETYPE_META, MC_ARCHETYPE_META, ZAG_ARCHETYPE_META } from "@/lib/clusterMeta";
import { formatRating, playerInitials } from "@/lib/scoutTheme";
import { playerMatchesClusterFilter } from "../ArchetypeMixCard";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type SortKey = "rating" | "minutes";

type Props = {
  players: PlayerProfile[];
  family: PositionFamily;
  selectedId: string;
  onSelect: (id: string) => void;
  clusterMode?: boolean;
  clusterFilters?: string[];
  profilesFilter?: string[];
  onToggleClusterFilter?: (key: string) => void;
  onToggleProfile?: (profile: string) => void;
  profilesAvailable?: string[];
};

export function PositionPlayerPicker({
  players,
  family,
  selectedId,
  onSelect,
  clusterMode = false,
  clusterFilters = [],
  profilesFilter = [],
  onToggleClusterFilter,
  onToggleProfile,
  profilesAvailable = [],
}: Props) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [clubFilter, setClubFilter] = useState<string[]>([]);
  const [clubMenuOpen, setClubMenuOpen] = useState(false);
  const clubMenuRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const clubs = useMemo(
    () => [...new Set(players.map((p) => p.club))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [players],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = players.filter((player) => {
      if (clusterMode) {
        if (!playerMatchesClusterFilter(player, clusterFilters)) return false;
      } else if (profilesFilter.length && !profilesFilter.includes(player.profile)) {
        return false;
      }
      if (clubFilter.length && !clubFilter.includes(player.club)) return false;
      if (!q) return true;
      return player.name.toLowerCase().includes(q) || player.club.toLowerCase().includes(q);
    });
    return [...filtered].sort((a, b) =>
      sortKey === "minutes" ? b.minutes - a.minutes : b.rating - a.rating,
    );
  }, [players, clusterMode, clusterFilters, profilesFilter, clubFilter, sortKey, query]);

  useEffect(() => {
    if (!clubMenuOpen) return;
    function onDocClick(event: MouseEvent) {
      if (!clubMenuRef.current?.contains(event.target as Node)) setClubMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setClubMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [clubMenuOpen]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const card = grid.querySelector<HTMLElement>(`[data-player-id="${selectedId}"]`);
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedId]);

  function toggleClub(club: string) {
    setClubFilter((current) =>
      current.includes(club) ? current.filter((item) => item !== club) : [...current, club],
    );
  }

  function scrollStrip(direction: -1 | 1) {
    const grid = gridRef.current;
    if (!grid) return;
    const step = Math.max(240, Math.round(grid.clientWidth * 0.72));
    grid.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  const archetypeFilters =
    family === "laterais"
      ? LAT_ARCHETYPE_META
      : family === "meio-campistas"
        ? MC_ARCHETYPE_META
        : family === "extremos"
          ? EX_ARCHETYPE_META
          : family === "zagueiros"
            ? ZAG_ARCHETYPE_META
            : null;

  return (
    <div className="player-strip player-card player-strip-expanded">
      <div className="player-strip-toolbar">
        <div className="player-strip-toolbar-main">
          <div className="player-strip-title-wrap">
            <h3 className="profile-filter-panel-title">Atletas</h3>
            <span className="player-strip-count tabular">{visible.length}</span>
          </div>

          {clusterMode && archetypeFilters ? (
            <div className="player-strip-filter-row">
              <span className="player-strip-filter-label">Perfil</span>
              <div className="player-strip-profile-chips">
                {archetypeFilters.map((item) => {
                  const active = clusterFilters.includes(item.archetype);
                  return (
                    <button
                      key={item.archetype}
                      type="button"
                      className={`profile-filter-chip profile-filter-chip-neutral${active ? " active" : ""}`}
                      onClick={() => onToggleClusterFilter?.(item.archetype)}
                      aria-pressed={active}
                    >
                      {item.archetype}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : profilesAvailable.length ? (
            <div className="player-strip-filter-row">
              <span className="player-strip-filter-label">Perfil</span>
              <div className="player-strip-profile-chips">
                {profilesAvailable.map((profile) => {
                  const active = profilesFilter.includes(profile);
                  return (
                    <button
                      key={profile}
                      type="button"
                      className={`profile-filter-chip profile-filter-chip-neutral${active ? " active" : ""}`}
                      onClick={() => onToggleProfile?.(profile)}
                      aria-pressed={active}
                    >
                      {profile}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="player-strip-controls">
          <div className="player-strip-sort" role="group" aria-label="Ordenar atletas">
            <span className="player-strip-sort-label">Ordenar</span>
            <button
              type="button"
              className={`player-strip-sort-chip${sortKey === "rating" ? " active" : ""}`}
              onClick={() => setSortKey("rating")}
              aria-pressed={sortKey === "rating"}
            >
              Rating
            </button>
            <button
              type="button"
              className={`player-strip-sort-chip${sortKey === "minutes" ? " active" : ""}`}
              onClick={() => setSortKey("minutes")}
              aria-pressed={sortKey === "minutes"}
            >
              Minutos
            </button>
          </div>

          <div className="player-strip-club" ref={clubMenuRef}>
            <button
              type="button"
              className={`player-strip-sort-chip player-strip-club-trigger${clubFilter.length ? " active" : ""}`}
              onClick={() => setClubMenuOpen((value) => !value)}
              aria-expanded={clubMenuOpen}
              aria-haspopup="listbox"
            >
              Clube{clubFilter.length ? ` · ${clubFilter.length}` : ""}
              <i className="fa-solid fa-chevron-down" aria-hidden="true" />
            </button>
            {clubMenuOpen ? (
              <div className="player-strip-club-menu" role="listbox" aria-multiselectable="true">
                {clubFilter.length ? (
                  <button
                    type="button"
                    className="player-strip-club-clear"
                    onClick={() => setClubFilter([])}
                  >
                    <i className="fa-solid fa-xmark" aria-hidden="true" /> Limpar seleção
                  </button>
                ) : null}
                <ul>
                  {clubs.map((club) => {
                    const active = clubFilter.includes(club);
                    return (
                      <li key={club}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={active ? "active" : ""}
                          onClick={() => toggleClub(club)}
                        >
                          <span className="player-strip-club-check" aria-hidden="true">
                            {active ? <i className="fa-solid fa-check" /> : null}
                          </span>
                          <ClubLogo club={club} size={14} />
                          {club}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>

          <input
            type="search"
            className="player-strip-search"
            placeholder="Buscar atleta…"
            value={query}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar atleta"
          />
        </div>
      </div>

      <div className="player-strip-body">
        <button
          type="button"
          className="player-strip-arrow"
          onClick={() => scrollStrip(-1)}
          aria-label="Atletas anteriores"
        >
          ‹
        </button>
        <div className="player-strip-grid-wrap">
          <div className="player-strip-grid" ref={gridRef}>
            {visible.length ? (
              visible.map((player) => (
                <PlayerStripCard
                  key={player.player_id}
                  player={player}
                  selected={player.player_id === selectedId}
                  onSelect={() => onSelect(player.player_id)}
                />
              ))
            ) : (
              <p className="player-strip-empty">Nenhum atleta encontrado com os filtros atuais.</p>
            )}
          </div>
        </div>
        <button
          type="button"
          className="player-strip-arrow"
          onClick={() => scrollStrip(1)}
          aria-label="Próximos atletas"
        >
          ›
        </button>
      </div>
    </div>
  );
}

function PlayerStripCard({
  player,
  selected,
  onSelect,
}: {
  player: PlayerProfile;
  selected: boolean;
  onSelect: () => void;
}) {
  const photo = player.transfermarkt?.photo;

  return (
    <button
      type="button"
      data-player-id={player.player_id}
      className={`player-strip-card player-strip-card-lg${selected ? " selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="player-strip-card-media">
        <span className="player-strip-card-photo">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" loading="lazy" />
          ) : (
            <span>{playerInitials(player.name)}</span>
          )}
        </span>
      </span>
      <span className="player-strip-card-copy">
        <span className="player-strip-card-name">{player.name}</span>
        <span className="player-strip-card-club">
          <ClubLogo club={player.club} size={14} />
          <span>{player.club}</span>
        </span>
      </span>
    </button>
  );
}
