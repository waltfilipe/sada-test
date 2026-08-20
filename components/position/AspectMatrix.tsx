"use client";

import { ExpandableAspectCardList } from "./ExpandableAspectCard";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

const BAR_GROUPS = [
  { key: "defensivos", title: "Defensivos" },
  { key: "construcao", title: "Construção" },
  { key: "ofensivos", title: "Ofensivos" },
] as const;

const LAT_EXTRA_GROUP = { key: "terco_final", title: "Terço Final" } as const;

export function AspectMatrix({ player, family }: { player: PlayerProfile; family?: PositionFamily }) {
  const groups =
    family === "laterais"
      ? [...BAR_GROUPS, LAT_EXTRA_GROUP]
      : BAR_GROUPS;

  return (
    <div className="aspect-groups">
      {groups.map((group) => {
        const items = player.aspects[group.key as keyof typeof player.aspects];
        if (!items?.length) return null;

        return (
          <article key={group.key} className="aspect-group">
            <header>
              <h3>{group.title}</h3>
            </header>

            <ul>
              <ExpandableAspectCardList items={items} />
            </ul>
          </article>
        );
      })}
    </div>
  );
}
