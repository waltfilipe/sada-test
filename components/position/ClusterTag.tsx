import { archetypeTone, type ZagCluster } from "@/lib/clusterMeta";

type Props = {
  cluster: ZagCluster;
  className?: string;
};

export function ClusterTag({ cluster, className = "" }: Props) {
  return (
    <span className={`cluster-tag ${className}`.trim()}>
      <span className={`cluster-tag-macro cluster-${archetypeTone(cluster.archetype)}`}>
        {cluster.archetype_label}
      </span>
      {cluster.is_hybrid ? (
        <span className="cluster-tag-hybrid" title="Perfil equilibrado entre arquétipos">
          Híbrido
        </span>
      ) : null}
    </span>
  );
}

export function clusterTagProps(player: { cluster?: ZagCluster | null }) {
  return player.cluster ? { cluster: player.cluster } : null;
}
