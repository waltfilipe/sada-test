"use client";

import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { PlayerHero } from "./PlayerHero";
import { PlayerHeatmap } from "./PlayerHeatmap";
import { ProfileCard } from "./ProfileCard";
import { ScoutStatsSections } from "./ScoutStatsSections";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
  heatmapsEnabled?: boolean;
};

export function PositionProfileView({ player, family, players, heatmapsEnabled = true }: Props) {
  return (
    <div className="profile-view-shell">
      <PlayerHero player={player} family={family} players={players} />

      <div className={`profile-content-grid${heatmapsEnabled ? "" : " profile-content-grid-no-heatmap"}`}>
        {heatmapsEnabled ? (
          <div className="profile-content-col profile-col-heatmap">
            <div className="player-card heatmap-card profile-perfil-card-score">
              <div className="profile-card-head">
                <h3 className="section-label">Mapa de calor</h3>
              </div>
              <PlayerHeatmap upright heatmap={player.heatmap} playerName={player.name} />
            </div>
          </div>
        ) : null}

        <div className="profile-content-col profile-col-middle">
          <ProfileCard player={player} family={family} players={players} />
        </div>

        <div className="profile-content-col profile-col-stats">
          <div className="player-card pass-scores-shell">
            <ScoutStatsSections player={player} family={family} players={players} />
          </div>
        </div>
      </div>
    </div>
  );
}
