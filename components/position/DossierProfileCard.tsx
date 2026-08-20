"use client";

import { ArchetypeMixCard } from "./ArchetypeMixCard";
import { ArchetypeRadarChart } from "./ArchetypeRadarChart";
import { ConstructionProfileBars } from "./ConstructionProfileBars";
import { DefensiveProfileBars } from "./DefensiveProfileBars";
import type { PlayerProfile } from "@/lib/types";

type Props = {
  player: PlayerProfile;
};

export function DossierProfileCard({ player }: Props) {
  if (!player.cluster) return null;

  return (
    <section className="dossier-profile-row" aria-label="Perfil tático">
      <div className="dossier-profile-col dossier-profile-col-mix">
        <ArchetypeMixCard cluster={player.cluster} />
        <ArchetypeRadarChart cluster={player.cluster} />
      </div>

      <div className="dossier-profile-col dossier-profile-col-bars">
        <ConstructionProfileBars items={player.aspects.perfil_construcao} />
        {player.aspects.perfil_defensivo?.length ? (
          <DefensiveProfileBars items={player.aspects.perfil_defensivo} />
        ) : null}
      </div>
    </section>
  );
}
