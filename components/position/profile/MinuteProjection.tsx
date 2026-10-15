"use client";

import { useEffect, useMemo, useState } from "react";
import { useLeague } from "@/components/LeagueProvider";
import { projectionPlacement, type ProjectionScenario } from "@/lib/minuteProjection";
import { familyBySlug } from "@/lib/positions";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

const SCENARIOS: { id: ProjectionScenario; label: string; hint: string }[] = [
  { id: "negativa", label: "Negativa", hint: "Piso provável" },
  { id: "realista", label: "Realista", hint: "Estimativa central" },
  { id: "positiva", label: "Positiva", hint: "Teto provável" },
];

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
};

export function MinuteProjection({ player, family, players }: Props) {
  const league = useLeague();
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<ProjectionScenario | null>(null);
  const familyLabel = familyBySlug(family).label.toLocaleLowerCase("pt-BR");

  useEffect(() => {
    setOpen(false);
    setScenario(null);
  }, [player.player_id]);

  const placement = useMemo(
    () => (scenario ? projectionPlacement(player, players, scenario) : null),
    [player, players, scenario],
  );

  const weightPct = placement ? Math.round(placement.weight * 100) : null;
  const first = player.name.trim().split(/\s+/)[0] ?? player.name;
  const shortName = first.length <= 2 || first.endsWith(".") ? player.name : first;

  return (
    <div className="projection-slot">
      <button
        type="button"
        className={`projection-launch${open ? " is-open" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Projeção
      </button>

      <div className={`projection-panel${open ? " is-open" : ""}`}>
        <div className="projection-panel-inner">
          <div className="player-card projection-card">
            <div className="profile-card-head">
              <h3 className="section-label">Cenário</h3>
            </div>
            <p className="projection-lead">
              Onde {shortName} ficaria na {league.name} com minutos de titular, no mesmo papel.
            </p>
            <div className="projection-scenarios" role="group" aria-label="Cenário da projeção">
              {SCENARIOS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`projection-scenario${scenario === item.id ? " is-selected" : ""}`}
                  aria-pressed={scenario === item.id}
                  title={item.hint}
                  onClick={() => setScenario(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {scenario ? (
              placement && weightPct != null ? (
                <div className="projection-result" aria-live="polite">
                  <p className="projection-rank">
                    {placement.rank}º <span>de {placement.poolSize}</span>
                  </p>
                  <p className="projection-rank-meta">
                    {SCENARIOS.find((item) => item.id === scenario)?.label} · {familyLabel} · {league.name}
                  </p>
                  <p className="projection-weight">
                    A amostra pesa {weightPct}%. O restante segue a média da posição.
                  </p>
                </div>
              ) : (
                <p className="projection-empty">Amostra da posição ainda é curta para projetar.</p>
              )
            ) : (
              <p className="projection-empty">Escolha negativa, realista ou positiva.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
