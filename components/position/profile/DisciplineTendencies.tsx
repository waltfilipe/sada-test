"use client";

import { useEffect, useMemo, useState } from "react";
import { ConstructionProfileBars, type TendencyBarEntry } from "@/components/position/ConstructionProfileBars";
import { useLoading } from "@/components/LoadingProvider";
import { Tooltip } from "@/components/ui/Tooltip";
import type { AspectItem, PlayerProfile } from "@/lib/types";
import { StatWindow } from "./ScoutStatsSections";

function formatPer90(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function disciplineBar(label: string, value: number, average: number): TendencyBarEntry {
  const item: AspectItem = {
    label,
    grade: "",
    stats: [],
    share_pct: value,
    pool_avg_pct: average,
    scale_max_pct: Math.max(value, average, 0.1) * 1.8,
    display_value: formatPer90(value),
  };
  return { item, displayLabel: label, valueScale: "per90", centerAverage: true };
}

export function DisciplineTendencies({ player }: { player: PlayerProfile }) {
  const [open, setOpen] = useState(false);
  const { beginLoad, endLoad } = useLoading();

  useEffect(() => {
    setOpen(false);
  }, [player.player_id]);

  const disc = player.discipline;
  const rows = useMemo<TendencyBarEntry[]>(() => {
    if (!disc) return [];
    const pool = disc.pool ?? {};
    const entries: TendencyBarEntry[] = [];
    if (disc.fouls_per90 != null && pool.fouls_per90 != null) {
      entries.push(disciplineBar("Faltas cometidas", disc.fouls_per90, pool.fouls_per90));
    }
    if (disc.yellow_per90 != null && pool.yellow_per90 != null) {
      entries.push(disciplineBar("Cartões amarelos", disc.yellow_per90, pool.yellow_per90));
    }
    if (disc.red_per90 != null && pool.red_per90 != null) {
      entries.push(disciplineBar("Cartões vermelhos", disc.red_per90, pool.red_per90));
    }
    return entries;
  }, [disc]);

  if (!disc) return null;

  const totalsText = [
    disc.fouls_total != null ? `${disc.fouls_total} faltas` : null,
    `${disc.yellow_total} amarelos`,
    `${disc.red_total} vermelhos`,
  ]
    .filter(Boolean)
    .join(" · ");

  const openModal = () => {
    beginLoad();
    setOpen(true);
    window.setTimeout(() => endLoad(), 120);
  };

  return (
    <>
      <Tooltip content={`Disciplina — ${totalsText} na temporada.`}>
        <button
          type="button"
          className={`btn btn-ghost btn-sm${open ? " is-open" : ""}`}
          aria-expanded={open}
          onClick={openModal}
        >
          <i className="fa-solid fa-flag" aria-hidden="true" /> Disciplina
        </button>
      </Tooltip>
      {open ? (
        <StatWindow title="Disciplina" onClose={() => setOpen(false)}>
          <div className="tendency-modal">
            {rows.length ? (
              <ConstructionProfileBars entries={rows} embedded />
            ) : (
              <p className="pass-tendencies-note">Sem dados de disciplina para esta temporada.</p>
            )}
            <p className="pass-tendencies-note discipline-totals">
              Temporada: {totalsText}.
            </p>
            <p className="pass-tendencies-note tendency-footnote">
              A marca central de cada barra é a média da posição nesta série. O ponto colorido é o atleta.
              Menos é melhor: pontos à esquerda indicam disciplina acima da média.
            </p>
          </div>
        </StatWindow>
      ) : null}
    </>
  );
}
