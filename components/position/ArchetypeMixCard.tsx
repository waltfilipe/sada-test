"use client";

import { formatRating, ratingTier, tierVars } from "@/lib/scoutTheme";
import {
  ZAG_ARCHETYPE_META,
  archetypeTone,
  type ZagArchetype,
  type ZagCluster,
} from "@/lib/clusterMeta";
import { ArchetypeTooltip } from "./ArchetypeTooltip";

type Props = {
  cluster: ZagCluster;
};

const SHARE_KEYS: Record<ZagArchetype, keyof ZagCluster["shares"]> = {
  Rebatedor: "rebatedor",
  Construtor: "construtor",
  Agressivo: "agressivo",
};

const RATING_KEYS: Record<ZagArchetype, keyof ZagCluster["ratings"]> = {
  Rebatedor: "rebatedor",
  Construtor: "construtor",
  Agressivo: "agressivo",
};

export function ArchetypeMixCard({ cluster }: Props) {
  return (
    <article className="archetype-mix-card" aria-label="Perfil do atleta">
      <header className="archetype-mix-head">
        <h3>Perfil do Atleta</h3>
        {cluster.is_hybrid ? <span className="cluster-hybrid-badge">Híbrido</span> : null}
      </header>

      <ul className="archetype-mix-rows">
        {ZAG_ARCHETYPE_META.map((item) => {
          const share = cluster.shares[SHARE_KEYS[item.archetype]];
          const rating = cluster.ratings[RATING_KEYS[item.archetype]];
          const active = item.archetype === cluster.archetype;
          const token = ratingTier(rating);

          return (
            <li key={item.archetype} className="archetype-mix-item">
              <ArchetypeTooltip archetype={item.archetype} block>
                <div
                  className={`archetype-mix-row cluster-${item.tone} ${active ? "active" : ""}`}
                  aria-current={active ? "true" : undefined}
                >
                  <span className={`archetype-mix-name cluster-${archetypeTone(item.archetype)}`}>
                    {item.archetype}
                  </span>
                  <span className="archetype-mix-share">{Math.round(share)}%</span>
                  <span className="archetype-mix-rating" style={tierVars(token)}>
                    Rating <strong>{formatRating(rating)}</strong>
                  </span>
                </div>
              </ArchetypeTooltip>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

const ARCHETYPES = new Set<string>(["Rebatedor", "Construtor", "Agressivo"]);

export function playerMatchesClusterFilter(
  player: { cluster?: ZagCluster | null },
  filters: string[],
): boolean {
  if (!filters.length) return true;
  if (!player.cluster) return false;

  const archetypeFilters = filters.filter((key) => ARCHETYPES.has(key));
  const hybridOnly = filters.includes("Híbrido");

  if (archetypeFilters.length && hybridOnly) {
    return archetypeFilters.includes(player.cluster.archetype) && player.cluster.is_hybrid;
  }
  if (hybridOnly) return player.cluster.is_hybrid;
  if (archetypeFilters.length) return archetypeFilters.includes(player.cluster.archetype);
  return true;
}
