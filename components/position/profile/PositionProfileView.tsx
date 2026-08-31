"use client";

import type { PlayerProfile, PositionFamily } from "@/lib/types";
import type { SectionGradeLookup } from "@/lib/sectionGrades";
import { PlayerHero } from "./PlayerHero";
import { ProfileCard } from "./ProfileCard";
import { ProfilePillarBars } from "./ProfileSharePanel";
import { ScoutStatsSections } from "./ScoutStatsSections";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  sectionGradeLookup: SectionGradeLookup;
};

export function PositionProfileView({ player, family, sectionGradeLookup }: Props) {
  return (
    <div className="profile-view-shell">
      <PlayerHero player={player} family={family} />

      <div className="profile-content-grid">
        <div className="profile-content-col">
          <ProfileCard player={player} family={family} />
          <ProfilePillarBars player={player} />
          <div className="heatmap-placeholder" aria-label="Heatmap em breve">
            <span className="section-label-sm">Heatmap</span>
            <p className="heatmap-placeholder-copy">Mapa de origem de ações — em breve.</p>
          </div>
        </div>

        <div className="profile-content-col">
          <div className="player-card pass-scores-shell">
            <div className="profile-card-head">
              <h3 className="section-label">Stats</h3>
              <span className="profile-card-head-hint">Percentis no pool da posição</span>
            </div>
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
