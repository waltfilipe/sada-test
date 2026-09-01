"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CompareAthleteHero } from "@/components/compare/CompareAthleteHero";
import { CompareProfilePair } from "@/components/compare/CompareProfilePair";
import { CompareStatsSections } from "@/components/compare/CompareStatsSections";
import { ProfileBarsVersus } from "@/components/compare/ProfileBarsVersus";
import { VersusBar } from "@/components/compare/VersusBar";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { POSITION_FAMILIES, familyBySlug } from "@/lib/positions";
import { buildSectionGradeLookup, playerSectionScore } from "@/lib/sectionGrades";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { formatRating } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Metric = { key: string; label: string };

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  scatterMetrics: Metric[];
  initialA?: string;
  initialB?: string;
};

function countVersusMetrics(a: PlayerProfile, b: PlayerProfile, family: PositionFamily) {
  const metrics: number[] = [a.ratings.geral - b.ratings.geral];

  const sections = statSectionsForFamily(family);
  for (const section of sections) {
    const scoreA = playerSectionScore(a, family, section.title);
    const scoreB = playerSectionScore(b, family, section.title);
    if (scoreA != null && scoreB != null) metrics.push(scoreA - scoreB);
  }

  if (a.cluster && b.cluster) {
    const archetypes = Object.keys(a.cluster.shares);
    for (const key of archetypes) {
      const shareA = a.cluster.shares[key as keyof typeof a.cluster.shares] ?? 0;
      const shareB = b.cluster.shares[key as keyof typeof b.cluster.shares] ?? 0;
      const ratingA = a.cluster.ratings[key as keyof typeof a.cluster.ratings] ?? 0;
      const ratingB = b.cluster.ratings[key as keyof typeof b.cluster.ratings] ?? 0;
      metrics.push(shareA - shareB, ratingA - ratingB);
    }
  }

  return metrics;
}

