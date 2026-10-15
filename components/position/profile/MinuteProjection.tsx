"use client";

import { useEffect, useMemo, useState } from "react";
import { useLeague } from "@/components/LeagueProvider";
import { realisticProjection } from "@/lib/minuteProjection";
import { familyBySlug } from "@/lib/positions";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { StatSectionsBoard, StatWindow } from "./ScoutStatsSections";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
};

export function MinuteProjection({ player, family, players }: Props) {
  const league = useLeague();
  const [open, setOpen] = useState(false);
  const familyLabel = familyBySlug(family).label.toLocaleLowerCase("pt-BR");

  useEffect(() => {
    setOpen(false);
  }, [player.player_id]);

  const projection = useMemo(() => realisticProjection(player, players), [player, players]);
  const weightPct = projection ? Math.round(projection.weight * 100) : null;

  return (
    <div className="projection-slot">
      <button
        type="button"
        className={`projection-launch${open ? " is-open" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Projeção
      </button>

      {open ? (
        <StatWindow title="Projeção realista" onClose={() => setOpen(false)}>
          {projection && weightPct != null ? (
            <div className="projection-modal-copy">
              <p className="projection-rank">
                {projection.rank}º <span>de {projection.poolSize}</span>
              </p>
              <p className="projection-rank-meta">
                {familyLabel} · {league.name}
              </p>
              <p className="projection-lead">
                O ranking e as barras usam só quem já passou de 50% dos minutos. Números acima da média desses atletas são puxados para ela. Números que já estão abaixo permanecem.
              </p>
              <p className="projection-weight">
                A amostra pesa {weightPct}% de um número acima da média.
              </p>
              <StatSectionsBoard player={projection.profile} family={family} />
            </div>
          ) : (
            <p className="projection-empty">Amostra da posição ainda é curta para projetar.</p>
          )}
        </StatWindow>
      ) : null}
    </div>
  );
}
