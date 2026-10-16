"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLeague } from "@/components/LeagueProvider";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { AddToShadowMenu } from "@/components/shadow/AddToShadowMenu";
import { ClubSearch, type ClubOption } from "@/components/shadow/ClubSearch";
import { PitchView } from "@/components/shadow/PitchView";
import { PositionAnalysis } from "@/components/shadow/PositionAnalysis";
import { ReserveBench } from "@/components/shadow/ReserveBench";
import { formatDominantFoot } from "@/components/shadow/ShadowPlayerMiniReport";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { ShadowPlayerRow } from "@/components/shadow/ShadowPlayerChip";
import { TeamProfileMap } from "@/components/shadow/TeamProfileMap";
import { TeamStatsBar } from "@/components/shadow/TeamStatsBar";
import { useShadowTeam } from "@/hooks/useShadowTeam";
import { buildClubLineup, positionLines, type PositionLine } from "@/lib/clubLineup";
import { FORMATIONS, fieldSlots, formationById, type FormationSlot } from "@/lib/formations";
import { LEAGUES, isLeagueId, type LeagueId } from "@/lib/leagues";
import { benchPlayerIds, boardAssignments, boardReserves, boardSquad, type ShadowScope, type TeamBoard } from "@/lib/shadowTeamStorage";
import { gradeTier, ratingToLetterGrade, tierVars } from "@/lib/scoutTheme";
import type { PlayerSearchRow } from "@/lib/types";

type SquadSource = "elenco" | "sombra" | "sombra-todas";
type SquadPlayer = PlayerSearchRow & { sourceLeague: LeagueId };

const SOURCE_KEY = "scout:elenco-source";
const SOMBRA_LEAGUE_KEY = "scout:elenco-sombra-league";
const CLUB_KEY = "scout:elenco-club";

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
  const value = sessionStorage.getItem(SOMBRA_LEAGUE_KEY) ?? "";
  return isLeagueId(value) ? value : fallback;
}

type Props = {
  playersByLeague: Record<LeagueId, PlayerSearchRow[]>;
};

