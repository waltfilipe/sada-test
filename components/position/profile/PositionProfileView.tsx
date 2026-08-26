"use client";

import type { PlayerProfile, PositionFamily } from "@/lib/types";
import type { SectionGradeLookup } from "@/lib/sectionGrades";
import { OverallGradePanel } from "./OverallGradePanel";
import { ProfileIdentityColumn } from "./ProfileIdentityColumn";
import { ProfilePillarBars } from "./ProfileSharePanel";
import { ScoutStatsSections } from "./ScoutStatsSections";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  sectionGradeLookup: SectionGradeLookup;
  poolSize: number;
};

export function PositionProfileView({ player, family, sectionGradeLookup, poolSize }: Props) {
  const overall = player.ratings.geral ?? player.rating;
  const rank = player.ranks?.geral ?? null;

  return (
    <div className="profile-view-shell">
      <div className="pa-layout">
        <ProfileIdentityColumn player={player} family={family} />

        <div className="pa-col pa-col-score">
          <div className="score-stack">
            <div className="player-card profile-grade-card">
              <OverallGradePanel score={overall} rank={rank} poolSize={poolSize} />
            </div>
            <ProfilePillarBars player={player} />
          </div>
        </div>

        <div className="pa-col pa-col-pillars">
          <div className="player-card pass-scores-shell">
            <h3 className="section-label">Stats</h3>
            <ScoutStatsSections
              player={player}
              family={family}
              sectionGradeLookup={sectionGradeLookup}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
