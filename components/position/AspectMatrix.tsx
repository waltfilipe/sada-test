"use client";

import { ExpandableAspectCardList } from "./ExpandableAspectCard";
import { ConstructionProfileBars } from "./ConstructionProfileBars";
import type { PlayerProfile } from "@/lib/types";

const BAR_GROUPS = [
  { key: "defensivos", title: "Defensivos" },
  { key: "construcao", title: "Construção" },
  { key: "ofensivos", title: "Ofensivos" },
] as const;

export function AspectMatrix({ player }: { player: PlayerProfile }) {
  return (
    <div className="aspect-groups aspect-groups-quad">
      {BAR_GROUPS.map((group) => (
        <article key={group.key} className="aspect-group">
          <header>
            <h3>{group.title}</h3>
          </header>

          <ul>
            <ExpandableAspectCardList items={player.aspects[group.key]} />
          </ul>
        </article>
      ))}

      <ConstructionProfileBars items={player.aspects.perfil_construcao} />
    </div>
  );
}