export function TimeSombraClient({ playersByLeague }: Props) {
  const { href, leagueId } = useLeague();
  const [mode, setMode] = useState<SquadSource>("elenco");
  const [sombraLeague, setSombraLeague] = useState<LeagueId>(leagueId);

  useEffect(() => {
    setMode(readSource());
    setSombraLeague(readSombraLeague(leagueId));
    setClubKey(sessionStorage.getItem(CLUB_KEY));
  }, [leagueId]);
  const scope: ShadowScope = mode === "sombra-todas" ? "todas" : mode === "sombra" ? sombraLeague : leagueId;
  const board: TeamBoard = mode === "elenco" ? "proprio" : "sombra";
  const { state, ready, changeFormation, assign, dropOnSlot, reserve, removeFromSquad, removeFromWatchlist } =
    useShadowTeam(scope);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);
  const [clubKey, setClubKey] = useState<string | null>(null);
  const [placementPlayerId, setPlacementPlayerId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"squad" | "watch">("squad");
  const [slotQuery, setSlotQuery] = useState("");
  const [elencoHidden, setElencoHidden] = useState<Set<string>>(() => new Set());
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

  const pickerPool = useMemo(() => {
    if (mode === "sombra-todas") return taggedPlayers;
    const series = mode === "elenco" ? leagueId : sombraLeague;
    return taggedPlayers.filter((player) => player.sourceLeague === series);
  }, [taggedPlayers, mode, leagueId, sombraLeague]);

  const playersById = useMemo(() => new Map(taggedPlayers.map((player) => [player.player_id, player])), [taggedPlayers]);

  const clubOptions = useMemo<ClubOption[]>(() => {
    const counts = new Map<string, ClubOption>();
    for (const player of taggedPlayers) {
      if (!player.club) continue;
      const key = `${player.sourceLeague}::${player.club}`;
      const current = counts.get(key);
      if (current) current.count += 1;
      else {
        counts.set(key, {
          club: player.club,
          leagueId: player.sourceLeague,
          leagueName: LEAGUES.find((league) => league.id === player.sourceLeague)?.name ?? player.sourceLeague,
          count: 1,
        });
      }
    }
    return [...counts.values()].sort(
      (a, b) => a.leagueId.localeCompare(b.leagueId) || a.club.localeCompare(b.club, "pt"),
    );
  }, [taggedPlayers]);

  const selectedClub = clubOptions.find((option) => `${option.leagueId}::${option.club}` === clubKey) ?? null;

  const clubPlayers = useMemo(() => {
    if (!selectedClub) return [];
    return taggedPlayers.filter(
      (player) => player.sourceLeague === selectedClub.leagueId && player.club === selectedClub.club,
    );
  }, [taggedPlayers, selectedClub]);

  useEffect(() => {
    setElencoHidden(new Set());
  }, [clubKey]);

  const visibleClubPlayers = useMemo(
    () => clubPlayers.filter((player) => !elencoHidden.has(player.player_id)),
    [clubPlayers, elencoHidden],
  );

  const clubLineup = useMemo(() => {
    if (mode !== "elenco" || !selectedClub) return null;
    return buildClubLineup(visibleClubPlayers, formationById(state?.formationId ?? "4-3-3"));
  }, [mode, selectedClub, visibleClubPlayers, state?.formationId]);

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
  const storedAssignments = boardAssignments(state, board);
  const reservesBySlot = boardReserves(state, board);
  const benchIds = benchPlayerIds(state, board);
  const slottedReserveIds = new Set(Object.values(reservesBySlot).flat());
  const looseReserveIds = benchIds.filter((id) => !slottedReserveIds.has(id));
  const emptyAssignments = Object.fromEntries(fieldSlots(formation).map((slot) => [slot.id, null]));
  const viewAssignments = mode === "elenco" ? (clubLineup?.assignments ?? emptyAssignments) : storedAssignments;
  const viewReserves = mode === "elenco" ? (clubLineup?.reservesBySlot ?? {}) : reservesBySlot;
  const viewLoose = mode === "elenco" ? [] : looseReserveIds;
  const lines: PositionLine[] =
    mode === "elenco"
      ? (clubLineup?.lines ?? [])
      : positionLines(formation, viewAssignments, viewReserves, viewLoose, playersById);
  const reserveIds = lines.flatMap((line) => line.entries.filter((entry) => entry.role === "reserva").map((entry) => entry.playerId));
  const reserveLabels = new Map(lines.flatMap((line) => line.entries.filter((entry) => entry.role === "reserva").map((entry) => [entry.playerId, line.label] as const)));
  const selectedPlayerId = detailPlayerId ?? (selectedSlotId ? viewAssignments[selectedSlotId] : null);
  const selectedPlayer = selectedPlayerId ? playersById.get(selectedPlayerId) : null;
  const activeSquadIds = mode === "elenco" ? clubPlayers.map((player) => player.player_id) : boardSquad(state, board);

  const squadPlayers = (
    mode === "elenco"
      ? [
          ...fieldSlots(formation)
            .map((slot) => viewAssignments[slot.id])
            .filter((id): id is string => Boolean(id)),
          ...reserveIds,
        ]
      : activeSquadIds
  )
    .map((id) => playersById.get(id))
    .filter((p): p is SquadPlayer => Boolean(p));
  const watchPlayers = state.watchlistIds
    .map((id) => playersById.get(id))
    .filter((p): p is SquadPlayer => Boolean(p));

  const starters = Object.values(viewAssignments)
    .filter((id): id is string => Boolean(id))
    .map((id) => playersById.get(id))
    .filter((p): p is SquadPlayer => Boolean(p));
  const editable = mode !== "elenco";

  const excludeCandidates = (() => {
    const query = slotQuery.trim();
    if (!query || !picker) return [] as SquadPlayer[];
    const q = fold(query);
    const pool =
      mode === "elenco" && selectedClub
        ? squadPlayers.filter((player) => !elencoHidden.has(player.player_id))
        : editable
          ? squadPlayers
          : [];
    return pool.filter((player) => {
      const leagueName = LEAGUES.find((league) => league.id === player.sourceLeague)?.name ?? "";
      return fold(player.name).includes(q) || fold(player.club).includes(q) || fold(leagueName).includes(q);
    });
  })();

  const avgLetter =
    starters.length > 0
      ? ratingToLetterGrade(starters.reduce((sum, p) => sum + p.rating, 0) / starters.length)
      : null;

  function setSource(next: SquadSource) {
    setMode(next);
    sessionStorage.setItem(SOURCE_KEY, next);
    setSelectedSlotId(null);
    setDetailPlayerId(null);
    setPlacementPlayerId(null);
    setPicker(null);
    setSlotQuery("");
  }

  function chooseSombraLeague(next: LeagueId) {
    setSombraLeague(next);
    sessionStorage.setItem(SOMBRA_LEAGUE_KEY, next);
    setSelectedSlotId(null);
    setDetailPlayerId(null);
    setPlacementPlayerId(null);
    setPicker(null);
    setSlotQuery("");
  }

  function chooseClub(option: ClubOption | null) {
    const key = option ? `${option.leagueId}::${option.club}` : null;
    setClubKey(key);
    if (key) sessionStorage.setItem(CLUB_KEY, key);
    else sessionStorage.removeItem(CLUB_KEY);
    setSelectedSlotId(null);
    setDetailPlayerId(null);
    setPlacementPlayerId(null);
    setPicker(null);
    setSlotQuery("");
  }

  const sourceLabel =
    mode === "elenco"
      ? selectedClub
        ? `Elenco atual · ${selectedClub.club}`
        : "Elenco atual"
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
              {sourceLabel} · {starters.length} titulares · {reserveIds.length} reservas
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
              <ClubSearch options={clubOptions} value={selectedClub} onChange={chooseClub} />
            ) : null}

            {mode === "sombra" ? (
              <div className="shadow-formation-picker">
              <span className="shadow-formation-label">Série</span>
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
            <div className="shadow-pitch-stage">
              <div className="shadow-stage-pitch">
                {mode === "elenco" && !selectedClub ? (
                  <p className="shadow-club-prompt">Busque um clube para escalar o elenco inteiro, por minutos e por posição.</p>
                ) : null}
                <PitchView
                  formationId={state.formationId}
                  assignments={viewAssignments}
                  compareAssignments={mode === "elenco" ? state.assignments : null}
                  playersById={playersById}
                  selectedSlotId={selectedSlotId}
                  placementPlayerId={editable ? placementPlayerId : null}
                  editable={editable}
                  onSelectSlot={(id) => {
                    setPlacementPlayerId(null);
                    setSlotQuery("");
                    setDetailPlayerId(null);
                    if (!id) {
                      setSelectedSlotId(null);
                      setPicker(null);
                      return;
                    }
                    const slot = formation.slots.find((item) => item.id === id);
                    const occupied = Boolean(viewAssignments[id]);
                    setSelectedSlotId(occupied ? id : null);
                    if (editable && slot && !occupied) setPicker({ slot, mode: "starter" });
                    else setPicker(null);
                  }}
                  onAssign={(slotId, playerId) => {
                    if (!editable) return;
                    assign(slotId, playerId, board);
                    setPlacementPlayerId(null);
                    setDetailPlayerId(null);
                    setPicker(null);
                    setSelectedSlotId(playerId ? slotId : null);
                  }}
                  onDrop={(sourceSlotId, targetSlotId, playerId) => {
                    if (!editable) return;
                    dropOnSlot(sourceSlotId, targetSlotId, playerId, board);
                    setPlacementPlayerId(null);
                    setDetailPlayerId(null);
                    setPicker(null);
                    setSelectedSlotId(targetSlotId);
                  }}
                  onAddReserve={(slot) => {
                    if (!editable) return;
                    setSelectedSlotId(slot.id);
                    setDetailPlayerId(null);
                    setPlacementPlayerId(null);
                    setSlotQuery("");
                    setPicker({ slot, mode: "reserve" });
                  }}
                />
              </div>

              <TeamProfileMap
                formationId={state.formationId}
                assignments={viewAssignments}
                playersById={playersById}
              />
            </div>

            {mode === "elenco" && !selectedClub ? null : (
              <ReserveBench
                playerIds={reserveIds}
                playersById={playersById}
                labels={reserveLabels}
                placementPlayerId={editable ? placementPlayerId : null}
                editable={editable}
                onPlace={(playerId) => {
                  setPicker(null);
                  setDetailPlayerId(null);
                  setPlacementPlayerId((current) => (current === playerId ? null : playerId));
                }}
                onSelect={(playerId) => {
                  setSelectedSlotId(null);
                  setPicker(null);
                  setDetailPlayerId(playerId);
                }}
              />
            )}

            {mode === "elenco" && !selectedClub ? null : <PositionAnalysis lines={lines} />}
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
                  placeholder="Buscar, escalar ou remover atleta…"
                  aria-label="Buscar atleta para escalar ou remover"
                  autoFocus
                  onChange={(event) => setSlotQuery(event.target.value)}
                />
                {excludeCandidates.length ? (
                  <ul className="shadow-slot-picker-remove">
                    {excludeCandidates.map((player) => (
                      <li key={`remove-${player.player_id}`}>
                        <button
                          type="button"
                          className="shadow-slot-picker-remove-item"
                          onClick={() => {
                            if (mode === "elenco") {
                              setElencoHidden((prev) => new Set(prev).add(player.player_id));
                            } else {
                              removeFromSquad(player.player_id, board);
                            }
                            setSlotQuery("");
                            setPicker(null);
                            setSelectedSlotId(null);
                          }}
                        >
                          <span>
                            <strong>Remover {player.name}</strong>
                            <em>
                              {mode === "elenco"
                                ? "Oculta do elenco escalado desta sessão"
                                : "Tira do time sombra"}
                            </em>
                          </span>
                          <i className="fa-solid fa-user-minus" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {slotCandidates.length ? (
                  <ul className="shadow-slot-picker-list">
                    {slotCandidates.map((player) => (
                      <li key={player.player_id}>
                        <button
                          type="button"
                          className="shadow-slot-picker-item"
                          onClick={() => {
                            if (picker.mode === "reserve") reserve(player.player_id, board, picker.slot.id);
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
            ) : selectedPlayer ? (
              <article className="player-card shadow-slot-detail">
                <div className="profile-card-head">
                  <h3 className="section-label">
                    {formation.slots.find((s) => s.id === selectedSlotId)?.label ??
                      reserveLabels.get(selectedPlayer.player_id) ??
                      "Atleta"}
                  </h3>
                  <button
                    type="button"
                    className="shadow-link-btn"
                    onClick={() => {
                      setSelectedSlotId(null);
                      setDetailPlayerId(null);
                    }}
                  >
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
                            onRemove={editable ? () => removeFromSquad(player.player_id, board) : undefined}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="shadow-roster-empty">
                      {mode === "elenco"
                        ? "Busque um clube para ver o elenco completo, já escalado por posição."
                        : (
                          <>
                            Nenhum atleta neste time. Clique numa vaga do campo ou abra{" "}
                            <Link href={href("/posicao/zagueiros")}>Posições</Link> e{" "}
                            <Link href={href("/filtros")}>Filtros</Link> para adicionar pelo perfil.
                          </>
                        )}
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
