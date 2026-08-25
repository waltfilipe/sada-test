"use client";

import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { OverallGradePanel } from "./OverallGradePanel";
import { ProfileIdentityColumn } from "./ProfileIdentityColumn";
import { ProfilePillarBars, ProfileSharePanel } from "./ProfileSharePanel";
import { ScoutStatsSections } from "./ScoutStatsSections";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
};

export function PositionProfileView({ player, family }: Props) {
  const overall = player.ratings.geral ?? player.rating;

  return (
    <div className="profile-view-shell">
      <div className="pa-layout">
        <ProfileIdentityColumn player={player} family={family} />

        <div className="pa-col pa-col-score">
          <div className="score-stack">
            <div className="player-card profile-grade-card">
              <OverallGradePanel score={overall} />
            </div>
            <ProfileSharePanel player={player} />
            <ProfilePillarBars player={player} />
          </div>
        </div>

        <div className="pa-col pa-col-pillars">
          <div className="player-card pass-scores-shell">
            <h3 className="section-label">Stats</h3>
            <ScoutStatsSections player={player} family={family} />
          </div>
        </div>
      </div>
    </div>
  );
}
