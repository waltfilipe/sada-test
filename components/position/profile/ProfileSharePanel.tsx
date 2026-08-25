"use client";

import { useMemo } from "react";
import type { PlayerProfile } from "@/lib/types";
import { ConstructionProfileBars } from "../ConstructionProfileBars";

export function ProfilePillarBars({ player }: { player: PlayerProfile }) {
  const constr = player.aspects.perfil_construcao ?? [];
  const def = player.aspects.perfil_defensivo ?? [];

  return (
    <div className="player-card xp-profile-panel-card">
      <h3 className="section-label">Tendências de jogo</h3>
      <div className="xp-profile-pillar-stack">
        <article className="xp-profile-pillar-card xp-profile-pillar-productivity">
          <header className="xp-profile-pillar-head">
            <span className="xp-profile-pillar-icon" aria-hidden="true">
              <i className="fa-solid fa-chart-simple" />
            </span>
            <div className="xp-profile-pillar-title-wrap">
              <h4 className="xp-profile-pillar-title">Perfil de construção</h4>
            </div>
          </header>
          <div className="xp-profile-pillar-body">
            <ConstructionProfileBars items={constr} embedded />
          </div>
        </article>

        {def.length ? (
          <article className="xp-profile-pillar-card xp-profile-pillar-precision">
            <header className="xp-profile-pillar-head">
              <span className="xp-profile-pillar-icon" aria-hidden="true">
                <i className="fa-solid fa-shield-halved" />
              </span>
              <div className="xp-profile-pillar-title-wrap">
                <h4 className="xp-profile-pillar-title">Perfil defensivo</h4>
              </div>
            </header>
            <div className="xp-profile-pillar-body">
              <ConstructionProfileBars items={def} embedded />
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
