import { archetypeTone, type ZagCluster } from "@/lib/clusterMeta";
import { ArchetypeTooltip } from "./ArchetypeTooltip";

type Props = {
  cluster: ZagCluster;
  className?: string;
};

export function ClusterTag({ cluster, className = "" }: Props) {
  return (
    <ArchetypeTooltip archetype={cluster.archetype}>
      <span className={`cluster-tag ${className}`.trim()}>
        <span className={`cluster-tag-macro cluster-${archetypeTone(cluster.archetype)}`}>
          {cluster.archetype_label}
        </span>
        {cluster.is_hybrid ? (
          <span className="cluster-tag-hybrid">Híbrido</span>
        ) : null}
      </span>
    </ArchetypeTooltip>
  );
}

export function clusterTagProps(player: { cluster?: ZagCluster | null }) {
  return player.cluster ? { cluster: player.cluster } : null;
}
