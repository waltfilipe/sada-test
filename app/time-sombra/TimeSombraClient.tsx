"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { AddToShadowMenu } from "@/components/shadow/AddToShadowMenu";
import { BenchStrip, PitchView } from "@/components/shadow/PitchView";
import { ShadowPlayerRow } from "@/components/shadow/ShadowPlayerChip";
import { useShadowTeam } from "@/hooks/useShadowTeam";
import { FORMATIONS, formationById } from "@/lib/formations";
import { benchPlayerIds } from "@/lib/shadowTeamStorage";
import { formatRating, ratingTier, tierVars } from "@/lib/scoutTheme";
import type { PlayerSummary } from "@/lib/types";

type Props = {
  players: PlayerSummary[];
};

export function TimeSombraClient({ players }: Props) {
  const { state, ready, changeFormation, assign, swap, removeFromSquad, removeFromWatchlist } = useShadowTeam();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const [placementPlayerId, setPlacementPlayerId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"squad" | "watch">("squad");

  const playersById = useMemo(() => new Map(players.map((p) => [p.player_id, p])), [players]);

  if (!ready || !state) {
    return (
      <div className="scout-root profile-page">
        <ScoutTopbar active="time-sombra" />
        <div className="scout-empty">Carregando Time Sombra…</div>
      </div>
    );
  }

  const formation = formationById(state.formationId);
  const benchIds = benchPlayerIds(state);
  const selectedPlayerId = selectedSlotId ? state.assignments[selectedSlotId] : null;
  const selectedPlayer = selectedPlayerId ? playersById.get(selectedPlayerId) : null;

  const squadPlayers = state.squadIds
    .map((id) => playersById.get(id))
    .filter((p): p is PlayerSummary => Boolean(p));
  const watchPlayers = state.watchlistIds
    .map((id) => playersById.get(id))
    .filter((p): p is PlayerSummary => Boolean(p));

  const avgRating =
    squadPlayers.length > 0
      ? squadPlayers.reduce((sum, p) => sum + p.rating, 0) / squadPlayers.length
      : null;

  return (
    <div className="scout-root profile-page shadow-page">
      <ScoutTopbar active="time-sombra" />

      <div className="shadow-page-body">
        <header className="shadow-page-header">
          <div>
            <h1 className="shadow-page-title">Time Sombra</h1>
            <p className="shadow-page-sub">
              {squadPlayers.length} escalados · {watchPlayers.length} em observação
              {avgRating != null ? ` · média ${formatRating(avgRating)}` : ""}
            </p>
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
                    setSwapSourceId(null);
                    setPlacementPlayerId(null);
                  }}
                  aria-pressed={state.formationId === f.id}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="shadow-layout">
          <section className="shadow-main player-card" aria-label="Campo e reservas">
            <PitchView
              formationId={state.formationId}
              assignments={state.assignments}
              playersById={playersById}
              selectedSlotId={selectedSlotId}
              swapSourceId={swapSourceId}
              placementPlayerId={placementPlayerId}
              onSelectSlot={(id) => {
                setSelectedSlotId(id);
                setPlacementPlayerId(null);
              }}
              onSwapSource={setSwapSourceId}
              onAssign={(slotId, playerId) => {
                assign(slotId, playerId);
                setPlacementPlayerId(null);
                setSelectedSlotId(playerId ? slotId : null);
              }}
              onSwap={(a, b) => {
                swap(a, b);
                setSwapSourceId(null);
              }}
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
                onRemove={removeFromSquad}
              />
            </div>
          </section>

          <aside className="shadow-side">
            {selectedPlayer && selectedSlotId ? (
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
                  {selectedPlayer.transfermarkt?.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="shadow-slot-detail-photo"
                      src={selectedPlayer.transfermarkt.photo}
                      alt=""
                    />
                  ) : null}
                  <h4>{selectedPlayer.name}</h4>
                  <p className="shadow-slot-detail-meta">
                    {selectedPlayer.club} · {selectedPlayer.position}
                  </p>
                  <p className="shadow-slot-detail-profile">{selectedPlayer.profile}</p>
                  <span
                    className="shadow-slot-detail-rating tabular"
                    style={tierVars(ratingTier(selectedPlayer.rating))}
                  >
                    Rating {formatRating(selectedPlayer.rating)}
                  </span>
                  <div className="shadow-slot-detail-actions">
                    <Link
                      className="btn btn-ghost btn-sm"
                      href={`/posicao/${selectedPlayer.position_family}?atleta=${selectedPlayer.player_id}`}
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
                  Time ({squadPlayers.length})
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
                            onRemove={() => removeFromSquad(player.player_id)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="shadow-roster-empty">
                      Nenhum atleta no time. Use o botão <strong>+</strong> na página do jogador.
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
