"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClubLogo } from "@/components/ClubLogo";
import { AT_ARCHETYPE_META, EX_ARCHETYPE_META, LAT_ARCHETYPE_META, MC_ARCHETYPE_META, ZAG_ARCHETYPE_META } from "@/lib/clusterMeta";
import { gradeTier, playerInitials, profileGradeFromRank, tierVars } from "@/lib/scoutTheme";
import { positionRating } from "@/lib/scoutUi";
import { archetypeRank, sortedProfileShareRows } from "@/lib/profileShares";
import { playerMatchesClusterFilter } from "../ArchetypeMixCard";
import { PickerFilterMenu, type FilterOption } from "./PickerFilterMenu";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

const CURRENT_YEAR = new Date().getFullYear();

type SortKey = "rating" | "minutes" | "age" | "value" | "name";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "rating", label: "Rating" },
  { key: "minutes", label: "Minutos" },
  { key: "age", label: "Mais jovem" },
  { key: "value", label: "Valor" },
  { key: "name", label: "Nome" },
];

const AGE_BANDS: { value: string; label: string; min: number; max: number }[] = [
  { value: "u21", label: "Até 21 anos", min: 0, max: 21 },
  { value: "22-25", label: "22 a 25 anos", min: 22, max: 25 },
  { value: "26-29", label: "26 a 29 anos", min: 26, max: 29 },
  { value: "30+", label: "30 anos ou mais", min: 30, max: 200 },
];

const MINUTES_BANDS: { value: string; label: string; min: number }[] = [
  { value: "600", label: "600+ minutos", min: 600 },
  { value: "900", label: "900+ minutos", min: 900 },
  { value: "1200", label: "1.200+ minutos", min: 1200 },
  { value: "1500", label: "1.500+ minutos", min: 1500 },
];

