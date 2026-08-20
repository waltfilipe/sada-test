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
      {cluster.construtor_badge_short ? (
        <span
          className={`cluster-tag-badge cluster-${archetypeTone(cluster.archetype)}`}
          title={cluster.construtor_badge ?? undefined}
        >
          {cluster.construtor_badge_short}
        </span>
      ) : null}
    </span>
  );
}

export function clusterTagProps(player: { cluster?: ZagCluster | null }) {
  return player.cluster ? { cluster: player.cluster } : null;
}
