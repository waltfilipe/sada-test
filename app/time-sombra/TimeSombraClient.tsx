"use client";

import { useMemo, useState } from "react";
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
import { benchPlayerIds, boardAssignments, boardSquad, type TeamBoard } from "@/lib/shadowTeamStorage";
import { gradeTier, ratingToLetterGrade, tierVars } from "@/lib/scoutTheme";
import type { PlayerSearchRow } from "@/lib/types";

const BOARD_LABEL: Record<TeamBoard, string> = {
  proprio: "Time próprio",
  sombra: "Time sombra",
};

type Props = {
  players: PlayerSearchRow[];
};

export function TimeSombraClient({ players }: Props) {
  const { href } = useLeague();
  const { state, ready, changeFormation, assign, dropOnSlot, reserve, removeFromSquad, removeFromWatchlist } =
    useShadowTeam();
  const [board, setBoard] = useState<TeamBoard>("sombra");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [placementPlayerId, setPlacementPlayerId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"squad" | "watch">("squad");
  const [slotQuery, setSlotQuery] = useState("");
  const [picker, setPicker] = useState<{ slot: FormationSlot; mode: "starter" | "reserve" } | null>(null);

  const playersById = useMemo(() => new Map(players.map((p) => [p.player_id, p])), [players]);

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
    return players
      .filter((player) => {
        if (!picker.slot.families.includes(player.position_family)) return false;
        if (taken.has(player.player_id)) return false;
        if (!query) return true;
        return player.name.toLowerCase().includes(query) || player.club.toLowerCase().includes(query);
      })
      .sort((a, b) => b.rating - a.rating);
  }, [players, state, picker, slotQuery, board]);

  if (!ready || !state) {
    return (
      <div className="scout-root profile-page">
        <ScoutTopbar active="time-sombra" />
        <div className="scout-empty">Carregando Time Sombra…</div>
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
    .filter((p): p is PlayerSearchRow => Boolean(p));
  const watchPlayers = state.watchlistIds
    .map((id) => playersById.get(id))
    .filter((p): p is PlayerSearchRow => Boolean(p));

  const starters = Object.values(assignments)
    .filter((id): id is string => Boolean(id))
    .map((id) => playersById.get(id))
    .filter((p): p is PlayerSearchRow => Boolean(p));

  const avgLetter =
    starters.length > 0
      ? ratingToLetterGrade(starters.reduce((sum, p) => sum + p.rating, 0) / starters.length)
      : null;

  function openBoard(next: TeamBoard) {
    setBoard(next);
    setSelectedSlotId(null);
    setPlacementPlayerId(null);
    setPicker(null);
    setSlotQuery("");
  }

  return (
    <div className="scout-root profile-page shadow-page">
      <ScoutTopbar active="time-sombra" />

      <div className="shadow-page-body">
        <header className="shadow-page-header">
          <div>
            <h1 className="shadow-page-title">Time Sombra</h1>
            <p className="shadow-page-sub">
              {BOARD_LABEL[board]} · {squadPlayers.length} escalados · {watchPlayers.length} em observação
              {avgLetter != null ? ` · letra ${avgLetter}` : ""}
            </p>
          </div>

          <div className="shadow-board-switch" role="tablist" aria-label="Seleção">
            {(["proprio", "sombra"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={board === id}
                className={`shadow-board-tab${board === id ? " active" : ""}`}
                onClick={() => openBoard(id)}
              >
                {BOARD_LABEL[id]}
              </button>
            ))}
          </div>

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
        </header>

        <TeamStatsBar starters={starters} squad={squadPlayers} />

        <div className="shadow-layout">
          <section className="shadow-main player-card" aria-label="Campo e reservas">
            <div className="shadow-pitch-row">
              <TeamProfileMap
                formationId={state.formationId}
                assignments={assignments}
                playersById={playersById}
              />
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
            </div>

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
                              {player.club} · {player.position} · {player.profile}
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
                      href={href(
                        `/posicao/${selectedPlayer.position_family}?atleta=${selectedPlayer.player_id}`,
                      )}
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
                  {BOARD_LABEL[board]} ({squadPlayers.length})
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
                      Nenhum atleta no time. Abra uma{" "}
                      <Link href={href("/posicao/zagueiros")}>posição</Link> e use o botão <strong>+</strong> no perfil,
                      ou clique numa vaga vazia do campo.
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
