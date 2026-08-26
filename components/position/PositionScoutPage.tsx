"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { POSITION_FAMILIES, familyBySlug } from "@/lib/positions";
import { buildSectionGradeLookup } from "@/lib/sectionGrades";
import type { StatLetterFilters } from "@/lib/playerStatFilters";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { PositionFilterBar } from "./profile/PositionFilterBar";
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
    () => (requestedId && players.some((p) => p.player_id === requestedId) ? requestedId : players[0]?.player_id) ?? "",
  );
  const [profilesFilter, setProfilesFilter] = useState<string[]>([]);
  const [clusterFilters, setClusterFilters] = useState<string[]>([]);
  const [statLetterFilters, setStatLetterFilters] = useState<StatLetterFilters>({});
  const familyMeta = familyBySlug(family);
  const clusterMode = family === "zagueiros" || family === "laterais";

  const profilesAvailable = useMemo(() => {
    const set = new Set<string>();
    for (const player of players) {
      if (player.profile) set.add(player.profile);
      for (const profile of player.profiles_available ?? []) set.add(profile);
    }
    return [...set];
  }, [players]);

  const sectionGradeLookup = useMemo(
    () => buildSectionGradeLookup(players, family),
    [players, family],
  );

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

  const setStatLetterFilter = (sectionTitle: string, letter: string | null) => {
    setStatLetterFilters((current) => {
      const next = { ...current };
      if (!letter) delete next[sectionTitle];
      else next[sectionTitle] = letter;
      return next;
    });
  };

  return (
    <div className="scout-root profile-page">
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

      <div className="profile-page-body">
        {!selected ? (
          <div className="scout-empty">Nenhum atleta disponível para {familyMeta.label.toLowerCase()}.</div>
        ) : (
          <>
            <div className="profile-top-shell">
              <PositionFilterBar
                family={family}
                clusterMode={clusterMode}
                clusterFilters={clusterFilters}
                profilesFilter={profilesFilter}
                onToggleClusterFilter={toggleClusterFilter}
                onToggleProfile={toggleProfile}
                profilesAvailable={profilesAvailable}
                statLetterFilters={statLetterFilters}
                onStatLetterFilterChange={setStatLetterFilter}
              />

              <PositionPlayerPicker
                players={players}
                family={family}
                selectedId={selected.player_id}
                onSelect={setSelectedId}
                clusterMode={clusterMode}
                clusterFilters={clusterFilters}
                profilesFilter={profilesFilter}
                statLetterFilters={statLetterFilters}
                sectionGradeLookup={sectionGradeLookup}
              />
            </div>

            <PositionProfileView
              player={selected}
              family={family}
              sectionGradeLookup={sectionGradeLookup}
            />
          </>
        )}
      </div>
    </div>
  );
}
