"use client";

import { useEffect, useMemo, useState } from "react";
import { RadarChart, ScatterPlot } from "@/components/Charts";
import { AspectPanel, PlayerIdentityCard } from "@/components/PlayerCards";
import { formatRating, ratingColor } from "@/lib/positions";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
};

export function CompararClient({ family, players }: Props) {
  const [playerA, setPlayerA] = useState(players[0]?.player_id ?? "");
  const [playerB, setPlayerB] = useState(players[1]?.player_id ?? players[0]?.player_id ?? "");

  const a = players.find((p) => p.player_id === playerA) ?? players[0];
  const b = players.find((p) => p.player_id === playerB) ?? players[1] ?? players[0];

  useEffect(() => {
    if (!players.length) return;
    if (!players.some((p) => p.player_id === playerA)) setPlayerA(players[0].player_id);
    if (!players.some((p) => p.player_id === playerB)) setPlayerB(players[1]?.player_id ?? players[0].player_id);
  }, [players, playerA, playerB]);

  const tendencyLabels = ["1vs1 - Defensivo", "Ofensividade", "Construção", "Contenção", "Duelo Aéreo"];
  const tendencyKeys = ["def1v1", "ofensividade", "construcao", "contencao", "duelo_aereo"] as const;

  const radarA = useMemo(
    () => tendencyKeys.map((key) => a.tendencies[key]),
    [a],
  );
  const radarB = useMemo(
    () => tendencyKeys.map((key) => b.tendencies[key]),
    [b],
  );

  if (!a || !b) {
    return <div className="page"><p className="muted">Selecione jogadores para comparar.</p></div>;
  }

  return (
    <div className="page compare-page">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">Comparação direta</p>
          <h1>Atletas na mesma posição</h1>
        </div>
      </header>

      <div className="compare-layout">
        <section className="panel compare-side">
          <label>
            Atleta 1
            <select value={a.player_id} onChange={(e) => setPlayerA(e.target.value)}>
              {players.map((player) => (
                <option key={player.player_id} value={player.player_id}>{player.label}</option>
              ))}
            </select>
          </label>
          <PlayerIdentityCard player={a} />
          <div className="compare-rating" style={{ color: ratingColor(a.ratings.geral) }}>
            <span>Rating Geral</span>
            <strong>{formatRating(a.ratings.geral)}</strong>
          </div>
          <AspectPanel title="Aspectos Defensivos" items={a.aspects.defensivos} />
          <AspectPanel title="Aspectos de Construção" items={a.aspects.construcao} />
          <AspectPanel title="Aspectos Ofensivos" items={a.aspects.ofensivos} />
        </section>

        <section className="panel compare-center">
          <h3>Gráficos de radar</h3>
          <div className="compare-radar-block">
            <p>Tendências</p>
            <div className="dual-radar">
              <RadarChart labels={tendencyLabels} values={radarA} color="#34d399" />
              <RadarChart labels={tendencyLabels} values={radarB} color="#a78bfa" />
            </div>
          </div>
          <div className="compare-radar-block">
            <p>Perfil</p>
            <div className="dual-radar">
              <RadarChart
                labels={["Combativo", "Posicional", "Construtor"]}
                values={[a.profile_shares.combativo, a.profile_shares.posicional, a.profile_shares.construtor]}
                color="#34d399"
              />
              <RadarChart
                labels={["Combativo", "Posicional", "Construtor"]}
                values={[b.profile_shares.combativo, b.profile_shares.posicional, b.profile_shares.construtor]}
                color="#a78bfa"
              />
            </div>
          </div>
        </section>

        <section className="panel compare-side">
          <label>
            Atleta 2
            <select value={b.player_id} onChange={(e) => setPlayerB(e.target.value)}>
              {players.map((player) => (
                <option key={player.player_id} value={player.player_id}>{player.label}</option>
              ))}
            </select>
          </label>
          <PlayerIdentityCard player={b} />
          <div className="compare-rating" style={{ color: ratingColor(b.ratings.geral) }}>
            <span>Rating Geral</span>
            <strong>{formatRating(b.ratings.geral)}</strong>
          </div>
          <AspectPanel title="Aspectos Defensivos" items={b.aspects.defensivos} />
          <AspectPanel title="Aspectos de Construção" items={b.aspects.construcao} />
          <AspectPanel title="Aspectos Ofensivos" items={b.aspects.ofensivos} />
        </section>
      </div>
    </div>
  );
}
