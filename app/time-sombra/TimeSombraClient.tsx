"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLeague } from "@/components/LeagueProvider";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { AddToShadowMenu } from "@/components/shadow/AddToShadowMenu";
import { BenchStrip, PitchView } from "@/components/shadow/PitchView";
import { formatDominantFoot } from "@/components/shadow/ShadowPlayerMiniReport";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { ShadowPlayerRow } from "@/components/shadow/ShadowPlayerChip";
import { TeamProfileMap } from "@/components/shadow/TeamProfileMap";
import { TeamStatsBar } from "@/components/shadow/TeamStatsBar";
import { useShadowTeam } from "@/hooks/useShadowTeam";
import { FORMATIONS, formationById, type FormationSlot } from "@/lib/formations";
import { LEAGUES, type LeagueId } from "@/lib/leagues";
import { benchPlayerIds, boardAssignments, boardSquad, type ShadowScope, type TeamBoard } from "@/lib/shadowTeamStorage";
import { gradeTier, ratingToLetterGrade, tierVars } from "@/lib/scoutTheme";
import type { PlayerSearchRow } from "@/lib/types";

type SquadSource = "elenco" | "sombra" | "sombra-todas";
type SquadPlayer = PlayerSearchRow & { sourceLeague: LeagueId };

const SOURCE_KEY = "scout:elenco-source";
const SOMBRA_LEAGUE_KEY = "scout:elenco-sombra-league";

