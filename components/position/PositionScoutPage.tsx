"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { POSITION_FAMILIES, familyBySlug } from "@/lib/positions";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { AspectMatrix } from "./AspectMatrix";
import { DossierHeader } from "./DossierHeader";
import { ProfileDna } from "./ProfileDna";
import { ProfileRatings } from "./ProfileRatings";
import { RosterRail } from "./RosterRail";
import { SkillIndexPanel } from "./SkillIndexPanel";

const LINKS = [
  { href: "/filtros", label: "Filtros" },
  { href: "/comparar", label: "Comparar" },
  { href: "/scatter", label: "Scatter" },
];

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
};

export function PositionScoutPage({ family, players }: Props) {
  const [selectedId, setSelectedId] = useState(players[0]?.player_id ?? "");
  const [profilesFilter, setProfilesFilter] = useState<string[]>([]);
  const familyMeta = familyBySlug(family);

  const selected = players.find((player) => player.player_id === selectedId) ?? players[0] ?? null;

  const poolMedian = useMemo(() => {
    if (!players.length) return 0;
    const sorted = players.map((player) => player.ratings.geral).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }, [players]);

  useEffect(() => {
    if (players.length && !players.some((player) => player.player_id === selectedId)) {
      setSelectedId(players[0].player_id);
    }
  }, [players, selectedId]);

  const toggleProfile = (profile: string) => {
    setProfilesFilter((current) =>
      current.includes(profile) ? current.filter((item) => item !== profile) : [...current, profile],
    );
  };

  return (
    <div className="scout-root">
      <header className="scout-topbar">
        <Link href="/" className="scout-brand">
          <span className="sc-brand-mark">SA</span>
          <span className="sc-brand-copy">
            <strong>Série A Scout</strong>
            <em>Temporada 2025/26</em>
          </span>
        </Link>

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

        <nav className="topbar-links" aria-label="Ferramentas">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

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
          />

          <main className="dossier">
            <DossierHeader
              player={selected}
              poolSize={players.length}
              poolMedian={poolMedian}
              family={family}
            />

            <ProfileRatings player={selected} poolSize={players.length} />

            <div className="dossier-grid">
              <ProfileDna player={selected} />
              <SkillIndexPanel player={selected} family={family} />
            </div>

            <AspectMatrix player={selected} />
          </main>
        </div>
      )}
    </div>
  );
}
