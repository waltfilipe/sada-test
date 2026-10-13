"use client";

import { useEffect, useState } from "react";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { PlayerHero } from "./PlayerHero";
import { PlayerHeatmap } from "./PlayerHeatmap";
import { ProfileCard } from "./ProfileCard";
import { ScoutStatsSections } from "./ScoutStatsSections";
import { WyscoutRolePitch } from "./WyscoutRolePitch";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
  heatmapsEnabled?: boolean;
};

export function PositionProfileView({ player, family, players, heatmapsEnabled = true }: Props) {
  const roles = player.wyscout_positions ?? [];
  const canToggle = heatmapsEnabled && roles.length > 0 && (player.heatmap?.points?.length ?? 0) > 0;
  const [mapMode, setMapMode] = useState<"heat" | "roles">("heat");

  useEffect(() => {
    setMapMode("heat");
  }, [player.player_id]);

  return (
    <div className="profile-view-shell">
      <PlayerHero player={player} family={family} />

      <div className={`profile-content-grid${heatmapsEnabled ? "" : " profile-content-grid-no-heatmap"}`}>
        {heatmapsEnabled ? (
          <div className="profile-content-col profile-col-heatmap">
            <div className="player-card heatmap-card profile-perfil-card-score">
              <div className="profile-card-head">
                <h3 className="section-label">{mapMode === "roles" && canToggle ? "Posições" : "Heatmap"}</h3>
                {canToggle ? (
                  <div className="heatmap-mode-switch" role="tablist" aria-label="Tipo de mapa">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mapMode === "heat"}
                      className={mapMode === "heat" ? "active" : ""}
                      onClick={() => setMapMode("heat")}
                    >
                      Calor
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mapMode === "roles"}
                      className={mapMode === "roles" ? "active" : ""}
                      onClick={() => setMapMode("roles")}
                    >
                      Posições
                    </button>
                  </div>
                ) : null}
              </div>
              {mapMode === "roles" && canToggle ? (
                <WyscoutRolePitch positions={roles} playerName={player.name} />
              ) : (
                <PlayerHeatmap heatmap={player.heatmap} playerName={player.name} />
              )}
            </div>
          </div>
        ) : null}

        <div className="profile-content-col profile-col-middle">
          <ProfileCard player={player} family={family} players={players} />
        </div>

        <div className="profile-content-col profile-col-stats">
          <div className="player-card pass-scores-shell">
            <ScoutStatsSections player={player} family={family} />
          </div>
        </div>
      </div>
    </div>
  );
}