/** Grade floors reuse the A+ → D scale shown in the Perfil card. */
const GRADE_BANDS: { value: string; label: string; allowed: string[] }[] = [
  { value: "a", label: "A- ou melhor", allowed: ["A+", "A", "A-"] },
  { value: "b", label: "B- ou melhor", allowed: ["A+", "A", "A-", "B+", "B", "B-"] },
  { value: "c", label: "C- ou melhor", allowed: ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"] },
];

const ORIGIN_OPTIONS: FilterOption[] = [
  { value: "br", label: "Brasileiros" },
  { value: "out", label: "Estrangeiros" },
];

const POSITION_SHORT: Record<string, string> = {
  Zagueiro: "ZAG",
  "Lateral Esquerdo": "LE",
  "Lateral Direito": "LD",
  "Meio-campista": "MC",
  "Extremo Esquerdo": "EE",
  "Extremo Direito": "ED",
  "Meia Ofensivo": "MO",
  Atacante: "ATA",
};

function positionShort(position: string): string {
  return POSITION_SHORT[position] ?? position.slice(0, 3).toUpperCase();
}

function playerAge(player: PlayerProfile): number | null {
  return player.birth_year ? CURRENT_YEAR - player.birth_year : null;
}

function hasKnownFoot(foot: string | null | undefined): foot is string {
  if (!foot) return false;
  const normalized = foot.trim().toLowerCase();
  return normalized !== "unknown" && normalized !== "nan" && normalized !== "";
}

function formatMarketValue(value: number | null | undefined): string | null {
  if (!value) return null;
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `€ ${millions.toFixed(millions >= 10 ? 0 : 1).replace(".", ",")} mi`;
  }
  return `€ ${Math.round(value / 1000)} mil`;
}

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
  const [positionFilter, setPositionFilter] = useState<string[]>([]);
  const [footFilter, setFootFilter] = useState<string[]>([]);
  const [ageFilter, setAgeFilter] = useState<string[]>([]);
  const [minutesFilter, setMinutesFilter] = useState<string[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string[]>([]);
  const [originFilter, setOriginFilter] = useState<string[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);

  /**
   * Grade of the athlete's dominant archetype, ranked inside that archetype, so
   * the badge matches the top row of the Perfil card.
   */
  const gradeById = useMemo(() => {
    const map = new Map<string, { grade: string; label: string }>();
    for (const player of players) {
      const label = sortedProfileShareRows(player)[0]?.label;
      if (!label) continue;
      const rank = archetypeRank(player, players, label, family);
      const grade = rank ? profileGradeFromRank(rank, players.length) : null;
      if (grade) map.set(player.player_id, { grade, label });
    }
    return map;
  }, [players, family]);

  const clubOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const player of players) counts.set(player.club, (counts.get(player.club) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([club, count]) => ({ value: club, label: club, club, count }));
  }, [players]);

  const positionOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const player of players) counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
    if (counts.size < 2) return [];
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([position, count]) => ({ value: position, label: position, count }));
  }, [players]);

  const footOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const player of players) {
      if (!hasKnownFoot(player.foot)) continue;
      counts.set(player.foot, (counts.get(player.foot) ?? 0) + 1);
    }
    if (counts.size < 2) return [];
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([foot, count]) => ({ value: foot, label: foot, count }));
  }, [players]);

  const ageOptions = useMemo<FilterOption[]>(() => {
    return AGE_BANDS.map((band) => ({
      value: band.value,
      label: band.label,
      count: players.filter((player) => {
        const age = playerAge(player);
        return age != null && age >= band.min && age <= band.max;
      }).length,
    })).filter((option) => (option.count ?? 0) > 0);
  }, [players]);

  const activeFilterCount =
    clubFilter.length +
    positionFilter.length +
    footFilter.length +
    ageFilter.length +
    minutesFilter.length +
    gradeFilter.length +
    originFilter.length +
    (clusterMode ? clusterFilters.length : profilesFilter.length) +
    (query.trim() ? 1 : 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minMinutes = minutesFilter.length
      ? Math.min(...minutesFilter.map((value) => Number(value)))
      : 0;
      const allowedGrades = gradeFilter.length
        ? new Set(
          gradeFilter.flatMap(
            (value) => GRADE_BANDS.find((band) => band.value === value)?.allowed ?? [],
          ),
        )
      : null;

    const filtered = players.filter((player) => {
      if (clusterMode) {
        if (!playerMatchesClusterFilter(player, clusterFilters)) return false;
      } else if (profilesFilter.length && !profilesFilter.includes(player.profile)) {
        return false;
      }
      if (clubFilter.length && !clubFilter.includes(player.club)) return false;
      if (positionFilter.length && !positionFilter.includes(player.position)) return false;
      if (footFilter.length && !(hasKnownFoot(player.foot) && footFilter.includes(player.foot))) {
        return false;
      }
      if (ageFilter.length) {
        const age = playerAge(player);
        const inBand = ageFilter.some((value) => {
          const band = AGE_BANDS.find((item) => item.value === value);
          return band && age != null && age >= band.min && age <= band.max;
        });
        if (!inBand) return false;
      }
      if (minMinutes && player.minutes < minMinutes) return false;
      if (allowedGrades) {
        const grade = gradeById.get(player.player_id)?.grade;
        if (!grade || !allowedGrades.has(grade)) return false;
      }
      if (originFilter.length) {
        const isBrazilian = player.nationality === "Brazil";
        const matches = originFilter.some((value) =>
          value === "br" ? isBrazilian : !isBrazilian,
        );
        if (!matches) return false;
      }
      if (!q) return true;
      return player.name.toLowerCase().includes(q) || player.club.toLowerCase().includes(q);
    });

    return [...filtered].sort((a, b) => {
      if (sortKey === "minutes") return b.minutes - a.minutes;
      if (sortKey === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (sortKey === "age") return (b.birth_year ?? 0) - (a.birth_year ?? 0);
      if (sortKey === "value") {
        return (
          (b.transfermarkt?.market_value_eur ?? 0) - (a.transfermarkt?.market_value_eur ?? 0)
        );
      }
      return positionRating(b) - positionRating(a);
    });
  }, [
    players,
    clusterMode,
    clusterFilters,
    profilesFilter,
    clubFilter,
    positionFilter,
    footFilter,
    ageFilter,
    minutesFilter,
    gradeFilter,
    originFilter,
    gradeById,
    sortKey,
    query,
  ]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const card = grid.querySelector<HTMLElement>(`[data-player-id="${selectedId}"]`);
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedId]);

  function toggleIn(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
    single = false,
  ) {
    setter((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      return single ? [value] : [...current, value];
    });
  }

  function clearAll() {
    setQuery("");
    setClubFilter([]);
    setPositionFilter([]);
    setFootFilter([]);
    setAgeFilter([]);
    setMinutesFilter([]);
    setGradeFilter([]);
    setOriginFilter([]);
    if (clusterMode) {
      clusterFilters.forEach((key) => onToggleClusterFilter?.(key));
    } else {
      profilesFilter.forEach((profile) => onToggleProfile?.(profile));
    }
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
          : family === "atacantes"
            ? AT_ARCHETYPE_META
            : family === "zagueiros"
              ? ZAG_ARCHETYPE_META
              : null;

  const profileChips = clusterMode && archetypeFilters
    ? archetypeFilters.map((item) => ({
        key: item.archetype,
        active: clusterFilters.includes(item.archetype),
        onToggle: () => onToggleClusterFilter?.(item.archetype),
      }))
    : profilesAvailable.map((profile) => ({
        key: profile,
        active: profilesFilter.includes(profile),
        onToggle: () => onToggleProfile?.(profile),
      }));

  const activePills: { key: string; label: string; onRemove: () => void }[] = [
    ...profileChips
      .filter((chip) => chip.active)
      .map((chip) => ({ key: `perfil-${chip.key}`, label: chip.key, onRemove: chip.onToggle })),
    ...positionFilter.map((value) => ({
      key: `pos-${value}`,
      label: value,
      onRemove: () => toggleIn(setPositionFilter, value),
    })),
    ...footFilter.map((value) => ({
      key: `foot-${value}`,
      label: `Pé ${value.toLowerCase()}`,
      onRemove: () => toggleIn(setFootFilter, value),
    })),
    ...ageFilter.map((value) => ({
      key: `age-${value}`,
      label: AGE_BANDS.find((band) => band.value === value)?.label ?? value,
      onRemove: () => toggleIn(setAgeFilter, value),
    })),
    ...minutesFilter.map((value) => ({
      key: `min-${value}`,
      label: MINUTES_BANDS.find((band) => band.value === value)?.label ?? value,
      onRemove: () => toggleIn(setMinutesFilter, value),
    })),
    ...gradeFilter.map((value) => ({
      key: `grade-${value}`,
      label: GRADE_BANDS.find((band) => band.value === value)?.label ?? value,
      onRemove: () => toggleIn(setGradeFilter, value),
    })),
    ...originFilter.map((value) => ({
      key: `origin-${value}`,
      label: ORIGIN_OPTIONS.find((option) => option.value === value)?.label ?? value,
      onRemove: () => toggleIn(setOriginFilter, value),
    })),
    ...clubFilter.map((value) => ({
      key: `club-${value}`,
      label: value,
      onRemove: () => toggleIn(setClubFilter, value),
    })),
  ];

  return (
    <div className="player-strip player-card player-strip-expanded">
      <header className="picker-head">
        <div className="picker-head-title">
          <h3 className="picker-title">Atletas</h3>
          <span className="picker-count tabular">
            <strong>{visible.length}</strong> de {players.length}
          </span>
        </div>

        <div className="picker-head-actions">
          <div className="picker-search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar atleta ou clube…"
              value={query}
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Buscar atleta"
            />
          </div>
          <button
            type="button"
            className="picker-reset"
            onClick={clearAll}
            disabled={!activeFilterCount}
          >
            <i className="fa-solid fa-rotate-left" aria-hidden="true" />
            Limpar
          </button>
        </div>
      </header>

      <div className="picker-toolbar">
        {profileChips.length ? (
          <div className="picker-group">
            <span className="picker-group-label">Perfil</span>
            <div className="picker-group-chips">
              {profileChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`picker-chip${chip.active ? " active" : ""}`}
                  onClick={chip.onToggle}
                  aria-pressed={chip.active}
                >
                  {chip.key}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="picker-group">
          <span className="picker-group-label">Filtros</span>
          <div className="picker-group-chips">
            {positionOptions.length ? (
              <PickerFilterMenu
                label="Posição"
                icon="fa-location-crosshairs"
                options={positionOptions}
                selected={positionFilter}
                onToggle={(value) => toggleIn(setPositionFilter, value)}
                onClear={() => setPositionFilter([])}
              />
            ) : null}
            <PickerFilterMenu
              label="Classificação"
              icon="fa-award"
              options={GRADE_BANDS.map((band) => ({ value: band.value, label: band.label }))}
              selected={gradeFilter}
              onToggle={(value) => toggleIn(setGradeFilter, value, true)}
              onClear={() => setGradeFilter([])}
              single
            />
            <PickerFilterMenu
              label="Idade"
              icon="fa-cake-candles"
              options={ageOptions}
              selected={ageFilter}
              onToggle={(value) => toggleIn(setAgeFilter, value)}
              onClear={() => setAgeFilter([])}
            />
            <PickerFilterMenu
              label="Minutagem"
              icon="fa-stopwatch"
              options={MINUTES_BANDS.map((band) => ({ value: band.value, label: band.label }))}
              selected={minutesFilter}
              onToggle={(value) => toggleIn(setMinutesFilter, value, true)}
              onClear={() => setMinutesFilter([])}
              single
            />
            {footOptions.length ? (
              <PickerFilterMenu
                label="Pé"
                icon="fa-shoe-prints"
                options={footOptions}
                selected={footFilter}
                onToggle={(value) => toggleIn(setFootFilter, value)}
                onClear={() => setFootFilter([])}
              />
            ) : null}
            <PickerFilterMenu
              label="Origem"
              icon="fa-globe"
              options={ORIGIN_OPTIONS}
              selected={originFilter}
              onToggle={(value) => toggleIn(setOriginFilter, value, true)}
              onClear={() => setOriginFilter([])}
              single
            />
            <PickerFilterMenu
              label="Clube"
              icon="fa-shield-halved"
              options={clubOptions}
              selected={clubFilter}
              onToggle={(value) => toggleIn(setClubFilter, value)}
              onClear={() => setClubFilter([])}
              align="right"
            />
          </div>
        </div>

        <div className="picker-group">
          <span className="picker-group-label">Ordenar</span>
          <div className="picker-sort" role="group" aria-label="Ordenar atletas">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`picker-sort-chip${sortKey === option.key ? " active" : ""}`}
                onClick={() => setSortKey(option.key)}
                aria-pressed={sortKey === option.key}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activePills.length ? (
        <div className="picker-active" aria-label="Filtros ativos">
          {activePills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              className="picker-active-pill"
              onClick={pill.onRemove}
              aria-label={`Remover filtro ${pill.label}`}
            >
              {pill.label}
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="player-strip-body">
        <button
          type="button"
          className="player-strip-arrow"
          onClick={() => scrollStrip(-1)}
          aria-label="Atletas anteriores"
        >
          <i className="fa-solid fa-chevron-left" aria-hidden="true" />
        </button>
        <div className="player-strip-grid-wrap">
          <div className="player-strip-grid" ref={gridRef}>
            {visible.length ? (
              visible.map((player) => (
                <PlayerStripCard
                  key={player.player_id}
                  player={player}
                  grade={gradeById.get(player.player_id) ?? null}
                  selected={player.player_id === selectedId}
                  onSelect={() => onSelect(player.player_id)}
                />
              ))
            ) : (
              <div className="player-strip-empty">
                <i className="fa-solid fa-user-slash" aria-hidden="true" />
                <p>Nenhum atleta encontrado com os filtros atuais.</p>
                <button type="button" className="picker-reset" onClick={clearAll}>
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          className="player-strip-arrow"
          onClick={() => scrollStrip(1)}
          aria-label="Próximos atletas"
        >
          <i className="fa-solid fa-chevron-right" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function PlayerStripCard({
  player,
  grade,
  selected,
  onSelect,
}: {
  player: PlayerProfile;
  grade: { grade: string; label: string } | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const photo = player.transfermarkt?.photo;
  const age = playerAge(player);
  const value = formatMarketValue(player.transfermarkt?.market_value_eur);
  const token = gradeTier(grade?.grade ?? "C");

  const meta = [positionShort(player.position), age ? `${age}a` : null, value]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      data-player-id={player.player_id}
      className={`player-strip-card player-strip-card-lg${selected ? " selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="player-strip-card-photo">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" loading="lazy" />
        ) : (
          <span>{playerInitials(player.name)}</span>
        )}
      </span>
      <span className="player-strip-card-copy">
        <span className="player-strip-card-name">{player.name}</span>
        <span className="player-strip-card-club">
          <ClubLogo club={player.club} size={13} />
          <span>{player.club}</span>
        </span>
        <span className="player-strip-card-meta tabular">{meta}</span>
      </span>
      {grade ? (
        <span
          className="player-strip-card-grade tabular"
          style={tierVars(token)}
          title={`Classificação ${grade.grade} em ${grade.label}`}
        >
          {grade.grade}
        </span>
      ) : null}
    </button>
  );
}
