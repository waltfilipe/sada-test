import { clusterMacroTone, clusterMicroTone, type ZagCluster } from "@/lib/clusterMeta";

type Props = {
  cluster: ZagCluster;
  className?: string;
};

export function ClusterTag({ cluster, className = "" }: Props) {
  return (
    <span className={`cluster-tag ${className}`.trim()}>
      <span className={`cluster-tag-macro cluster-${clusterMacroTone(cluster.macro)}`}>{cluster.macro}</span>
      <span className={`cluster-tag-micro cluster-${clusterMicroTone(cluster.micro)}`}>{cluster.micro}</span>
    </span>
  );
}

export function clusterTagProps(player: { cluster?: ZagCluster | null }) {
  return player.cluster ? { cluster: player.cluster } : null;
}
