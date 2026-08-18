"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AspectVersus } from "@/components/compare/AspectVersus";
import { AthleteSlot } from "@/components/compare/AthleteSlot";
import { VersusBar } from "@/components/compare/VersusBar";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { POSITION_FAMILIES, familyBySlug } from "@/lib/positions";
import { profileMetaForFamily } from "@/lib/profileMeta";
import { TENDENCY_META, formatRating } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  initialA?: string;
  initialB?: string;
};

export function CompararClient({ family, players, initialA, initialB }: Props) {
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

  const profileMeta = profileMetaForFamily(family);

  const swap = () => {
    setIdA(idB);
    setIdB(idA);
  };

  const verdict = useMemo(() => {
    if (!a || !b) return null;
    const metrics = [
      a.ratings.geral - b.ratings.geral,
      ...TENDENCY_META.map((item) => a.tendencies[item.key] - b.tendencies[item.key]),
    ];
    const winsA = metrics.filter((value) => value > 0).length;
    const winsB = metrics.filter((value) => value < 0).length;
    return { winsA, winsB, total: metrics.length };
  }, [a, b]);

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
        <div className="compare-stage">
          <AthleteSlot side="a" player={a} players={players} onChange={setIdA} />

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

          <AthleteSlot side="b" player={b} players={players} onChange={setIdB} />
        </div>

        <section className="sc-panel compare-panel">
          <header className="sc-panel-head">
            <div>
              <p className="sc-eyebrow">Confronto direto</p>
              <h2>{family === "zagueiros" ? "Construção, defesa e fit no perfil" : "Notas por perfil"}</h2>
            </div>
            <p className="sc-note">Escala 0–10</p>
          </header>

          <div className="versus-rows">
            <VersusBar
              label="Rating geral"
              valueA={a.ratings.geral}
              valueB={b.ratings.geral}
              max={10}
              format={formatRating}
            />
            {profileMeta.map((item) => (
              <VersusBar
                key={item.key}
                label={item.label}
                valueA={a.ratings[item.key] ?? 0}
                valueB={b.ratings[item.key] ?? 0}
                max={10}
                format={formatRating}
              />
            ))}
          </div>
        </section>

        <section className="sc-panel compare-panel">
          <header className="sc-panel-head">
            <div>
              <p className="sc-eyebrow">Índices normalizados</p>
              <h2>Skill index</h2>
            </div>
            <p className="sc-note">Percentil no pool</p>
          </header>

          <div className="versus-rows">
            {TENDENCY_META.map((item) => (
              <VersusBar
                key={item.key}
                label={item.label}
                hint={item.hint}
                valueA={a.tendencies[item.key]}
                valueB={b.tendencies[item.key]}
              />
            ))}
          </div>
        </section>

        <section className="sc-panel compare-panel">
          <header className="sc-panel-head">
            <div>
              <p className="sc-eyebrow">Avaliação técnica</p>
              <h2>Aspectos de jogo</h2>
            </div>
            <p className="sc-note">Nota e medalha por fundamento</p>
          </header>

          <AspectVersus a={a} b={b} />
        </section>

        <div className="compare-links">
          <Link href={`/scatter?posicao=${family}&a=${a.player_id}&b=${b.player_id}`}>
            Ver scatter
          </Link>
          <Link href={`/posicao/${family}?atleta=${a.player_id}`}>Ver dossiê de {a.name}</Link>
          <Link href={`/posicao/${family}?atleta=${b.player_id}`}>Ver dossiê de {b.name}</Link>
        </div>
      </main>
    </div>
  );
}
