import { archetypeTone, isLatCluster, latArchetypeTone, type PositionCluster } from "@/lib/clusterMeta";

type Props = {
  cluster: PositionCluster;
  className?: string;
};

export function ClusterTag({ cluster, className = "" }: Props) {
  const tone = isLatCluster(cluster) ? latArchetypeTone(cluster.archetype) : archetypeTone(cluster.archetype);
  const badgeShort = isLatCluster(cluster)
    ? cluster.hybrid_badge_short
    : cluster.construtor_badge_short;
  const badgeTitle = isLatCluster(cluster) ? cluster.hybrid_badge : cluster.construtor_badge;

  return (
    <span className={`cluster-tag ${className}`.trim()}>
      <span className={`cluster-tag-macro cluster-${tone}`}>{cluster.archetype_label}</span>
      {badgeShort ? (
        <span className={`cluster-tag-badge cluster-${tone}`} title={badgeTitle ?? undefined}>
          {badgeShort}
        </span>
      ) : null}
    </span>
  );
}

export function clusterTagProps(player: { cluster?: PositionCluster | null }) {
  return player.cluster ? { cluster: player.cluster } : null;
}
