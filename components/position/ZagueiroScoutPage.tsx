"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AspectBoard } from "./AspectBoard";
import { PlayerCommandRail } from "./PlayerCommandRail";
import { ProfileDna } from "./ProfileDna";
import { RatingsMatrix } from "./RatingsMatrix";
import { ScoutHero } from "./ScoutHero";
import { SkillIndexPanel } from "./SkillIndexPanel";
import type { PlayerProfile } from "@/lib/types";

type Props = {
  players: PlayerProfile[];
};

export function ZagueiroScoutPage({ players }: Props) {
  const [selectedId, setSelectedId] = useState(players[0]?.player_id ?? "");
  const [profilesFilter, setProfilesFilter] = useState<string[]>([]);

  const selected =
    players.find((player) => player.player_id === selectedId) ?? players[0] ?? null;

  useEffect(() => {
    if (players.length && !players.some((p) => p.player_id === selectedId)) {
      setSelectedId(players[0].player_id);
    }
  }, [players, selectedId]);

  const toggleProfile = (profile: string) => {
    setProfilesFilter((current) =>
      current.includes(profile) ? current.filter((p) => p !== profile) : [...current, profile],
    );
  };

  if (!selected) {
    return <div className="scout-page empty">Nenhum zagueiro disponível.</div>;
  }

  return (
    <div className="scout-page zagueiros-page">
      <header className="scout-topbar">
        <div>
          <p className="scout-kicker">Scout room</p>
          <h1>Zagueiros</h1>
        </div>
        <nav className="scout-topnav">
          <Link href="/filtros">Filtros</Link>
          <Link href="/comparar">Comparar</Link>
          <Link href="/scatter">Scatter</Link>
        </nav>
      </header>

      <div className="scout-layout">
        <PlayerCommandRail
          players={players}
          selectedId={selected.player_id}
          profilesFilter={profilesFilter}
          onSelect={setSelectedId}
          onToggleProfile={toggleProfile}
          profilesAvailable={selected.profiles_available}
        />

        <main className="scout-canvas">
          <ScoutHero player={selected} poolSize={players.length} />

          <div className="scout-bento">
            <ProfileDna player={selected} />
            <RatingsMatrix player={selected} />
            <SkillIndexPanel player={selected} />
          </div>

          <AspectBoard player={selected} />
        </main>
      </div>
    </div>
  );
}
