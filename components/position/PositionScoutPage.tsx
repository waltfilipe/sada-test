"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { familyBySlug } from "@/lib/positions";
import { AspectBoard } from "./AspectBoard";
import { PlayerCommandRail } from "./PlayerCommandRail";
import { ProfileDna } from "./ProfileDna";
import { ScoutHero, ScoutPositionNav } from "./ScoutHero";
import { SkillIndexPanel } from "./SkillIndexPanel";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
};

export function PositionScoutPage({ family, players }: Props) {
  const [selectedId, setSelectedId] = useState(players[0]?.player_id ?? "");
  const [profilesFilter, setProfilesFilter] = useState<string[]>([]);
  const familyMeta = familyBySlug(family);

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
    return (
      <div className="scout-page empty">
        Nenhum jogador disponível para {familyMeta.label.toLowerCase()}.
      </div>
    );
  }

  return (
    <div className={`scout-page position-page position-${family}`}>
      <header className="scout-topbar">
        <div>
          <p className="scout-kicker">Scout room</p>
          <h1>{familyMeta.label}</h1>
        </div>
        <nav className="scout-topnav">
          <Link href="/filtros">Filtros</Link>
          <Link href="/comparar">Comparar</Link>
          <Link href="/scatter">Scatter</Link>
        </nav>
      </header>

      <ScoutPositionNav family={family} />

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
          <ScoutHero player={selected} poolSize={players.length} family={family} />

          <div className="scout-profile-row">
            <ProfileDna player={selected} />
            <AspectBoard player={selected} compact />
          </div>

          <SkillIndexPanel player={selected} family={family} />
        </main>
      </div>
    </div>
  );
}
