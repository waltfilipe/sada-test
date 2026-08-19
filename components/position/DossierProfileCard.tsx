"use client";

import { archetypeCounts } from "@/lib/clusterMeta";
import type { PlayerProfile } from "@/lib/types";
import { ClusterHierarchy } from "./ClusterHierarchy";

type Props = {
  player: PlayerProfile;
  poolPlayers?: PlayerProfile[];
};

export function DossierProfileCard({ player, poolPlayers = [] }: Props) {
  if (!player.cluster) return null;

  const poolStats = poolPlayers.length ? archetypeCounts(poolPlayers) : undefined;

  return (
    <section className="dossier-profile-card" aria-label="Classificação de perfil">
      <ClusterHierarchy cluster={player.cluster} poolCounts={poolStats} />
    </section>
  );
}
