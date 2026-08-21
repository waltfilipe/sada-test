"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArchetypeVersus } from "@/components/compare/ArchetypeVersus";
import { AspectVersus } from "@/components/compare/AspectVersus";
import { AthleteSlot } from "@/components/compare/AthleteSlot";
import { ProfileBarsVersus } from "@/components/compare/ProfileBarsVersus";
import { ProfileShareVersus } from "@/components/compare/ProfileShareVersus";
import { VersusBar } from "@/components/compare/VersusBar";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { aspectGroupsForPlayers } from "@/lib/aspectGroups";
import { POSITION_FAMILIES, familyBySlug } from "@/lib/positions";
import { profileMetaForFamily } from "@/lib/profileMeta";
import { TENDENCY_META, formatRating } from "@/lib/scoutTheme";
import type { AspectItem, PlayerProfile, PositionFamily } from "@/lib/types";

type Metric = { key: string; label: string };

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  scatterMetrics: Metric[];
  initialA?: string;
  initialB?: string;
};

function aspectScore(item: AspectItem): number {
  if (item.percentile != null) return item.percentile;
  if (!item.stats.length) return 0;
  return item.stats.reduce((sum, stat) => sum + stat.percentile, 0) / item.stats.length;
}

function countVersusMetrics(a: PlayerProfile, b: PlayerProfile, family: PositionFamily) {
  const metrics: number[] = [a.ratings.geral - b.ratings.geral];

  for (const item of profileMetaForFamily(family)) {
    metrics.push((a.ratings[item.key] ?? 0) - (b.ratings[item.key] ?? 0));
  }

  for (const item of TENDENCY_META) {
    metrics.push(a.tendencies[item.key] - b.tendencies[item.key]);
  }

  for (const group of aspectGroupsForPlayers(a, b)) {
    const labels = new Set([
      ...(a.aspects[group.key] ?? []).map((row) => row.label),
      ...(b.aspects[group.key] ?? []).map((row) => row.label),
    ]);
    for (const label of labels) {
      const itemA = (a.aspects[group.key] ?? []).find((row) => row.label === label);
      const itemB = (b.aspects[group.key] ?? []).find((row) => row.label === label);
      const scoreA = itemA ? aspectScore(itemA) : -1;
      const scoreB = itemB ? aspectScore(itemB) : -1;
      if (scoreA >= 0 && scoreB >= 0) metrics.push(scoreA - scoreB);
    }
  }

  return metrics;
}

function formatScatterMetric(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(1).replace(".", ",");
  if (Math.abs(value) >= 10) return value.toFixed(2).replace(".", ",");
  return value.toFixed(2).replace(".", ",");
}

export function CompararClient({ family, players, scatterMetrics, initialA, initialB }: Props) {
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

  const profileMeta = profileMetaForFamily(family);
  const hasCluster = Boolean(a?.cluster && b?.cluster);
  const hasProfileBars =
    (a?.aspects.perfil_construcao?.length ?? 0) > 0 ||
    (b?.aspects.perfil_construcao?.length ?? 0) > 0 ||
    (a?.aspects.perfil_defensivo?.length ?? 0) > 0 ||
    (b?.aspects.perfil_defensivo?.length ?? 0) > 0;

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
              rankA={a.ranks.geral}
              rankB={b.ranks.geral}
              max={10}
              format={formatRating}
            />
            {profileMeta.map((item) => (
              <VersusBar
                key={item.key}
                label={item.label}
                valueA={a.ratings[item.key] ?? 0}
                valueB={b.ratings[item.key] ?? 0}
                rankA={a.ranks[item.key]}
                rankB={b.ranks[item.key]}
                max={10}
                format={formatRating}
              />
            ))}
          </div>
        </section>

        {hasCluster ? (
          <section className="sc-panel compare-panel">
            <header className="sc-panel-head">
              <div>
                <p className="sc-eyebrow">Arquétipos</p>
                <h2>Mix de perfil e rating por arquétipo</h2>
              </div>
              <p className="sc-note">Afinidade % · rating 0–10</p>
            </header>
            <ArchetypeVersus a={a} b={b} />
          </section>
        ) : null}

        <section className="sc-panel compare-panel">
          <header className="sc-panel-head">
            <div>
              <p className="sc-eyebrow">Fit no pool</p>
              <h2>Distribuição de perfil</h2>
            </div>
            <p className="sc-note">Share relativo no pool da posição</p>
          </header>
          <ProfileShareVersus family={family} a={a} b={b} />
        </section>

        {hasProfileBars ? (
          <section className="sc-panel compare-panel">
            <header className="sc-panel-head">
              <div>
                <p className="sc-eyebrow">Estilo de jogo</p>
                <h2>Barras de perfil técnico</h2>
              </div>
              <p className="sc-note">Ponto vs média do pool</p>
            </header>
            <div className="profile-bars-versus-grid">
              <ProfileBarsVersus title="Perfil de construção" a={a} b={b} aspectKey="perfil_construcao" />
              <ProfileBarsVersus title="Perfil defensivo" a={a} b={b} aspectKey="perfil_defensivo" />
            </div>
          </section>
        ) : null}

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

        {scatterMetrics.length ? (
          <section className="sc-panel compare-panel">
            <header className="sc-panel-head">
              <div>
                <p className="sc-eyebrow">Volume bruto</p>
                <h2>Stats por 90</h2>
              </div>
              <p className="sc-note">Métricas do scatter</p>
            </header>

            <div className="versus-rows">
              {scatterMetrics.map((metric) => {
                const valueA = a.scatter[metric.key] ?? 0;
                const valueB = b.scatter[metric.key] ?? 0;
                const max = Math.max(valueA, valueB, 1) * 1.15;
                return (
                  <VersusBar
                    key={metric.key}
                    label={metric.label}
                    valueA={valueA}
                    valueB={valueB}
                    max={max}
                    format={formatScatterMetric}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="sc-panel compare-panel">
          <header className="sc-panel-head">
            <div>
              <p className="sc-eyebrow">Avaliação técnica</p>
              <h2>Aspectos de jogo</h2>
            </div>
            <p className="sc-note">Nota, medalha e volume por fundamento</p>
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
