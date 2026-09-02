import {
  archetypeTone,
  exArchetypeTone,
  isExCluster,
  isLatCluster,
  isMcCluster,
  latArchetypeTone,
  mcArchetypeTone,
  type PositionCluster,
} from "@/lib/clusterMeta";

type Props = {
  cluster: PositionCluster;
  className?: string;
};

function clusterTone(cluster: PositionCluster) {
  if (isLatCluster(cluster)) return latArchetypeTone(cluster.archetype);
  if (isMcCluster(cluster)) return mcArchetypeTone(cluster.archetype);
  if (isExCluster(cluster)) return exArchetypeTone(cluster.archetype);
  return archetypeTone(cluster.archetype);
}

export function ClusterTag({ cluster, className = "" }: Props) {
  const tone = clusterTone(cluster);
  const badgeShort =
    isLatCluster(cluster) || isMcCluster(cluster) || isExCluster(cluster)
      ? cluster.hybrid_badge_short
      : cluster.construtor_badge_short;
  const badgeTitle =
    isLatCluster(cluster) || isMcCluster(cluster) || isExCluster(cluster)
      ? cluster.hybrid_badge
      : cluster.construtor_badge;

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
