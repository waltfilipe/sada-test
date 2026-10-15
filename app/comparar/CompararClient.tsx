"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ComparePlayerColumn } from "@/components/compare/ComparePlayerColumn";
import { StatSectionPanel, StatWindow } from "@/components/position/profile/ScoutStatsSections";
import { PositionFamilyTabs } from "@/components/PositionFamilyTabs";
import { useLeague } from "@/components/LeagueProvider";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { compareSummary } from "@/lib/compareNarrative";
import { familyBySlug } from "@/lib/positions";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Metric = { key: string; label: string };

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  scatterMetrics: Metric[];
  initialA?: string;
  initialB?: string;
  initialC?: string;
  initialTriple?: boolean;
  heatmapsEnabled?: boolean;
};

function pickPlayer(
  requested: string | undefined,
  players: PlayerProfile[],
  exclude: Set<string>,
  fallbackIndex: number,
): string {
  if (requested && players.some((p) => p.player_id === requested) && !exclude.has(requested)) {
    return requested;
  }
  const available = players.find((p, index) => index >= fallbackIndex && !exclude.has(p.player_id));
  if (available) return available.player_id;
  return players.find((p) => !exclude.has(p.player_id))?.player_id ?? players[0]?.player_id ?? "";
}

export function CompararClient({
  family,
  players,
  initialA,
  initialB,
  initialC,
  initialTriple,
  heatmapsEnabled = true,
}: Props) {
  const { href } = useLeague();
  const familyMeta = familyBySlug(family);

  const [triple, setTriple] = useState(() => Boolean(initialTriple || initialC));
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [idA, setIdA] = useState(() => pickPlayer(initialA, players, new Set(), 0));
  const [idB, setIdB] = useState(() => {
    const first = pickPlayer(initialA, players, new Set(), 0);
    return pickPlayer(initialB, players, new Set([first]), 1);
  });
  const [idC, setIdC] = useState(() => {
    const first = pickPlayer(initialA, players, new Set(), 0);
    const second = pickPlayer(initialB, players, new Set([first]), 1);
    return pickPlayer(initialC, players, new Set([first, second]), 2);
  });

  const playerA = players.find((p) => p.player_id === idA) ?? players[0];
  const playerB = players.find((p) => p.player_id === idB) ?? players[1] ?? players[0];
  const playerC = players.find((p) => p.player_id === idC) ?? players[2] ?? players[0];

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("posicao", family);
    if (idA) params.set("a", idA);
    if (idB) params.set("b", idB);
    if (triple && idC) {
      params.set("c", idC);
      params.set("triple", "1");
    }
    const next = href(`/comparar?${params.toString()}`);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== next) window.history.replaceState(window.history.state, "", next);
  }, [family, idA, idB, idC, triple, href]);

  const excludeForA = useMemo(() => new Set(triple ? [idB, idC] : [idB]), [idB, idC, triple]);
  const excludeForB = useMemo(() => new Set(triple ? [idA, idC] : [idA]), [idA, idC, triple]);
  const excludeForC = useMemo(() => new Set([idA, idB]), [idA, idB]);

  const positionTabs = (
    <PositionFamilyTabs active={family} hrefFor={(slug) => href(`/comparar?posicao=${slug}`)} />
  );

  if (!playerA || !playerB || players.length < 2) {
    return (
      <div className="scout-root compare-root">
        <ScoutTopbar active="comparar" subnav={positionTabs} />
        <div className="scout-empty">Nenhum atleta disponível para {familyMeta.label.toLowerCase()}.</div>
      </div>
    );
  }

  const toggleTriple = () => {
    if (triple) {
      setTriple(false);
      return;
    }
    if (players.length < 3) return;
    setIdC((current) => pickPlayer(current, players, new Set([idA, idB]), 2));
    setTriple(true);
  };

  return (
    <div className="scout-root compare-root">
        <ScoutTopbar active="comparar" subnav={positionTabs} />

      <main className="compare-canvas">
        <div className="compare-toolbar">
          <div className="compare-toolbar-copy">
            <h1 className="compare-toolbar-title">Comparar atletas</h1>
            <p className="compare-toolbar-sub">{familyMeta.label} · lado a lado</p>
          </div>

          <div className="compare-toolbar-actions">
            {players.length >= 3 ? (
              <button
                type="button"
                className={`btn btn-ghost btn-sm compare-triple-toggle${triple ? " is-active" : ""}`}
                onClick={toggleTriple}
                aria-pressed={triple}
              >
                <i className={`fa-solid ${triple ? "fa-user-minus" : "fa-user-plus"}`} aria-hidden="true" />
                {triple ? "Voltar a 2 jogadores" : "Comparar 3 jogadores"}
              </button>
            ) : null}

            <Link className="btn btn-ghost btn-sm" href={href(`/scatter?posicao=${family}&a=${idA}&b=${idB}`)}>
              <i className="fa-solid fa-chart-scatter" aria-hidden="true" /> Scatter
            </Link>
          </div>
        </div>

        <div className={`compare-player-columns${triple ? " is-triple" : ""}`}>
          <ComparePlayerColumn
            side="a"
            label="Atleta 1"
            player={playerA}
            players={players}
            family={family}
            pool={players}
            excludeIds={excludeForA}
            onChange={setIdA}
            activeSection={openSection}
            onSectionChange={setOpenSection}
            peers={triple && playerC ? [playerB, playerC] : [playerB]}
            heatmapsEnabled={heatmapsEnabled}
          />

          <ComparePlayerColumn
            side="b"
            label="Atleta 2"
            player={playerB}
            players={players}
            family={family}
            pool={players}
            excludeIds={excludeForB}
            onChange={setIdB}
            activeSection={openSection}
            onSectionChange={setOpenSection}
            peers={triple && playerC ? [playerA, playerC] : [playerA]}
            heatmapsEnabled={heatmapsEnabled}
          />

          {triple && playerC ? (
            <ComparePlayerColumn
              side="c"
              label="Atleta 3"
              player={playerC}
              players={players}
              family={family}
              pool={players}
              excludeIds={excludeForC}
              onChange={setIdC}
              activeSection={openSection}
              onSectionChange={setOpenSection}
              peers={[playerA, playerB]}
              heatmapsEnabled={heatmapsEnabled}
            />
          ) : null}
        </div>

        <section className="compare-brief player-card">
          <h2 className="section-label">Resumo</h2>
          <p>{compareSummary(triple && playerC ? [playerA, playerB, playerC] : [playerA, playerB], family)}</p>
        </section>

        {openSection ? (
          <StatWindow title={openSection} onClose={() => setOpenSection(null)}>
            <div className={`stat-window-grid${triple ? " is-triple" : ""}`}>
              <StatSectionPanel
                player={playerA}
                family={family}
                title={openSection}
                heading={playerA.name}
                peers={triple && playerC ? [playerB, playerC] : [playerB]}
              />
              <StatSectionPanel
                player={playerB}
                family={family}
                title={openSection}
                heading={playerB.name}
                peers={triple && playerC ? [playerA, playerC] : [playerA]}
              />
              {triple && playerC ? (
                <StatSectionPanel
                  player={playerC}
                  family={family}
                  title={openSection}
                  heading={playerC.name}
                  peers={[playerA, playerB]}
                />
              ) : null}
            </div>
          </StatWindow>
        ) : null}
      </main>
    </div>
  );
}
