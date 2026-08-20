"use client";

import { ConstructionProfileBars } from "./ConstructionProfileBars";
import type { AspectItem } from "@/lib/types";

export function DefensiveProfileBars({ items }: { items: AspectItem[] }) {
  if (!items.length) return null;

  return (
    <article className="aspect-group aspect-group-def">
      <header>
        <h3>Perfil defensivo</h3>
      </header>
      <ConstructionProfileBars items={items} embedded />
    </article>
  );
}
