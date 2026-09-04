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
};

export function PositionProfileView({ player, family, players }: Props) {
  return (
    <div className="profile-view-shell">
      <PlayerHero player={player} family={family} />

      <div className="profile-content-grid">
        <div className="profile-content-col profile-col-heatmap">
          <div className="player-card heatmap-card">
            <div className="profile-card-head">
              <h3 className="section-label">Heatmap</h3>
            </div>
            <PlayerHeatmap heatmap={player.heatmap} playerName={player.name} />
          </div>
        </div>

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
