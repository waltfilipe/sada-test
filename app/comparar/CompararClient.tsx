"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ComparePlayerColumn } from "@/components/compare/ComparePlayerColumn";
import { StatSectionPanel, StatWindow } from "@/components/position/profile/ScoutStatsSections";
import { PositionFamilyTabs } from "@/components/PositionFamilyTabs";
import { useLeague } from "@/components/LeagueProvider";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { useSeasonRoster } from "@/hooks/useSeasonRoster";
import { compareSummary } from "@/lib/compareNarrative";
import { familyBySlug } from "@/lib/positions";
import { resolveSeasonPlayerId } from "@/lib/seasonRosterMatch";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Metric = { key: string; label: string };

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  scatterMetrics: Metric[];
  initialA?: string;
  initialB?: string;
  initialC?: string;
  initialAName?: string;
  initialANasc?: number;
  initialBName?: string;
  initialBNasc?: number;
  initialCName?: string;
  initialCNasc?: number;
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
  players: initialPlayers,
  initialA,
  initialB,
  initialC,
  initialAName,
  initialANasc,
  initialBName,
  initialBNasc,
  initialCName,
  initialCNasc,
  initialTriple,
  heatmapsEnabled = true,
}: Props) {
  const { href } = useLeague();
  // Static props always carry the current season; in ?temporada=YYYY the family
  // roster is fetched client-side and the a=/b=/c= ids are re-resolved against it.
  const { players, season, isCurrentSeason, seasonLoading, archiveFailed, retry } =
    useSeasonRoster<PlayerProfile>({
      initial: initialPlayers,
      scope: family,
      resource: `families/${family}`,
    });
  const familyMeta = familyBySlug(family);

  const [triple, setTriple] = useState(() => Boolean(initialTriple || initialC));
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [idC, setIdC] = useState("");

  useEffect(() => {
    if (!players.length) return;
    const reference = initialPlayers;
    const first = pickPlayer(
      resolveSeasonPlayerId(players, initialA, {
        name: initialAName,
        birthYear: initialANasc,
        reference,
      }),
      players,
      new Set(),
      0,
    );
    const second = pickPlayer(
      resolveSeasonPlayerId(players, initialB, {
        name: initialBName,
        birthYear: initialBNasc,
        reference,
      }),
      players,
      new Set([first]),
      1,
    );
    const third = pickPlayer(
      resolveSeasonPlayerId(players, initialC, {
        name: initialCName,
        birthYear: initialCNasc,
        reference,
      }),
      players,
      new Set([first, second]),
      2,
    );
    setIdA(first);
    setIdB(second);
    setIdC(third);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  const playerA = players.find((p) => p.player_id === idA) ?? players[0];
  const playerB = players.find((p) => p.player_id === idB) ?? players[1] ?? players[0];
  const playerC = players.find((p) => p.player_id === idC) ?? players[2] ?? players[0];

  useEffect(() => {
    const params = new URLSearchParams();
    if (idA) params.set("a", idA);
    if (idB) params.set("b", idB);
    if (triple && idC) {
      params.set("c", idC);
      params.set("triple", "1");
    }
    const next = href(`/comparar/${family}?${params.toString()}`);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== next) window.history.replaceState(window.history.state, "", next);
  }, [family, idA, idB, idC, triple, href]);

  const excludeForA = useMemo(() => new Set(triple ? [idB, idC] : [idB]), [idB, idC, triple]);
  const excludeForB = useMemo(() => new Set(triple ? [idA, idC] : [idA]), [idA, idC, triple]);
  const excludeForC = useMemo(() => new Set([idA, idB]), [idA, idB]);

  const positionTabs = (
    <PositionFamilyTabs active={family} hrefFor={(slug) => href(`/comparar/${slug}`)} />
  );

  if (seasonLoading) {
    return (
      <div className="scout-root compare-root">
        <ScoutTopbar active="comparar" subnav={positionTabs} />
        <div className="scout-empty">
          Carregando atletas{!isCurrentSeason ? ` da temporada ${season}` : ""}…
        </div>
      </div>
    );
  }

  if (archiveFailed) {
    return (
      <div className="scout-root compare-root">
        <ScoutTopbar active="comparar" subnav={positionTabs} />
        <div className="scout-empty">
          Não foi possível carregar os atletas de {season}.{" "}
          <button type="button" className="zag-v2-retry" onClick={retry}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

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

            <Link className="btn btn-ghost btn-sm" href={href(`/scatter/${family}?a=${idA}&b=${idB}`)}>
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

export function CompararWithQuery(
  props: Omit<
    Props,
    | "initialA"
    | "initialB"
    | "initialC"
    | "initialAName"
    | "initialANasc"
    | "initialBName"
    | "initialBNasc"
    | "initialCName"
    | "initialCNasc"
    | "initialTriple"
  >,
) {
  const search = useSearchParams();
  const c = search.get("c") ?? undefined;
  const nasc = (key: string) => {
    const value = Number(search.get(`${key}_nasc`));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };
  return (
    <CompararClient
      {...props}
      initialA={search.get("a") ?? undefined}
      initialB={search.get("b") ?? undefined}
      initialC={c}
      initialAName={search.get("a_nome") ?? undefined}
      initialANasc={nasc("a")}
      initialBName={search.get("b_nome") ?? undefined}
      initialBNasc={nasc("b")}
      initialCName={search.get("c_nome") ?? undefined}
      initialCNasc={nasc("c")}
      initialTriple={search.get("triple") === "1" || Boolean(c)}
    />
  );
}
