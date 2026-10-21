"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { useLeague } from "@/components/LeagueProvider";
import type { AthleteListItem } from "@/lib/athletes.types";
import { playerInitials } from "@/lib/scoutTheme";

type Props = {
  athletes: AthleteListItem[];
};

export function AthletesClient({ athletes }: Props) {
  const { href } = useLeague();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.club.toLowerCase().includes(q) ||
        item.position.toLowerCase().includes(q),
    );
  }, [athletes, query]);

  return (
    <>
      <ScoutTopbar active="atletas" />
      <main className="athletes-page">
        <header className="athletes-page-head">
          <h1>Atletas</h1>
          <p>
            Ficha resumida por jogador. Temporada <strong>2026</strong> usa o dossiê do scout;{" "}
            <strong>2025</strong> vem dos exports Wyscout (Série A, B e C).
          </p>
        </header>

        <div className="athletes-toolbar">
          <input
            className="athletes-search"
            type="search"
            placeholder="Buscar por nome, clube ou posição…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar atletas"
          />
          <span className="similar-cross-hint tabular">{filtered.length} atletas</span>
        </div>

        <div className="athletes-grid">
          {filtered.map((item) => (
            <Link key={item.athlete_id} href={href(`/atletas/${encodeURIComponent(item.athlete_id)}`)} className="athlete-card">
              <PlayerPhoto
                src={item.photo}
                alt=""
                className="athlete-card-photo"
                fallback={
                  <span className="athlete-card-photo athlete-card-photo-fallback">{playerInitials(item.name)}</span>
                }
              />
              <span>
                <span className="athlete-card-name">{item.name}</span>
                <span className="athlete-card-meta">
                  {item.club} · {item.position}
                  {item.rating != null ? ` · ${item.rating.toFixed(1)}` : ""}
                  {item.minutes != null ? ` · ${item.minutes} min` : ""}
                </span>
                <span className="athlete-card-seasons">
                  {item.seasons.map((season) => (
                    <span key={`${season.season}-${season.league}`} className="athlete-season-chip">
                      {season.season}
                    </span>
                  ))}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
