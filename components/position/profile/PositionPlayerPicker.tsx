"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClubLogo } from "@/components/ClubLogo";
import { LAT_ARCHETYPE_META, ZAG_ARCHETYPE_META, latArchetypeTone, archetypeTone } from "@/lib/clusterMeta";
import { profileAccent } from "@/lib/profileShares";
import { formatRating, playerInitials, ratingTier, tierVars } from "@/lib/scoutTheme";
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
  const trackRef = useRef<HTMLDivElement>(null);

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

  // Keep the selected card in view when the selection changes.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>(`[data-player-id="${selectedId}"]`);
    card?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [selectedId]);

  function scrollTrack(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: "smooth" });
  }

  function toggleClub(club: string) {
    setClubFilter((current) =>
      current.includes(club) ? current.filter((item) => item !== club) : [...current, club],
    );
  }

  const archetypeFilters =
    family === "laterais" ? LAT_ARCHETYPE_META : family === "zagueiros" ? ZAG_ARCHETYPE_META : null;

  return (
    <div className="player-strip player-card">
      <div className="player-strip-head">
        <div className="player-strip-title-wrap">
          <h3 className="profile-filter-panel-title">Atletas</h3>
          <span className="player-strip-count tabular">{visible.length}</span>

          {clusterMode && archetypeFilters ? (
            <div className="player-strip-profile-chips">
              {archetypeFilters.map((item) => {
                const tone =
                  family === "laterais"
                    ? latArchetypeTone(item.archetype as "Defensivo" | "Construtor" | "Ofensivo" | "Híbrido")
                    : archetypeTone(item.archetype as "Defensor de Área" | "Construtor" | "Combativo");
                const active = clusterFilters.includes(item.archetype);
                const accent = profileAccent(item.archetype);
                return (
                  <button
                    key={item.archetype}
                    type="button"
                    className={`profile-filter-chip profile-filter-chip-profile cluster-${tone}${active ? " active" : ""}`}
                    style={{ "--chip-accent": accent } as React.CSSProperties}
                    onClick={() => onToggleClusterFilter?.(item.archetype)}
                    aria-pressed={active}
                  >
                    {item.archetype}
                  </button>
                );
              })}
            </div>
          ) : profilesAvailable.length ? (
            <div className="player-strip-profile-chips">
              {profilesAvailable.map((profile) => {
                const active = profilesFilter.includes(profile);
                const accent = profileAccent(profile);
                return (
                  <button
                    key={profile}
                    type="button"
                    className={`profile-filter-chip profile-filter-chip-profile${active ? " active" : ""}`}
                    style={{ "--chip-accent": accent } as React.CSSProperties}
                    onClick={() => onToggleProfile?.(profile)}
                    aria-pressed={active}
                  >
                    {profile}
                  </button>
                );
              })}
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
          className="player-strip-arrow player-strip-arrow-left"
          aria-label="Atletas anteriores"
          onClick={() => scrollTrack(-1)}
        >
          ‹
        </button>

        <div className="player-strip-track" ref={trackRef}>
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

        <button
          type="button"
          className="player-strip-arrow player-strip-arrow-right"
          aria-label="Próximos atletas"
          onClick={() => scrollTrack(1)}
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
  const tier = ratingTier(player.rating);

  return (
    <button
      type="button"
      data-player-id={player.player_id}
      className={`player-strip-card${selected ? " selected" : ""}`}
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
        <span className="player-strip-card-rating tabular" style={tierVars(tier)}>
          {formatRating(player.rating)}
        </span>
      </span>
      <span className="player-strip-card-copy">
        <span className="player-strip-card-name">{player.name}</span>
        <span className="player-strip-card-club">
          <ClubLogo club={player.club} size={13} />
          <span>{player.club}</span>
        </span>
      </span>
    </button>
  );
}
