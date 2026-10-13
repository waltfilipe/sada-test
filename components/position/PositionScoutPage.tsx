"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PositionFamilyTabs } from "@/components/PositionFamilyTabs";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { BadgeFilterBox } from "@/components/filters/BadgeFilterBox";
import { PositionProfileView } from "@/components/position/profile/PositionProfileView";
import {
  AT_ARCHETYPE_META,
  EX_ARCHETYPE_META,
  LAT_ARCHETYPE_META,
  MC_ARCHETYPE_META,
  ZAG_ARCHETYPE_META,
} from "@/lib/clusterMeta";
import { useLeague } from "@/components/LeagueProvider";
import { markFiltersReturn } from "@/lib/filterSession";
import { familyBySlug } from "@/lib/positions";
import { playerInitials } from "@/lib/scoutTheme";
import { positionRating } from "@/lib/scoutUi";
import { badgeCatalogForFamily, playerStatBadges } from "@/lib/statBadges";
import {
  playerMatchesFlankSide,
  supportsFlankSideFilter,
  type FlankSide,
} from "@/lib/playerSideFilter";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

const CURRENT_YEAR = new Date().getFullYear();

const AGE_BANDS = [
  { value: "u21", label: "Até 21", min: 0, max: 21 },
  { value: "22-25", label: "22–25", min: 22, max: 25 },
  { value: "26-29", label: "26–29", min: 26, max: 29 },
  { value: "30+", label: "30+", min: 30, max: 200 },
];

const MINUTES_BANDS = [
  { value: "600", label: "600+", min: 600 },
  { value: "900", label: "900+", min: 900 },
  { value: "1200", label: "1.200+", min: 1200 },
];

function ageOf(player: PlayerProfile): number | null {
  return player.birth_year ? CURRENT_YEAR - player.birth_year : null;
}

function archetypesFor(family: PositionFamily): string[] {
  if (family === "laterais") return LAT_ARCHETYPE_META.map((item) => item.archetype);
  if (family === "meio-campistas") return MC_ARCHETYPE_META.map((item) => item.archetype);
  if (family === "extremos") return EX_ARCHETYPE_META.map((item) => item.archetype);
  if (family === "atacantes") return AT_ARCHETYPE_META.map((item) => item.archetype);
  return ZAG_ARCHETYPE_META.map((item) => item.archetype);
}

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  heatmapsEnabled?: boolean;
};

