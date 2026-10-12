"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PositionFamilyTabs } from "@/components/PositionFamilyTabs";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { familyBySlug } from "@/lib/positions";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { topRatedPlayerId } from "@/lib/scoutUi";
import { PositionPlayerPicker } from "./profile/PositionPlayerPicker";
import { PositionProfileView } from "./profile/PositionProfileView";

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
};

export function PositionScoutPage({ family, players }: Props) {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("atleta");

  const [selectedId, setSelectedId] = useState(
    () =>
      (requestedId && players.some((p) => p.player_id === requestedId)
        ? requestedId
        : topRatedPlayerId(players)) ?? "",
  );
  const [profileFilter, setProfileFilter] = useState<string | null>(null);
  const [clusterFilters, setClusterFilters] = useState<string[]>([]);
  const familyMeta = familyBySlug(family);
  const clusterMode =
    family === "zagueiros" ||
    family === "laterais" ||
    family === "meio-campistas" ||
    family === "extremos" ||
    family === "atacantes";

  const profilesAvailable = useMemo(() => {
    const set = new Set<string>();
    for (const player of players) {
      if (player.profile) set.add(player.profile);
      for (const profile of player.profiles_available ?? []) set.add(profile);
    }
    return [...set];
  }, [players]);

  const selected = players.find((player) => player.player_id === selectedId) ?? players[0] ?? null;

  useEffect(() => {
    if (players.length && !players.some((player) => player.player_id === selectedId)) {
      setSelectedId(topRatedPlayerId(players));
    }
  }, [players, selectedId]);

  useEffect(() => {
    if (requestedId && players.some((player) => player.player_id === requestedId)) {
      setSelectedId(requestedId);
    }
  }, [requestedId, players]);

  const toggleClusterFilter = (key: string) => {
    setClusterFilters((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  return (
    <div className="scout-root profile-page">
      <ScoutTopbar
        active="posicoes"
        subnav={<PositionFamilyTabs active={family} hrefFor={(slug) => `/posicao/${slug}`} />}
      />

      <div className="profile-page-body">
        {!selected ? (
          <div className="scout-empty">Nenhum atleta disponível para {familyMeta.label.toLowerCase()}.</div>
        ) : (
          <>
            <div className="profile-context-header">
              <h1 className="profile-context-title">{familyMeta.label}</h1>
              <span className="profile-context-meta">
                {players.length} atletas · Série A 2025/26
                {family === "zagueiros" ? (
                  <>
                    {" · "}
                    <Link href="/zagueiros-v2">Ver layout v2</Link>
                  </>
                ) : null}
              </span>
            </div>

            <div className="profile-top-shell">
              <PositionPlayerPicker
                players={players}
                family={family}
                selectedId={selected.player_id}
                onSelect={setSelectedId}
                clusterMode={clusterMode}
                clusterFilters={clusterFilters}
                profileFilter={profileFilter}
                onProfileFilterChange={setProfileFilter}
                onToggleClusterFilter={toggleClusterFilter}
                onClearClusterFilters={() => setClusterFilters([])}
                profilesAvailable={profilesAvailable}
              />
            </div>

            <div className="profile-detail-stage" key={selected.player_id}>
              <PositionProfileView player={selected} family={family} players={players} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