function readSource(): SquadSource {
  if (typeof window === "undefined") return "elenco";
  const value = sessionStorage.getItem(SOURCE_KEY);
  if (value === "sombra" || value === "sombra-todas" || value === "elenco") return value;
  return "elenco";
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function readSombraLeague(fallback: LeagueId): LeagueId {
  if (typeof window === "undefined") return fallback;
  const value = sessionStorage.getItem(SOMBRA_LEAGUE_KEY);
  return value === "serie-a" || value === "serie-c" ? value : fallback;
}

type Props = {
  playersByLeague: Record<LeagueId, PlayerSearchRow[]>;
};

export function TimeSombraClient({ playersByLeague }: Props) {
  const { href, leagueId, name } = useLeague();
  const [mode, setMode] = useState<SquadSource>("elenco");
  const [sombraLeague, setSombraLeague] = useState<LeagueId>(leagueId);

  useEffect(() => {
    setMode(readSource());
    setSombraLeague(readSombraLeague(leagueId));
  }, [leagueId]);
  const scope: ShadowScope = mode === "sombra-todas" ? "todas" : mode === "sombra" ? sombraLeague : leagueId;
  const board: TeamBoard = mode === "elenco" ? "proprio" : "sombra";
  const { state, ready, changeFormation, assign, dropOnSlot, reserve, removeFromSquad, removeFromWatchlist } =
    useShadowTeam(scope);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [placementPlayerId, setPlacementPlayerId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"squad" | "watch">("squad");
  const [slotQuery, setSlotQuery] = useState("");
  const [picker, setPicker] = useState<{ slot: FormationSlot; mode: "starter" | "reserve" } | null>(null);

  const taggedPlayers = useMemo(() => {
    const rows: SquadPlayer[] = [];
    for (const league of LEAGUES) {
      for (const player of playersByLeague[league.id] ?? []) {
        rows.push({ ...player, sourceLeague: league.id });
      }
    }
    return rows;
  }, [playersByLeague]);

  const pickerPool = taggedPlayers;

  const playersById = useMemo(() => new Map(taggedPlayers.map((player) => [player.player_id, player])), [taggedPlayers]);

  const slotCandidates = useMemo(() => {
    if (!state || !picker) return [];
    const assignments = boardAssignments(state, board);
    const squadIds = new Set(boardSquad(state, board));
    const occupantId = assignments[picker.slot.id];
    if (picker.mode === "starter" && occupantId) return [];
    const query = slotQuery.trim().toLowerCase();
    const taken = new Set(
      picker.mode === "starter"
        ? (Object.values(assignments).filter((id): id is string => Boolean(id)))
        : squadIds,
    );
    return pickerPool
      .filter((player) => {
        if (!picker.slot.families.includes(player.position_family)) return false;
        if (taken.has(player.player_id)) return false;
        if (!query) return true;
        const leagueName = LEAGUES.find((league) => league.id === player.sourceLeague)?.name ?? "";
        const q = fold(query);
        return fold(player.name).includes(q) || fold(player.club).includes(q) || fold(leagueName).includes(q);
      })
      .sort((a, b) => b.rating - a.rating);
  }, [pickerPool, state, picker, slotQuery, board]);

  if (!ready || !state) {
    return (
      <div className="scout-root profile-page">
        <ScoutTopbar active="elenco" />
        <div className="scout-empty">Carregando elenco…</div>
      </div>
    );
  }

  const formation = formationById(state.formationId);
  const assignments = boardAssignments(state, board);
  const benchIds = benchPlayerIds(state, board);
  const selectedPlayerId = selectedSlotId ? assignments[selectedSlotId] : null;
  const selectedPlayer = selectedPlayerId ? playersById.get(selectedPlayerId) : null;
  const activeSquadIds = boardSquad(state, board);

  const squadPlayers = activeSquadIds
    .map((id) => playersById.get(id))
    .filter((p): p is SquadPlayer => Boolean(p));
  const watchPlayers = state.watchlistIds
    .map((id) => playersById.get(id))
    .filter((p): p is SquadPlayer => Boolean(p));

  const starters = Object.values(assignments)
    .filter((id): id is string => Boolean(id))
    .map((id) => playersById.get(id))
    .filter((p): p is SquadPlayer => Boolean(p));

  const avgLetter =
    starters.length > 0
      ? ratingToLetterGrade(starters.reduce((sum, p) => sum + p.rating, 0) / starters.length)
      : null;

  function setSource(next: SquadSource) {
    setMode(next);
    sessionStorage.setItem(SOURCE_KEY, next);
    setSelectedSlotId(null);
    setPlacementPlayerId(null);
    setPicker(null);
    setSlotQuery("");
  }

  function chooseSombraLeague(next: LeagueId) {
    setSombraLeague(next);
    sessionStorage.setItem(SOMBRA_LEAGUE_KEY, next);
    setSelectedSlotId(null);
    setPlacementPlayerId(null);
    setPicker(null);
    setSlotQuery("");
  }

  const sourceLabel =
    mode === "elenco"
      ? `Elenco atual · ${name}`
      : mode === "sombra-todas"
        ? "Time sombra · todas as competições"
        : `Time sombra · ${LEAGUES.find((league) => league.id === sombraLeague)?.name ?? ""}`;
  const rosterLabel = mode === "elenco" ? "Elenco" : mode === "sombra-todas" ? "Todas" : "Time sombra";

  return (
    <div className="scout-root profile-page shadow-page">
      <ScoutTopbar active="elenco" />

      <div className="shadow-page-body">
        <header className="shadow-page-header">
          <div className="shadow-page-heading">
            <h1 className="shadow-page-title">Elenco + Time Sombra</h1>
            <p className="shadow-page-sub">
              {sourceLabel} · {starters.length} titulares · {benchIds.length} reservas
              {avgLetter != null ? ` · letra ${avgLetter}` : ""}
            </p>
          </div>

          <div className="shadow-page-controls">
            <div className="shadow-board-switch" role="tablist" aria-label="Fonte do elenco">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "elenco"}
                className={`shadow-board-tab${mode === "elenco" ? " active" : ""}`}
                onClick={() => setSource("elenco")}
              >
                Elenco atual
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "sombra"}
                className={`shadow-board-tab${mode === "sombra" ? " active" : ""}`}
                onClick={() => setSource("sombra")}
              >
                Time sombra
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "sombra-todas"}
                className={`shadow-board-tab${mode === "sombra-todas" ? " active" : ""}`}
                onClick={() => setSource("sombra-todas")}
              >
                Todas as competições
              </button>
            </div>

            {mode === "elenco" ? (
              <div className="shadow-formation-chips" role="group" aria-label="Competição do elenco">
                {LEAGUES.map((league) => (
                  <Link
                    key={league.id}
                    href={`/${league.id}/time-sombra`}
                    className={`shadow-formation-chip${league.id === leagueId ? " active" : ""}`}
                    aria-current={league.id === leagueId ? "true" : undefined}
                  >
                    {league.name}
                  </Link>
                ))}
              </div>
            ) : null}

            {mode === "sombra" ? (
              <div className="shadow-formation-chips" role="group" aria-label="Competição do time sombra">
                {LEAGUES.map((league) => (
                  <button
                    key={league.id}
                    type="button"
                    className={`shadow-formation-chip${league.id === sombraLeague ? " active" : ""}`}
                    aria-pressed={league.id === sombraLeague}
                    onClick={() => chooseSombraLeague(league.id)}
                  >
                    {league.name}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="shadow-formation-picker" role="group" aria-label="Formação tática">
              <span className="shadow-formation-label">Formação</span>
              <div className="shadow-formation-chips">
                {FORMATIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`shadow-formation-chip${state.formationId === f.id ? " active" : ""}`}
                    onClick={() => {
                      changeFormation(f.id);
                      setSelectedSlotId(null);
                      setPlacementPlayerId(null);
                      setPicker(null);
                    }}
                    aria-pressed={state.formationId === f.id}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <TeamStatsBar starters={starters} squad={squadPlayers} />

        <div className="shadow-layout">
          <section className="shadow-main player-card" aria-label="Campo e reservas">
            <PitchView
                formationId={state.formationId}
                assignments={assignments}
                compareAssignments={board === "proprio" ? state.assignments : null}
                playersById={playersById}
                selectedSlotId={selectedSlotId}
                placementPlayerId={placementPlayerId}
                onSelectSlot={(id) => {
                  setPlacementPlayerId(null);
                  setSlotQuery("");
                  if (!id) {
                    setSelectedSlotId(null);
                    setPicker(null);
                    return;
                  }
                  const slot = formation.slots.find((item) => item.id === id);
                  const occupied = Boolean(assignments[id]);
                  setSelectedSlotId(id);
                  if (slot && !occupied) setPicker({ slot, mode: "starter" });
                  else setPicker(null);
                }}
                onAssign={(slotId, playerId) => {
                  assign(slotId, playerId, board);
                  setPlacementPlayerId(null);
                  setPicker(null);
                  setSelectedSlotId(playerId ? slotId : null);
                }}
                onDrop={(sourceSlotId, targetSlotId, playerId) => {
                  dropOnSlot(sourceSlotId, targetSlotId, playerId, board);
                  setPlacementPlayerId(null);
                  setPicker(null);
                  setSelectedSlotId(targetSlotId);
                }}
                onAddReserve={(slot) => {
                  setSelectedSlotId(slot.id);
                  setPlacementPlayerId(null);
                  setSlotQuery("");
                  setPicker({ slot, mode: "reserve" });
                }}
              />

            <TeamProfileMap
              formationId={state.formationId}
              assignments={assignments}
              playersById={playersById}
            />

            <div className="shadow-bench">
              <div className="shadow-bench-head">
                <h3 className="section-label">Reservas</h3>
                <span className="shadow-bench-count tabular">{benchIds.length}</span>
              </div>
              <BenchStrip
                playerIds={benchIds}
                playersById={playersById}
                placementPlayerId={placementPlayerId}
                onPlace={setPlacementPlayerId}
                onRemove={(playerId) => removeFromSquad(playerId, board)}
              />
            </div>
          </section>

          <aside className="shadow-side">
            {picker ? (
              <article className="player-card shadow-slot-picker">
                <div className="profile-card-head">
                  <h3 className="section-label">
                    {picker.mode === "reserve" ? "Reserva" : "Titular"} · {picker.slot.label}
                  </h3>
                  <button
                    type="button"
                    className="shadow-link-btn"
                    onClick={() => {
                      setPicker(null);
                      setSelectedSlotId(null);
                    }}
                  >
                    Fechar
                  </button>
                </div>
                <input
                  className="shadow-slot-search"
                  type="search"
                  value={slotQuery}
                  placeholder="Buscar atleta ou clube…"
                  aria-label="Buscar atleta para escalar"
                  autoFocus
                  onChange={(event) => setSlotQuery(event.target.value)}
                />
                {slotCandidates.length ? (
                  <ul className="shadow-slot-picker-list">
                    {slotCandidates.map((player) => (
                      <li key={player.player_id}>
                        <button
                          type="button"
                          className="shadow-slot-picker-item"
                          onClick={() => {
                            if (picker.mode === "reserve") reserve(player.player_id, board);
                            else assign(picker.slot.id, player.player_id, board);
                            setPicker(null);
                            setSelectedSlotId(picker.slot.id);
                          }}
                        >
                          <ClubLogo club={player.club} size={16} />
                          <span className="shadow-slot-picker-copy">
                            <strong>{player.name}</strong>
                            <em>
                              {player.club} · {LEAGUES.find((league) => league.id === player.sourceLeague)?.name} ·{" "}
                              {player.position} · {player.profile}
                            </em>
                          </span>
                          <span className="shadow-slot-picker-rating tabular">
                            {ratingToLetterGrade(player.rating)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="shadow-roster-empty">Nenhum atleta disponível para esta posição.</p>
                )}
              </article>
            ) : selectedPlayer && selectedSlotId ? (
              <article className="player-card shadow-slot-detail">
                <div className="profile-card-head">
                  <h3 className="section-label">
                    {formation.slots.find((s) => s.id === selectedSlotId)?.label}
                  </h3>
                  <button type="button" className="shadow-link-btn" onClick={() => setSelectedSlotId(null)}>
                    Fechar
                  </button>
                </div>
                <div className="shadow-slot-detail-body">
                  <PlayerPhoto
                    className="shadow-slot-detail-photo"
                    src={selectedPlayer.transfermarkt?.photo}
                    alt=""
                  />
                  <div className="shadow-slot-detail-copy">
                  <h4>{selectedPlayer.name}</h4>
                  <p className="shadow-slot-detail-meta">
                    {selectedPlayer.club} · {selectedPlayer.position}
                  </p>
                  <p className="shadow-slot-detail-profile">{selectedPlayer.profile}</p>
                  <p className="shadow-slot-detail-meta">Pé {formatDominantFoot(selectedPlayer.foot)}</p>
                  <span
                    className="shadow-slot-detail-rating tabular"
                    style={tierVars(gradeTier(ratingToLetterGrade(selectedPlayer.rating)))}
                  >
                    {ratingToLetterGrade(selectedPlayer.rating)}
                  </span>
                  <div className="shadow-slot-detail-actions">
                    <Link
                      className="btn btn-ghost btn-sm"
                      href={`/${selectedPlayer.sourceLeague}/posicao/${selectedPlayer.position_family}?atleta=${selectedPlayer.player_id}`}
                    >
                      Ver perfil
                    </Link>
                    <AddToShadowMenu
                      playerId={selectedPlayer.player_id}
                      family={selectedPlayer.position_family}
                      compact
                    />
                  </div>
                  </div>
                </div>
              </article>
            ) : null}

            <article className="player-card shadow-roster-card">
              <div className="shadow-roster-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={panelTab === "squad"}
                  className={panelTab === "squad" ? "active" : ""}
                  onClick={() => setPanelTab("squad")}
                >
                  {rosterLabel} ({squadPlayers.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={panelTab === "watch"}
                  className={panelTab === "watch" ? "active" : ""}
                  onClick={() => setPanelTab("watch")}
                >
                  Observação ({watchPlayers.length})
                </button>
              </div>

              <div className="shadow-roster-body">
                {panelTab === "squad" ? (
                  squadPlayers.length ? (
                    <ul className="shadow-roster-list">
                      {squadPlayers.map((player) => (
                        <li key={player.player_id}>
                          <ShadowPlayerRow
                            player={player}
                            profileLabel={player.profile}
                            onRemove={() => removeFromSquad(player.player_id, board)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="shadow-roster-empty">
                      Nenhum atleta neste time. Clique numa vaga do campo ou abra{" "}
                      <Link href={href("/posicao/zagueiros")}>Posições</Link> e{" "}
                      <Link href={href("/filtros")}>Filtros</Link> para adicionar pelo perfil.
                    </p>
                  )
                ) : watchPlayers.length ? (
                  <ul className="shadow-roster-list">
                    {watchPlayers.map((player) => (
                      <li key={player.player_id}>
                        <ShadowPlayerRow
                          player={player}
                          profileLabel={player.profile}
                          onRemove={() => removeFromWatchlist(player.player_id)}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="shadow-roster-empty">
                    Lista vazia. Adicione atletas para acompanhar sem escalar.
                  </p>
                )}
              </div>
            </article>
          </aside>
        </div>
      </div>
    </div>
  );
}
