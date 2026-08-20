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
  "Defensor de Área": "defensor_area",
  Construtor: "construtor",
  Combativo: "combativo",
};

const RATING_KEYS: Record<ZagArchetype, keyof ZagCluster["ratings"]> = {
  "Defensor de Área": "defensor_area",
  Construtor: "construtor",
  Combativo: "combativo",
};

export function ArchetypeMixCard({ cluster }: Props) {
  return (
    <article className="archetype-mix-card" aria-label="Perfil do atleta">
      <header className="archetype-mix-head">
        <h3>Perfil do Atleta</h3>
        {cluster.construtor_badge_short ? (
          <span className="cluster-badge-hierarchical" title={cluster.construtor_badge ?? undefined}>
            {cluster.construtor_badge_short}
          </span>
        ) : null}
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

const ARCHETYPES = new Set<string>(["Defensor de Área", "Construtor", "Combativo"]);
const CONSTRUTOR_BADGES = new Set<string>(["Construtor Âncora", "Construtor Nato"]);

export function playerMatchesClusterFilter(
  player: { cluster?: ZagCluster | null },
  filters: string[],
): boolean {
  if (!filters.length) return true;
  if (!player.cluster) return false;

  const archetypeFilters = filters.filter((key) => ARCHETYPES.has(key));
  const badgeFilters = filters.filter((key) => CONSTRUTOR_BADGES.has(key));

  if (badgeFilters.length) return badgeFilters.includes(player.cluster.construtor_badge ?? "");
  if (archetypeFilters.length) return archetypeFilters.includes(player.cluster.archetype);
  return true;
}
