"use client";

import {
  ZAG_CLUSTER_TREE,
  clusterMacroTone,
  clusterMetaFor,
  type ClusterMacro,
  type ClusterMicro,
  type ZagCluster,
} from "@/lib/clusterMeta";

type Props = {
  cluster: ZagCluster;
  poolCounts?: Partial<Record<ClusterMicro, number>>;
};

export function ClusterHierarchy({ cluster, poolCounts }: Props) {
  const meta = clusterMetaFor(cluster.macro, cluster.micro);

  return (
    <section className="cluster-hierarchy" aria-label="Classificação hierárquica">
      <header className="cluster-hierarchy-head">
        <div className="cluster-path">
          <span className={`cluster-path-macro cluster-${clusterMacroTone(cluster.macro)}`}>{cluster.macro}</span>
          <svg viewBox="0 0 16 16" aria-hidden className="cluster-path-chevron">
            <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className={`cluster-path-micro cluster-${clusterMacroTone(cluster.macro)}`}>{cluster.micro_label}</span>
        </div>
        <p className="cluster-path-desc">{meta.leaf?.description ?? meta.branch?.description}</p>
      </header>

      <div className="cluster-map" role="img" aria-label={`Mapa de perfis: ${meta.path}`}>
        {ZAG_CLUSTER_TREE.map((branch) => (
          <div key={branch.macro} className={`cluster-map-branch cluster-${branch.tone}`}>
            <p className="cluster-map-macro">{branch.macro}</p>
            <div className="cluster-map-leaves">
              {branch.children.map((leaf) => {
                const active = branch.macro === cluster.macro && leaf.micro === cluster.micro;
                const count = poolCounts?.[leaf.micro];
                return (
                  <div
                    key={leaf.micro}
                    className={`cluster-map-leaf ${active ? "active" : ""}`}
                    aria-current={active ? "true" : undefined}
                  >
                    <span className="cluster-map-code">{leaf.micro}</span>
                    <strong>{leaf.label}</strong>
                    {typeof count === "number" && <em>{count}</em>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function clusterFilterKey(macro: ClusterMacro | null, micro: ClusterMicro | null): string | null {
  if (micro) return micro;
  if (macro) return macro;
  return null;
}

const CLUSTER_MICROS = new Set<string>(["D1", "D2", "C1", "C2"]);
const CLUSTER_MACROS = new Set<string>(["Defensor", "Construtor"]);

export function playerMatchesClusterFilter(
  player: { cluster?: ZagCluster | null },
  filters: string[],
): boolean {
  if (!filters.length) return true;
  if (!player.cluster) return false;

  const microFilters = filters.filter((key) => CLUSTER_MICROS.has(key));
  const macroFilters = filters.filter((key) => CLUSTER_MACROS.has(key));

  // Micro chips narrow the pool; macro-only applies when no micro is selected.
  if (microFilters.length) {
    return microFilters.includes(player.cluster.micro);
  }
  if (macroFilters.length) {
    return macroFilters.includes(player.cluster.macro);
  }
  return true;
}
