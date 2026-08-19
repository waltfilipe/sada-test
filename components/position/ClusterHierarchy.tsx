"use client";

import {
  ZAG_ARCHETYPE_META,
  archetypeCounts,
  archetypeMetaFor,
  archetypeTone,
  type ZagArchetype,
  type ZagCluster,
} from "@/lib/clusterMeta";

type Props = {
  cluster: ZagCluster;
  poolCounts?: ReturnType<typeof archetypeCounts>;
};

const SHARE_KEYS: Record<ZagArchetype, keyof ZagCluster["shares"]> = {
  Rebatedor: "rebatedor",
  Construtor: "construtor",
  Agressivo: "agressivo",
};

export function ClusterHierarchy({ cluster, poolCounts }: Props) {
  const meta = archetypeMetaFor(cluster.archetype);

  return (
    <section className="cluster-hierarchy" aria-label="Classificação de arquétipo">
      <header className="cluster-hierarchy-head">
        <div className="cluster-path">
          <span
            className={`cluster-path-macro cluster-${archetypeTone(cluster.archetype)}`}
            title={meta?.description}
          >
            {cluster.archetype_label}
          </span>
          {cluster.is_hybrid ? (
            <span className="cluster-hybrid-badge" title="Perfil equilibrado entre arquétipos — candidato a badge especial">
              Híbrido
            </span>
          ) : null}
        </div>
        <p className="cluster-share-caption">Mix de arquétipo (pool normalizado)</p>
      </header>

      <div className="cluster-share-bars" aria-label="Participação por arquétipo">
        {ZAG_ARCHETYPE_META.map((item) => {
          const share = cluster.shares[SHARE_KEYS[item.archetype]];
          const active = item.archetype === cluster.archetype;
          return (
            <div
              key={item.archetype}
              className={`cluster-share-row cluster-${item.tone} ${active ? "active" : ""}`}
              title={item.description}
            >
              <span className="cluster-share-label">{item.archetype}</span>
              <span className="cluster-share-track">
                <span className="cluster-share-fill" style={{ width: `${share}%` }} />
              </span>
              <span className="cluster-share-value">{share.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>

      {poolCounts && poolCounts.total > 0 ? (
        <div className="cluster-map cluster-map-archetypes" role="img" aria-label="Distribuição do pool por arquétipo">
          {ZAG_ARCHETYPE_META.map((item) => {
            const count = poolCounts.counts[item.archetype];
            const pct = poolCounts.percents[item.archetype];
            const active = item.archetype === cluster.archetype;
            return (
              <div
                key={item.archetype}
                className={`cluster-map-archetype cluster-${item.tone} ${active ? "active" : ""}`}
                aria-current={active ? "true" : undefined}
                title={item.description}
              >
                <p className="cluster-map-archetype-name">{item.archetype}</p>
                <strong>{pct}%</strong>
                <em>{count} atletas</em>
              </div>
            );
          })}
          {poolCounts.hybrids > 0 ? (
            <p className="cluster-pool-hybrid-note">
              {poolCounts.hybrids} atletas marcados como híbridos ({Math.round((poolCounts.hybrids / poolCounts.total) * 100)}%)
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
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
