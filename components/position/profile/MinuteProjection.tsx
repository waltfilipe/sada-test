"use client";

import { useEffect, useMemo, useState } from "react";
import { useLeague } from "@/components/LeagueProvider";
import { Tooltip } from "@/components/ui/Tooltip";
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

  return (
    <>
      <Tooltip content="Estima os números por 90 com a minutagem de um titular. Volume acima da média dos regulares é puxado para ela. Erros zerados numa amostra curta sobem em direção à média.">
        <button
          type="button"
          className={`btn btn-ghost btn-sm${open ? " is-open" : ""}`}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <i className="fa-solid fa-forward" aria-hidden="true" /> Projeção
        </button>
      </Tooltip>

      {open ? (
        <StatWindow title="Projeção realista" onClose={() => setOpen(false)}>
          {projection ? (
            <div className="projection-modal-copy">
              <p className="projection-rank">
                {projection.rank}º <span>de {projection.poolSize}</span>
              </p>
              <p className="projection-rank-meta">
                {familyLabel} · {league.name}
              </p>
              <StatSectionsBoard player={projection.profile} family={family} />
            </div>
          ) : (
            <p className="projection-empty">Amostra da posição ainda é curta para projetar.</p>
          )}
        </StatWindow>
      ) : null}
    </>
  );
}
