"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { POSITION_FAMILIES, familyBySlug } from "@/lib/positions";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { AspectMatrix } from "./AspectMatrix";
import { DossierHeader } from "./DossierHeader";
import { RosterRail } from "./RosterRail";

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
};

export function PositionScoutPage({ family, players }: Props) {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("atleta");

  const [selectedId, setSelectedId] = useState(
    () => (requestedId && players.some((p) => p.player_id === requestedId) ? requestedId : players[0]?.player_id) ?? "",
  );
  const [profilesFilter, setProfilesFilter] = useState<string[]>([]);
  const [clusterFilters, setClusterFilters] = useState<string[]>([]);
  const familyMeta = familyBySlug(family);
  const clusterMode = family === "zagueiros";

  const selected = players.find((player) => player.player_id === selectedId) ?? players[0] ?? null;

  useEffect(() => {
    if (players.length && !players.some((player) => player.player_id === selectedId)) {
      setSelectedId(players[0].player_id);
    }
  }, [players, selectedId]);

  useEffect(() => {
    if (requestedId && players.some((player) => player.player_id === requestedId)) {
      setSelectedId(requestedId);
    }
  }, [requestedId, players]);

  const toggleProfile = (profile: string) => {
    setProfilesFilter((current) =>
      current.includes(profile) ? current.filter((item) => item !== profile) : [...current, profile],
    );
  };

  const toggleClusterFilter = (key: string) => {
    setClusterFilters((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  return (
    <div className="scout-root">
      <ScoutTopbar
        active="posicoes"
        center={
          <nav className="position-tabs" aria-label="Posições">
            {POSITION_FAMILIES.map((item) => (
              <Link
                key={item.key}
                href={`/posicao/${item.slug}`}
                className={item.key === family ? "active" : ""}
                aria-current={item.key === family ? "page" : undefined}
              >
                <span className="tab-full">{item.label}</span>
                <span className="tab-short">{item.short}</span>
              </Link>
            ))}
          </nav>
        }
      />

      {!selected ? (
        <div className="scout-empty">Nenhum atleta disponível para {familyMeta.label.toLowerCase()}.</div>
      ) : (
        <div className="scout-body">
          <RosterRail
            players={players}
            selectedId={selected.player_id}
            profilesFilter={profilesFilter}
            onSelect={setSelectedId}
            onToggleProfile={toggleProfile}
            profilesAvailable={selected.profiles_available}
            clusterMode={clusterMode}
            clusterFilters={clusterFilters}
            onToggleClusterFilter={toggleClusterFilter}
          />

          <main className="dossier">
            <DossierHeader
              player={selected}
              poolSize={players.length}
              family={family}
              poolPlayers={players}
            />

            <AspectMatrix player={selected} />
          </main>
        </div>
      )}
    </div>
  );
}
