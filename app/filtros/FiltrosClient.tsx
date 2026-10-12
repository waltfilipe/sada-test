"use client";

import { useMemo, useState } from "react";
import { PlayerResultRow } from "@/components/filters/PlayerResultRow";
import { RangeSlider } from "@/components/filters/RangeSlider";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { POSITION_FAMILIES } from "@/lib/positions";
import { badgeCatalogForFamily } from "@/lib/statBadges";
import { positionRating, profileTone } from "@/lib/scoutUi";
import type { PlayerSearchRow, PositionFamily, SiteMeta } from "@/lib/types";

const CURRENT_YEAR = new Date().getFullYear();
const FEET = ["all", "Destro", "Canhoto", "Ambidestro"] as const;

const SORTS = [
  { key: "destaque", label: "Destaque" },
  { key: "minutes", label: "Mais minutos" },
  { key: "age", label: "Mais jovem" },
  { key: "name", label: "Nome (A–Z)" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];
type Range = [number, number];
type Origin = "all" | "br" | "out";

function sameRange(a: Range, b: Range) {
  return a[0] === b[0] && a[1] === b[1];
}

type Props = {
  meta: SiteMeta;
  players: PlayerSearchRow[];
};

export function FiltrosClient({ meta, players }: Props) {
  const bounds = useMemo(() => {
    const heights = players.map((p) => p.height).filter((value): value is number => !!value);
    const years = players.map((p) => p.birth_year).filter((value): value is number => !!value);
    const minutes = players.map((p) => p.minutes);

    return {
      height: [Math.min(...heights), Math.max(...heights)] as Range,
      age: [CURRENT_YEAR - Math.max(...years), CURRENT_YEAR - Math.min(...years)] as Range,
      minutes: [0, Math.max(...minutes)] as Range,
    };
  }, [players]);

  const ageBounds = bounds.age;

  const [family, setFamily] = useState<PositionFamily>("zagueiros");
  const [query, setQuery] = useState("");
  const [club, setClub] = useState("all");
  const [origin, setOrigin] = useState<Origin>("all");
  const [foot, setFoot] = useState<string>("all");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [badges, setBadges] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("destaque");
  const [age, setAge] = useState<Range>(ageBounds);
  const [height, setHeight] = useState<Range>(bounds.height);
  const [minutes, setMinutes] = useState<Range>(bounds.minutes);

  const familyMeta = meta.families.find((item) => item.key === family)!;
  const badgeOptions = useMemo(() => badgeCatalogForFamily(family), [family]);

  const clubs = useMemo(() => {
    const set = new Set<string>();
    for (const player of players) {
      if (player.position_family === family) set.add(player.club);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [players, family]);

  const resetAll = () => {
    setQuery("");
    setClub("all");
    setOrigin("all");
    setFoot("all");
    setProfiles([]);
    setBadges([]);
    setAge(ageBounds);
    setHeight(bounds.height);
    setMinutes(bounds.minutes);
  };

  const toggleProfile = (profile: string) => {
    setProfiles((current) =>
      current.includes(profile) ? current.filter((item) => item !== profile) : [...current, profile],
    );
  };

  const toggleBadge = (key: string) => {
    setBadges((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const rows = players.filter((player) => {
      if (player.position_family !== family) return false;
      if (club !== "all" && player.club !== club) return false;
      if (origin === "br" && player.nationality !== "Brazil") return false;
      if (origin === "out" && player.nationality === "Brazil") return false;
      if (foot !== "all" && player.foot !== foot) return false;
      if (profiles.length && !profiles.includes(player.profile)) return false;
      if (badges.length && !badges.every((key) => player.badges.includes(key))) return false;

      if (q && !player.name.toLowerCase().includes(q) && !player.club.toLowerCase().includes(q)) {
        return false;
      }

      if (player.minutes < minutes[0] || player.minutes > minutes[1]) return false;
      if (player.height && (player.height < height[0] || player.height > height[1])) return false;

      if (player.birth_year != null) {
        const playerAge = CURRENT_YEAR - player.birth_year;
        if (playerAge < age[0] || playerAge > age[1]) return false;
      }

      return true;
    });

    return rows.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (sort === "minutes") return b.minutes - a.minutes;
      if (sort === "age") return (b.birth_year ?? 0) - (a.birth_year ?? 0);
      return positionRating(b) - positionRating(a);
    });
  }, [players, family, club, origin, foot, profiles, badges, query, minutes, height, age, sort]);

  const chips = useMemo(() => {
    const list: { key: string; label: string; clear: () => void }[] = [];

    if (query.trim()) list.push({ key: "q", label: `"${query.trim()}"`, clear: () => setQuery("") });
    if (club !== "all") list.push({ key: "club", label: club, clear: () => setClub("all") });
    if (origin !== "all") {
      list.push({
        key: "origin",
        label: origin === "br" ? "Brasileiros" : "Estrangeiros",
        clear: () => setOrigin("all"),
      });
    }
    if (foot !== "all") list.push({ key: "foot", label: `Pé ${foot.toLowerCase()}`, clear: () => setFoot("all") });

    profiles.forEach((profile) => {
      list.push({ key: `p-${profile}`, label: profile, clear: () => toggleProfile(profile) });
    });
    badges.forEach((key) => {
      const label = badgeOptions.find((item) => item.key === key)?.label ?? key;
      list.push({ key: `b-${key}`, label, clear: () => toggleBadge(key) });
    });

    if (!sameRange(age, ageBounds)) {
      list.push({ key: "age", label: `${age[0]}–${age[1]} anos`, clear: () => setAge(ageBounds) });
    }
    if (!sameRange(height, bounds.height)) {
      list.push({
        key: "height",
        label: `${height[0]}–${height[1]} cm`,
        clear: () => setHeight(bounds.height),
      });
    }
    if (!sameRange(minutes, bounds.minutes)) {
      list.push({
        key: "minutes",
        label: `${minutes[0]}–${minutes[1]} min`,
        clear: () => setMinutes(bounds.minutes),
      });
    }

    return list;
  }, [query, club, origin, foot, profiles, badges, age, height, minutes, bounds, ageBounds, badgeOptions]);

  return (
    <div className="scout-root filters-root">
      <ScoutTopbar active="filtros" />

      <div className="filters-body">
        <aside className="filters-rail">
          <div className="filters-rail-inner">
            <header className="filters-rail-head">
              <div>
                <p className="sc-eyebrow">Busca</p>
                <h1>Filtros</h1>
              </div>
              <button type="button" onClick={resetAll} disabled={chips.length === 0}>
                Limpar
              </button>
            </header>

            <section className="filter-block">
              <h2>Posição</h2>
              <div className="family-grid">
                {POSITION_FAMILIES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={family === item.key ? "active" : ""}
                    onClick={() => {
                      setFamily(item.key);
                      setProfiles([]);
                      setBadges([]);
                      setClub("all");
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="filter-block">
              <h2>Busca</h2>
              <div className="filter-search">
                <svg viewBox="0 0 16 16" aria-hidden>
                  <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m10.6 10.6 3.2 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nome ou clube"
                  aria-label="Buscar por nome ou clube"
                />
              </div>
            </section>

            <section className="filter-block">
              <h2>Perfil</h2>
              <div className="chip-row">
                {familyMeta.profiles.map((profile) => (
                  <button
                    key={profile}
                    type="button"
                    className={`filter-chip profile-${profileTone(profile)} ${
                      profiles.includes(profile) ? "active" : ""
                    }`}
                    onClick={() => toggleProfile(profile)}
                    aria-pressed={profiles.includes(profile)}
                  >
                    {profile}
                  </button>
                ))}
              </div>
            </section>

            <section className="filter-block">
              <h2>Badges</h2>
              <p className="filter-block-note">Mostra quem conquistou todos os badges marcados.</p>
              <div className="chip-row badge-filter-row">
                {badgeOptions.map((badge) => (
                  <button
                    key={badge.key}
                    type="button"
                    className={`filter-chip badge-filter-chip tone-${badge.tone} ${
                      badges.includes(badge.key) ? "active" : ""
                    }`}
                    onClick={() => toggleBadge(badge.key)}
                    aria-pressed={badges.includes(badge.key)}
                    title={badge.title}
                  >
                    <i className={`fa-solid ${badge.icon}`} aria-hidden="true" />
                    {badge.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="filter-block">
              <h2>Contexto</h2>

              <label className="filter-field">
                <span>Clube</span>
                <select value={club} onChange={(event) => setClub(event.target.value)}>
                  <option value="all">Todos os clubes</option>
                  {clubs.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <div className="filter-field">
                <span>Origem</span>
                <div className="segmented" role="group" aria-label="Origem">
                  {(
                    [
                      ["all", "Todos"],
                      ["br", "Brasil"],
                      ["out", "Fora"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={origin === value ? "active" : ""}
                      onClick={() => setOrigin(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-field">
                <span>Pé dominante</span>
                <div className="segmented" role="group" aria-label="Pé dominante">
                  {FEET.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={foot === item ? "active" : ""}
                      onClick={() => setFoot(item)}
                    >
                      {item === "all" ? "Todos" : item === "Ambidestro" ? "Ambos" : item}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="filter-block">
              <h2>Físico e minutagem</h2>
              <RangeSlider label="Idade" min={ageBounds[0]} max={ageBounds[1]} value={age} onChange={setAge} suffix="anos" />
              <RangeSlider
                label="Altura"
                min={bounds.height[0]}
                max={bounds.height[1]}
                value={height}
                onChange={setHeight}
                suffix="cm"
              />
              <RangeSlider
                label="Minutagem"
                min={bounds.minutes[0]}
                max={bounds.minutes[1]}
                step={10}
                value={minutes}
                onChange={setMinutes}
              />
            </section>
          </div>
        </aside>

        <main className="filters-results">
          <div className="results-toolbar">
            <p className="results-count">
              <strong>{results.length}</strong>
              {results.length === 1 ? " atleta" : " atletas"} · {familyMeta.label.toLowerCase()}
            </p>

            <label className="results-sort">
              <span>Ordenar</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                {SORTS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {chips.length > 0 && (
            <div className="active-chips">
              {chips.map((chip) => (
                <button key={chip.key} type="button" onClick={chip.clear}>
                  {chip.label}
                  <i aria-hidden>×</i>
                </button>
              ))}
              <button type="button" className="chip-clear-all" onClick={resetAll}>
                Limpar tudo
              </button>
            </div>
          )}

          {results.length > 0 ? (
            <div className="results-list">
              {results.map((player) => (
                <PlayerResultRow key={player.player_id} player={player} catalog={badgeOptions} />
              ))}
            </div>
          ) : (
            <div className="results-empty">
              <strong>Nenhum atleta atende a esses critérios</strong>
              <p>Afrouxe um intervalo ou remova um filtro para ampliar a busca.</p>
              <button type="button" onClick={resetAll}>
                Limpar filtros
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
