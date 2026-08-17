"use client";

import { useMemo, useState } from "react";
import { PlayerResultRow } from "@/components/filters/PlayerResultRow";
import { RangeSlider } from "@/components/filters/RangeSlider";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { POSITION_FAMILIES } from "@/lib/positions";
import { TENDENCY_META, formatRating } from "@/lib/scoutTheme";
import { profileTone } from "@/lib/scoutUi";
import type { PlayerSearchRow, PositionFamily, SiteMeta, Tendencies } from "@/lib/types";

const CURRENT_YEAR = new Date().getFullYear();
const FEET = ["all", "Destro", "Canhoto", "Ambidestro"] as const;

const SORTS = [
  { key: "rating", label: "Melhor rating" },
  { key: "minutes", label: "Mais minutos" },
  { key: "age", label: "Mais jovem" },
  { key: "name", label: "Nome (A–Z)" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];
type Range = [number, number];
type TendencyRanges = Record<keyof Tendencies, Range>;

const FULL_RANGE: Range = [0, 100];

function makeTendencyRanges(): TendencyRanges {
  return {
    construcao: [...FULL_RANGE] as Range,
    ofensividade: [...FULL_RANGE] as Range,
    def1v1: [...FULL_RANGE] as Range,
    contencao: [...FULL_RANGE] as Range,
    duelo_aereo: [...FULL_RANGE] as Range,
  };
}

function sameRange(a: Range, b: Range) {
  return a[0] === b[0] && a[1] === b[1];
}

type Props = {
  meta: SiteMeta;
  players: PlayerSearchRow[];
};

export function FiltrosClient({ meta, players }: Props) {
  /**
   * Derived from the rows rather than meta.filters: the published bounds include
   * players with a missing height, which pins the slider minimum at zero.
   */
  const bounds = useMemo(() => {
    const heights = players.map((p) => p.height).filter((value): value is number => !!value);
    const years = players.map((p) => p.birth_year).filter((value): value is number => !!value);
    const ratings = players.map((p) => p.rating);
    const minutes = players.map((p) => p.minutes);

    return {
      height: [Math.min(...heights), Math.max(...heights)] as Range,
      age: [CURRENT_YEAR - Math.max(...years), CURRENT_YEAR - Math.min(...years)] as Range,
      rating: [
        Math.floor(Math.min(...ratings) * 10) / 10,
        Math.ceil(Math.max(...ratings) * 10) / 10,
      ] as Range,
      minutes: [0, Math.max(...minutes)] as Range,
    };
  }, [players]);

  const ageBounds = bounds.age;

  const [family, setFamily] = useState<PositionFamily>("zagueiros");
  const [query, setQuery] = useState("");
  const [club, setClub] = useState("all");
  const [nationality, setNationality] = useState("all");
  const [foot, setFoot] = useState<string>("all");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("rating");

  const [rating, setRating] = useState<Range>(bounds.rating);
  const [age, setAge] = useState<Range>(ageBounds);
  const [height, setHeight] = useState<Range>(bounds.height);
  const [minutes, setMinutes] = useState<Range>(bounds.minutes);
  const [tendencies, setTendencies] = useState<TendencyRanges>(makeTendencyRanges);

  const familyMeta = meta.families.find((item) => item.key === family)!;

  const resetAll = () => {
    setQuery("");
    setClub("all");
    setNationality("all");
    setFoot("all");
    setProfiles([]);
    setRating(bounds.rating);
    setAge(ageBounds);
    setHeight(bounds.height);
    setMinutes(bounds.minutes);
    setTendencies(makeTendencyRanges());
  };

  const toggleProfile = (profile: string) => {
    setProfiles((current) =>
      current.includes(profile) ? current.filter((item) => item !== profile) : [...current, profile],
    );
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const rows = players.filter((player) => {
      if (player.position_family !== family) return false;
      if (club !== "all" && player.club !== club) return false;
      if (nationality !== "all" && player.nationality !== nationality) return false;
      if (foot !== "all" && player.foot !== foot) return false;
      if (profiles.length && !profiles.includes(player.profile)) return false;

      if (q && !player.name.toLowerCase().includes(q) && !player.club.toLowerCase().includes(q)) {
        return false;
      }

      if (player.rating < rating[0] || player.rating > rating[1]) return false;
      if (player.minutes < minutes[0] || player.minutes > minutes[1]) return false;

      // Height 0 means "not recorded", so those athletes are never excluded by the range.
      if (player.height && (player.height < height[0] || player.height > height[1])) return false;

      if (player.birth_year != null) {
        const playerAge = CURRENT_YEAR - player.birth_year;
        if (playerAge < age[0] || playerAge > age[1]) return false;
      }

      for (const item of TENDENCY_META) {
        const [low, high] = tendencies[item.key];
        const value = player.tendencies[item.key];
        if (value < low || value > high) return false;
      }

      return true;
    });

    return rows.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (sort === "minutes") return b.minutes - a.minutes;
      if (sort === "age") return (b.birth_year ?? 0) - (a.birth_year ?? 0);
      return b.rating - a.rating;
    });
  }, [players, family, club, nationality, foot, profiles, query, rating, minutes, height, age, tendencies, sort]);

  const chips = useMemo(() => {
    const list: { key: string; label: string; clear: () => void }[] = [];

    if (query.trim()) list.push({ key: "q", label: `"${query.trim()}"`, clear: () => setQuery("") });
    if (club !== "all") list.push({ key: "club", label: club, clear: () => setClub("all") });
    if (nationality !== "all") {
      list.push({ key: "nat", label: nationality, clear: () => setNationality("all") });
    }
    if (foot !== "all") list.push({ key: "foot", label: `Pé ${foot.toLowerCase()}`, clear: () => setFoot("all") });

    profiles.forEach((profile) => {
      list.push({ key: `p-${profile}`, label: profile, clear: () => toggleProfile(profile) });
    });

    if (!sameRange(rating, bounds.rating)) {
      list.push({
        key: "rating",
        label: `Rating ${formatRating(rating[0])}–${formatRating(rating[1])}`,
        clear: () => setRating(bounds.rating),
      });
    }
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

    TENDENCY_META.forEach((item) => {
      if (!sameRange(tendencies[item.key], FULL_RANGE)) {
        const [low, high] = tendencies[item.key];
        list.push({
          key: `t-${item.key}`,
          label: `${item.label} ${low}–${high}`,
          clear: () =>
            setTendencies((current) => ({ ...current, [item.key]: [...FULL_RANGE] as Range })),
        });
      }
    });

    return list;
  }, [query, club, nationality, foot, profiles, rating, age, height, minutes, tendencies, bounds, ageBounds]);

  return (
    <div className="scout-root filters-root">
      <ScoutTopbar active="filtros" />

      <div className="filters-body">
        <aside className="filters-rail">
          <div className="filters-rail-inner">
            <header className="filters-rail-head">
              <div>
                <p className="sc-eyebrow">Busca avançada</p>
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
              <h2>Contexto</h2>

              <label className="filter-field">
                <span>Clube</span>
                <select value={club} onChange={(event) => setClub(event.target.value)}>
                  <option value="all">Todos os clubes</option>
                  {meta.clubs.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-field">
                <span>Nacionalidade</span>
                <select value={nationality} onChange={(event) => setNationality(event.target.value)}>
                  <option value="all">Todas</option>
                  {meta.nationalities.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

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
              <h2>Perfil tático</h2>
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
              <h2>Contexto físico</h2>
              <RangeSlider
                label="Rating"
                min={bounds.rating[0]}
                max={bounds.rating[1]}
                step={0.1}
                value={rating}
                onChange={setRating}
                format={formatRating}
              />
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

            <section className="filter-block">
              <h2>Índices normalizados</h2>
              <p className="filter-block-note">Percentil dentro do pool da posição</p>
              {TENDENCY_META.map((item) => (
                <RangeSlider
                  key={item.key}
                  label={item.label}
                  min={0}
                  max={100}
                  value={tendencies[item.key]}
                  onChange={(next) => setTendencies((current) => ({ ...current, [item.key]: next }))}
                />
              ))}
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
                <PlayerResultRow key={player.player_id} player={player} />
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