export function PositionScoutPage({ family, players, heatmapsEnabled = true }: Props) {
  const { leagueId, href } = useLeague();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("atleta");
  const fromFilters = searchParams.get("origem") === "filtros";
  const familyMeta = familyBySlug(family);
  const archetypes = useMemo(() => archetypesFor(family), [family]);

  const badgeOptions = useMemo(() => badgeCatalogForFamily(family), [family]);
  const badgesById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const player of players) {
      map.set(player.player_id, playerStatBadges(player).map((badge) => badge.key));
    }
    return map;
  }, [players]);

  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<string | null>(null);
  const [badges, setBadges] = useState<string[]>([]);
  const [ageBand, setAgeBand] = useState<string | null>(null);
  const [minutesBand, setMinutesBand] = useState<string | null>(null);
  const [foot, setFoot] = useState<string | null>(null);
  const [origin, setOrigin] = useState<"br" | "out" | null>(null);
  const [club, setClub] = useState<string | null>(null);
  const [flankSide, setFlankSide] = useState<FlankSide | null>(null);
  const showFlankFilter = supportsFlankSideFilter(family);
  const [selectedId, setSelectedId] = useState(
    () => (requestedId && players.some((player) => player.player_id === requestedId) ? requestedId : ""),
  );

  const clubs = useMemo(() => {
    const set = new Set(players.map((player) => player.club));
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [players]);

  const feet = useMemo(() => {
    const set = new Set<string>();
    for (const player of players) {
      const value = player.foot?.trim();
      if (value && value.toLowerCase() !== "unknown" && value.toLowerCase() !== "nan") set.add(value);
    }
    return [...set];
  }, [players]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const age = AGE_BANDS.find((band) => band.value === ageBand);
    const minutes = MINUTES_BANDS.find((band) => band.value === minutesBand);

    return players
      .filter((player) => {
        if (profile && player.profile !== profile && player.cluster?.archetype !== profile) return false;
        if (badges.length) {
          const earned = badgesById.get(player.player_id) ?? [];
          if (!badges.every((key) => earned.includes(key))) return false;
        }
        if (club && player.club !== club) return false;
        if (foot && player.foot !== foot) return false;
        if (flankSide && !playerMatchesFlankSide(player, flankSide)) return false;
        if (origin === "br" && player.nationality !== "Brazil") return false;
        if (origin === "out" && player.nationality === "Brazil") return false;
        if (age) {
          const years = ageOf(player);
          if (years == null || years < age.min || years > age.max) return false;
        }
        if (minutes && player.minutes < minutes.min) return false;
        if (!q) return true;
        return player.name.toLowerCase().includes(q) || player.club.toLowerCase().includes(q);
      })
      .sort((a, b) => positionRating(b) - positionRating(a));
  }, [players, profile, badges, badgesById, club, foot, flankSide, origin, ageBand, minutesBand, query]);

  const filterKey = `${profile ?? ""}|${badges.join(",")}|${club ?? ""}|${foot ?? ""}|${flankSide ?? ""}|${origin ?? ""}|${ageBand ?? ""}|${minutesBand ?? ""}`;
  const initialFilter = useRef(true);

  useEffect(() => {
    if (initialFilter.current) {
      initialFilter.current = false;
      if (requestedId && visible.some((player) => player.player_id === requestedId)) return;
    }
    if (!visible.length) return;
    setSelectedId(visible[0]!.player_id);
    // Search typing should not jump the selection; filters do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    if (requestedId && players.some((player) => player.player_id === requestedId)) {
      setSelectedId(requestedId);
    }
  }, [requestedId, players]);

  useEffect(() => {
    if (!visible.length) return;
    if (visible.some((player) => player.player_id === selectedId)) return;
    setSelectedId(visible[0]!.player_id);
  }, [visible, selectedId]);

  const selected = players.find((player) => player.player_id === selectedId) ?? visible[0] ?? null;

  function toggleBadge(key: string) {
    setBadges((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function clearAll() {
    setQuery("");
    setProfile(null);
    setBadges([]);
    setAgeBand(null);
    setMinutesBand(null);
    setFoot(null);
    setOrigin(null);
    setClub(null);
    setFlankSide(null);
  }

  useEffect(() => {
    if (!showFlankFilter) setFlankSide(null);
  }, [showFlankFilter, family]);

  const activeCount =
    (profile ? 1 : 0) +
    badges.length +
    (ageBand ? 1 : 0) +
    (minutesBand ? 1 : 0) +
    (foot ? 1 : 0) +
    (origin ? 1 : 0) +
    (club ? 1 : 0) +
    (flankSide ? 1 : 0) +
    (query.trim() ? 1 : 0);

  return (
    <div className="scout-root zag-v2">
      <ScoutTopbar
        active="posicoes"
        subnav={<PositionFamilyTabs active={family} hrefFor={(slug) => href(`/posicao/${slug}`)} />}
      />

      <div className="zag-v2-frame">
        <header className="zag-v2-title-card">
          <div>
            <p className="zag-v2-kicker">Scouting</p>
            <h1>{familyMeta.label}</h1>
          </div>
          <div className="zag-v2-title-actions">
            {fromFilters ? (
              <button
                type="button"
                onClick={() => {
                  markFiltersReturn(leagueId);
                  router.push(href("/filtros"));
                }}
              >
                Voltar aos filtros
              </button>
            ) : null}
            <button type="button" onClick={clearAll} disabled={!activeCount}>
              Limpar filtros
            </button>
          </div>
        </header>
        <div className="zag-v2-shell">
          <aside className="zag-v2-rail">
            <label className="zag-v2-search">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
              <input
                type="search"
                value={query}
                placeholder="Nome ou clube"
                aria-label="Buscar atleta"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <section className="zag-v2-block">
              <h2>Perfil</h2>
              <div className="zag-v2-chips">
                <button type="button" className={!profile ? "active" : ""} onClick={() => setProfile(null)}>
                  Todos
                </button>
                {archetypes.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={profile === item ? "active" : ""}
                    onClick={() => setProfile(profile === item ? null : item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <BadgeFilterBox options={badgeOptions} selected={badges} onToggle={toggleBadge} />
              <p className="zag-v2-note">Quem tem todos os badges marcados.</p>
            </section>

            <div className="zag-v2-pairs">
              <section className="zag-v2-block">
                <h2>Idade</h2>
                <div className="zag-v2-chips">
                  {AGE_BANDS.map((band) => (
                    <button
                      key={band.value}
                      type="button"
                      className={ageBand === band.value ? "active" : ""}
                      onClick={() => setAgeBand(ageBand === band.value ? null : band.value)}
                    >
                      {band.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="zag-v2-block">
                <h2>Minutagem</h2>
                <div className="zag-v2-chips">
                  {MINUTES_BANDS.map((band) => (
                    <button
                      key={band.value}
                      type="button"
                      className={minutesBand === band.value ? "active" : ""}
                      onClick={() => setMinutesBand(minutesBand === band.value ? null : band.value)}
                    >
                      {band.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>

            {showFlankFilter ? (
              <section className="zag-v2-block">
                <h2>Lado</h2>
                <div className="zag-v2-chips">
                  <button
                    type="button"
                    className={!flankSide ? "active" : ""}
                    onClick={() => setFlankSide(null)}
                  >
                    Ambos
                  </button>
                  <button
                    type="button"
                    className={flankSide === "esquerdo" ? "active" : ""}
                    onClick={() => setFlankSide(flankSide === "esquerdo" ? null : "esquerdo")}
                  >
                    Esquerdo
                  </button>
                  <button
                    type="button"
                    className={flankSide === "direito" ? "active" : ""}
                    onClick={() => setFlankSide(flankSide === "direito" ? null : "direito")}
                  >
                    Direito
                  </button>
                </div>
              </section>
            ) : null}

            <section className="zag-v2-selects zag-v2-block">
              <label>
                Pé
                <select value={foot ?? ""} onChange={(event) => setFoot(event.target.value || null)}>
                  <option value="">Todos</option>
                  {feet.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Origem
                <select
                  value={origin ?? ""}
                  onChange={(event) => setOrigin((event.target.value || null) as "br" | "out" | null)}
                >
                  <option value="">Todas</option>
                  <option value="br">Brasileiros</option>
                  <option value="out">Estrangeiros</option>
                </select>
              </label>
              <label>
                Clube
                <select value={club ?? ""} onChange={(event) => setClub(event.target.value || null)}>
                  <option value="">Todos</option>
                  {clubs.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <p className="zag-v2-count tabular">
              <strong>{visible.length}</strong> de {players.length}
            </p>

            <ul className="zag-v2-list">
              {visible.map((player) => {
                const photo = player.transfermarkt?.photo;
                const active = player.player_id === selected?.player_id;
                return (
                  <li key={player.player_id}>
                    <button
                      type="button"
                      className={active ? "active" : ""}
                      onClick={() => setSelectedId(player.player_id)}
                    >
                      <span className="zag-v2-photo">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo} alt="" />
                        ) : (
                          <span>{playerInitials(player.name)}</span>
                        )}
                      </span>
                      <span className="zag-v2-copy">
                        <strong>{player.name}</strong>
                        <em>
                          {player.club}
                          {player.profile ? ` · ${player.profile}` : ""}
                        </em>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {!visible.length ? <p className="zag-v2-empty">Nenhum atleta com esses filtros.</p> : null}
          </aside>

          <main className="zag-v2-detail">
            {selected ? (
              <PositionProfileView
                player={selected}
                family={family}
                players={players}
                heatmapsEnabled={heatmapsEnabled}
              />
            ) : (
              <p className="zag-v2-empty">Escolha um atleta na lista.</p>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