export function CompararClient({ family, players, initialA, initialB }: Props) {
  const router = useRouter();
  const familyMeta = familyBySlug(family);

  const pick = (requested: string | undefined, fallbackIndex: number) => {
    if (requested && players.some((player) => player.player_id === requested)) return requested;
    return players[fallbackIndex]?.player_id ?? players[0]?.player_id ?? "";
  };

  const [idA, setIdA] = useState(() => pick(initialA, 0));
  const [idB, setIdB] = useState(() => {
    const chosen = pick(initialB, 1);
    const first = pick(initialA, 0);
    if (chosen !== first) return chosen;
    return players.find((player) => player.player_id !== first)?.player_id ?? chosen;
  });

  const a = players.find((player) => player.player_id === idA) ?? players[0];
  const b = players.find((player) => player.player_id === idB) ?? players[1] ?? players[0];

  const sectionGradeLookup = useMemo(() => buildSectionGradeLookup(players, family), [players, family]);

  const hasProfileBars =
    (a?.aspects.perfil_construcao?.length ?? 0) > 0 ||
    (b?.aspects.perfil_construcao?.length ?? 0) > 0 ||
    (a?.aspects.perfil_defensivo?.length ?? 0) > 0 ||
    (b?.aspects.perfil_defensivo?.length ?? 0) > 0;

  const hasCluster = Boolean(a?.cluster && b?.cluster);

  const swap = () => {
    setIdA(idB);
    setIdB(idA);
  };

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("posicao", family);
    if (idA) params.set("a", idA);
    if (idB) params.set("b", idB);
    router.replace(`/comparar?${params.toString()}`, { scroll: false });
  }, [family, idA, idB, router]);

  const verdict = useMemo(() => {
    if (!a || !b) return null;
    const metrics = countVersusMetrics(a, b, family);
    const winsA = metrics.filter((value) => value > 0).length;
    const winsB = metrics.filter((value) => value < 0).length;
    return { winsA, winsB, total: metrics.length };
  }, [a, b, family]);

  const positionTabs = (
    <nav className="position-tabs" aria-label="Posições">
      {POSITION_FAMILIES.map((item) => (
        <Link
          key={item.key}
          href={`/comparar?posicao=${item.slug}`}
          className={item.key === family ? "active" : ""}
          aria-current={item.key === family ? "page" : undefined}
        >
          <span className="tab-full">{item.label}</span>
          <span className="tab-short">{item.short}</span>
        </Link>
      ))}
    </nav>
  );

  if (!a || !b) {
    return (
      <div className="scout-root compare-root">
        <ScoutTopbar active="comparar" center={positionTabs} />
        <div className="scout-empty">Nenhum atleta disponível para {familyMeta.label.toLowerCase()}.</div>
      </div>
    );
  }

  return (
    <div className="scout-root compare-root">
      <ScoutTopbar active="comparar" center={positionTabs} />

      <main className="compare-canvas">
        <header className="compare-page-head">
          <div>
            <p className="sc-eyebrow">Comparação</p>
            <h1>{familyMeta.label}</h1>
            <p className="compare-page-sub">{players.length} atletas · Série A 2025/26</p>
          </div>
        </header>

        <div className="compare-stage">
          <CompareAthleteHero side="a" player={a} players={players} family={family} onChange={setIdA} />

          <div className="compare-pivot">
            <span className="pivot-mark">VS</span>
            {verdict && (
              <p className="pivot-score">
                <b className="side-a">{verdict.winsA}</b>
                <i aria-hidden>–</i>
                <b className="side-b">{verdict.winsB}</b>
              </p>
            )}
            <span className="pivot-note">de {verdict?.total ?? 0} indicadores</span>
            <button type="button" className="pivot-swap" onClick={swap}>
              Inverter
            </button>
          </div>

          <CompareAthleteHero side="b" player={b} players={players} family={family} onChange={setIdB} />
        </div>

        <section className="sc-panel compare-panel compare-rating-panel">
          <header className="sc-panel-head">
            <div>
              <p className="sc-eyebrow">Confronto direto</p>
              <h2>Rating Geral</h2>
            </div>
            <p className="sc-note">Escala 0–10</p>
          </header>
          <div className="versus-rows">
            <VersusBar
              label="Rating geral"
              valueA={a.ratings.geral}
              valueB={b.ratings.geral}
              rankA={a.ranks.geral}
              rankB={b.ranks.geral}
              max={10}
              format={formatRating}
            />
          </div>
        </section>

        {hasCluster ? (
          <section className="compare-section-block">
            <header className="compare-section-head">
              <div>
                <p className="sc-eyebrow">Perfil</p>
                <h2>Afinidade com arquétipos</h2>
              </div>
              <p className="sc-note">Share % · rating por eixo</p>
            </header>
            <CompareProfilePair playerA={a} playerB={b} family={family} />
          </section>
        ) : null}

        <section className="compare-section-block">
          <CompareStatsSections
            playerA={a}
            playerB={b}
            family={family}
            sectionGradeLookup={sectionGradeLookup}
          />
        </section>

        {hasProfileBars ? (
          <section className="sc-panel compare-panel">
            <header className="sc-panel-head">
              <div>
                <p className="sc-eyebrow">Tendências de jogo</p>
                <h2>Estilo de construção e defesa</h2>
              </div>
              <p className="sc-note">Ponto vs média do pool</p>
            </header>
            <div className="profile-bars-versus-grid">
              <ProfileBarsVersus title="Construção" a={a} b={b} aspectKey="perfil_construcao" />
              <ProfileBarsVersus title="Defensivo" a={a} b={b} aspectKey="perfil_defensivo" />
            </div>
          </section>
        ) : null}

        <div className="compare-links">
          <Link href={`/scatter?posicao=${family}&a=${a.player_id}&b=${b.player_id}`}>Ver scatter</Link>
          <Link href={`/posicao/${family}?atleta=${a.player_id}`}>Perfil de {a.name}</Link>
          <Link href={`/posicao/${family}?atleta=${b.player_id}`}>Perfil de {b.name}</Link>
        </div>
      </main>
    </div>
  );
}
