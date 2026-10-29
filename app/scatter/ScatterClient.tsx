"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AthleteSlot } from "@/components/compare/AthleteSlot";
import { MetricAxisPicker } from "@/components/scatter/MetricAxisPicker";
import { ScatterSavedChartsBar } from "@/components/scatter/ScatterSavedChartsBar";
import { ScatterPlot, type ScatterHighlight } from "@/components/scatter/ScatterPlot";
import { PositionFamilyTabs } from "@/components/PositionFamilyTabs";
import { useLeague } from "@/components/LeagueProvider";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { useSeasonRoster } from "@/hooks/useSeasonRoster";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { familyBySlug } from "@/lib/positions";
import { resolveSeasonPlayerId } from "@/lib/seasonRosterMatch";
import { scatterAxis, scatterAxisLabel } from "@/lib/scatterAxis";
import {
  newSavedChartId,
  readSavedScatterCharts,
  writeSavedScatterCharts,
  type SavedScatterChart,
} from "@/lib/scatterSavedCharts";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Metric = { key: string; label: string };
type Tone = ScatterHighlight["tone"];

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  metrics: Metric[];
  initialA?: string;
  initialB?: string;
  initialC?: string;
  initialAName?: string;
  initialANasc?: number;
  initialBName?: string;
  initialBNasc?: number;
  initialCName?: string;
  initialCNasc?: number;
  initialX?: string;
  initialY?: string;
};

const TONES: Tone[] = ["a", "b", "c"];

function positionMetrics(family: PositionFamily): Metric[] {
  const labels = statSectionsForFamily(family).flatMap((section) => section.labels);
  return [...new Set(labels)].map((label) => ({ key: label, label }));
}

function formatMetric(value: number): string {
  const digits = Math.abs(value) >= 10 ? 1 : Math.abs(value) >= 1 ? 1 : 2;
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function quadrantLabel(
  x: number,
  y: number,
  avgX: number,
  avgY: number,
  xLabel: string,
  yLabel: string,
): string {
  const highX = x >= avgX;
  const highY = y >= avgY;
  if (highX && highY) return `Quadrante Alto em ${xLabel} e ${yLabel}`;
  if (highY) return `Quadrante Alto em ${yLabel}`;
  if (highX) return `Quadrante Alto em ${xLabel}`;
  return `Abaixo da média em ${xLabel} e ${yLabel}`;
}

export function ScatterClient({
  family,
  players: initialPlayers,
  metrics,
  initialA,
  initialB,
  initialC,
  initialAName,
  initialANasc,
  initialBName,
  initialBNasc,
  initialCName,
  initialCNasc,
  initialX,
  initialY,
}: Props) {
  const { href, leagueId } = useLeague();
  // Static props always carry the current season; in ?temporada=YYYY the family
  // roster is fetched client-side and the a=/b=/c= ids are re-resolved against it.
  const { players, season, isCurrentSeason, seasonLoading, archiveFailed, retry } =
    useSeasonRoster<PlayerProfile>({
      initial: initialPlayers,
      scope: family,
      resource: `families/${family}`,
    });
  const rootRef = useRef<HTMLDivElement>(null);
  const familyMeta = familyBySlug(family);
  const axisMetrics = useMemo(() => {
    const fromPosition = positionMetrics(family);
    return fromPosition.length ? fromPosition : metrics;
  }, [family, metrics]);

  const defaultX = axisMetrics[0]?.key ?? "intervencoes";
  const defaultY = axisMetrics[1]?.key ?? axisMetrics[0]?.key ?? "confrontos_of";

  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [idC, setIdC] = useState("");

  useEffect(() => {
    if (!players.length) return;
    const reference = initialPlayers;
    const a =
      initialA === ""
        ? ""
        : (resolveSeasonPlayerId(players, initialA, {
            name: initialAName,
            birthYear: initialANasc,
            reference,
          }) ??
          players[0]?.player_id ??
          "");
    let b = "";
    if (initialB !== "") {
      b =
        resolveSeasonPlayerId(players, initialB, {
          name: initialBName,
          birthYear: initialBNasc,
          reference,
        }) ??
        players[1]?.player_id ??
        "";
      if (b === a) b = players.find((player) => player.player_id !== a)?.player_id ?? "";
    }
    const c = initialC
      ? resolveSeasonPlayerId(players, initialC, {
          name: initialCName,
          birthYear: initialCNasc,
          reference,
        }) ?? ""
      : "";
    setIdA(a);
    setIdB(b);
    setIdC(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);
  const [xKey, setXKey] = useState(() => {
    if (initialX && axisMetrics.some((metric) => metric.key === initialX && metric.key !== initialY)) {
      return initialX;
    }
    return defaultX;
  });
  const [yKey, setYKey] = useState(() => {
    if (initialY && axisMetrics.some((metric) => metric.key === initialY && metric.key !== initialX)) {
      return initialY;
    }
    return axisMetrics.find((metric) => metric.key !== defaultX)?.key ?? defaultY;
  });
  const [savedCharts, setSavedCharts] = useState<SavedScatterChart[]>([]);

  useEffect(() => {
    setSavedCharts(readSavedScatterCharts(leagueId, family));
  }, [leagueId, family]);

  const slotIds = [idA, idB, idC];
  const athleteIds = useMemo(() => [idA, idB, idC] as [string, string, string], [idA, idB, idC]);
  const selected = useMemo(() => {
    const seen = new Set<string>();
    const rows: { id: string; tone: Tone; player: PlayerProfile }[] = [];
    [idA, idB, idC].forEach((id, index) => {
      if (!id || seen.has(id)) return;
      const player = players.find((item) => item.player_id === id);
      if (!player) return;
      seen.add(id);
      rows.push({ id, tone: TONES[index], player });
    });
    return rows;
  }, [idA, idB, idC, players]);

  const points = useMemo(
    () =>
      players.map((player) => ({
        player_id: player.player_id,
        label: player.name,
        name: player.name,
        club: player.club,
        href: href(`/posicao/${family}?atleta=${player.player_id}`),
        x: scatterAxis(player, xKey).value,
        y: scatterAxis(player, yKey).value,
      })),
    [players, xKey, yKey, href, family],
  );

  const avgX = useMemo(
    () => points.reduce((sum, point) => sum + point.x, 0) / (points.length || 1),
    [points],
  );
  const avgY = useMemo(
    () => points.reduce((sum, point) => sum + point.y, 0) / (points.length || 1),
    [points],
  );

  const xLabel = scatterAxisLabel(players, xKey);
  const yLabel = scatterAxisLabel(players, yKey);
  const highlights = selected.map((slot) => ({ id: slot.id, tone: slot.tone }));

  const swapAxes = () => {
    setXKey(yKey);
    setYKey(xKey);
  };

  const persistSaved = (next: SavedScatterChart[]) => {
    setSavedCharts(writeSavedScatterCharts(leagueId, family, next));
  };

  const saveCurrentChart = () => {
    const entry: SavedScatterChart = {
      id: newSavedChartId(),
      xKey,
      yKey,
      athleteIds,
      savedAt: Date.now(),
    };
    persistSaved([...savedCharts, entry]);
  };

  const removeSavedChart = (id: string) => {
    persistSaved(savedCharts.filter((chart) => chart.id !== id));
  };

  const optionsFor = (current: string) => {
    const taken = new Set(slotIds.filter((id) => id && id !== current));
    return players.filter((player) => !taken.has(player.player_id));
  };

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("a", idA);
    params.set("b", idB);
    params.set("c", idC);
    params.set("x", xKey);
    params.set("y", yKey);
    const next = href(`/scatter/${family}?${params.toString()}`);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== next) window.history.replaceState(window.history.state, "", next);
  }, [family, idA, idB, idC, xKey, yKey, href]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const fit = () => {
      const topbar = root.querySelector(".scout-topbar-wrap");
      const canvas = root.querySelector(".scatter-canvas");
      const top = topbar?.getBoundingClientRect().height ?? 0;
      const pad = canvas ? parseFloat(getComputedStyle(canvas).paddingTop) || 0 : 0;
      root.style.setProperty("--scatter-chrome", `${Math.ceil(top + pad + 6)}px`);
    };
    fit();
    const observer = new ResizeObserver(fit);
    const topbar = root.querySelector(".scout-topbar-wrap");
    if (topbar) observer.observe(topbar);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  const positionTabs = (
    <PositionFamilyTabs active={family} hrefFor={(slug) => href(`/scatter/${slug}`)} />
  );

  if (seasonLoading) {
    return (
      <div className="scout-root scatter-root" ref={rootRef}>
        <ScoutTopbar active="scatter" subnav={positionTabs} />
        <div className="scout-empty">
          Carregando atletas{!isCurrentSeason ? ` da temporada ${season}` : ""}…
        </div>
      </div>
    );
  }

  if (archiveFailed) {
    return (
      <div className="scout-root scatter-root" ref={rootRef}>
        <ScoutTopbar active="scatter" subnav={positionTabs} />
        <div className="scout-empty">
          Não foi possível carregar os atletas de {season}.{" "}
          <button type="button" className="zag-v2-retry" onClick={retry}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (!players.length) {
    return (
      <div className="scout-root scatter-root" ref={rootRef}>
        <ScoutTopbar active="scatter" subnav={positionTabs} />
        <div className="scout-empty">Nenhum atleta disponível para {familyMeta.label.toLowerCase()}.</div>
      </div>
    );
  }

  const compareQuery = new URLSearchParams();
  if (selected[0]) compareQuery.set("a", selected[0].id);
  if (selected[1]) compareQuery.set("b", selected[1].id);

  return (
    <div className="scout-root scatter-root" ref={rootRef}>
      <ScoutTopbar active="scatter" subnav={positionTabs} />

      <main className="scatter-canvas">
        <ScatterSavedChartsBar
          family={family}
          players={players}
          savedCharts={savedCharts}
          xKey={xKey}
          yKey={yKey}
          athleteIds={athleteIds}
          onSave={saveCurrentChart}
          onRemove={removeSavedChart}
        />

        <div className="scatter-workspace">
          <aside className="scatter-rail" aria-label="Atletas em destaque">
            <section className="sc-panel scatter-panel scatter-axis-panel">
              <header className="sc-panel-head">
                <div>
                  <p className="sc-eyebrow">Configuração</p>
                  <h2>Eixos do gráfico</h2>
                </div>
                <p className="sc-note">{players.length} atletas</p>
              </header>

              <MetricAxisPicker
                axis="x"
                metrics={axisMetrics}
                groups={statSectionsForFamily(family)}
                value={xKey}
                otherValue={yKey}
                plottedLabel={xLabel}
                onChange={setXKey}
                onSwap={swapAxes}
              />
              <MetricAxisPicker
                axis="y"
                metrics={axisMetrics}
                groups={statSectionsForFamily(family)}
                value={yKey}
                otherValue={xKey}
                plottedLabel={yLabel}
                onChange={setYKey}
                onSwap={swapAxes}
              />
            </section>

            <div className="scatter-slots">
              <AthleteSlot
                compact
                allowEmpty
                side="a"
                player={players.find((player) => player.player_id === idA) ?? null}
                players={optionsFor(idA)}
                onChange={setIdA}
              />
              <AthleteSlot
                compact
                allowEmpty
                side="b"
                player={players.find((player) => player.player_id === idB) ?? null}
                players={optionsFor(idB)}
                onChange={setIdB}
              />
              <AthleteSlot
                compact
                allowEmpty
                side="c"
                player={players.find((player) => player.player_id === idC) ?? null}
                players={optionsFor(idC)}
                onChange={setIdC}
              />
            </div>

            <div className="scatter-rail-extra">
              <section className="sc-panel scatter-panel scatter-legend">
                <header className="sc-panel-head">
                  <div>
                    <p className="sc-eyebrow">Leitura</p>
                    <h2>Legenda</h2>
                  </div>
                </header>
                <ul className="legend-list">
                  <li>
                    <i className="lg lg-a" aria-hidden />
                    <span>Atleta 1</span>
                  </li>
                  <li>
                    <i className="lg lg-b" aria-hidden />
                    <span>Atleta 2</span>
                  </li>
                  <li>
                    <i className="lg lg-c" aria-hidden />
                    <span>Atleta 3</span>
                  </li>
                  <li>
                    <i className="lg lg-pool" aria-hidden />
                    <span>Pool da posição</span>
                  </li>
                  <li>
                    <i className="lg lg-avg" aria-hidden />
                    <span>Média do grupo</span>
                  </li>
                </ul>
              </section>
            </div>
          </aside>

          <section className="scatter-map" aria-label="Mapa de dispersão">
            <ScatterPlot
              points={points}
              avgX={avgX}
              avgY={avgY}
              highlights={highlights}
              xLabel={xLabel}
              yLabel={yLabel}
            />
          </section>
        </div>

        {selected.length > 0 && (
          <div className="scatter-stats">
            {selected.map((slot, index) => {
              const point = points.find((item) => item.player_id === slot.id);
              if (!point) return null;
              return (
                <article key={slot.tone} className={`scatter-stat side-${slot.tone}`}>
                  <p className="scatter-stat-line">
                    <span>Atleta {index + 1}</span>{" "}
                    {quadrantLabel(point.x, point.y, avgX, avgY, xLabel, yLabel)}
                  </p>
                  <strong className="scatter-stat-name">{slot.player.name}</strong>
                  <p className="scatter-stat-values">
                    <span>
                      {xLabel} <b>{formatMetric(point.x)}</b>
                    </span>
                    <span>
                      {yLabel} <b>{formatMetric(point.y)}</b>
                    </span>
                  </p>
                </article>
              );
            })}
          </div>
        )}

        <section className="scatter-guide">
          <h2>Como ler este gráfico</h2>
          <p>
            Cada ponto é um atleta da posição. Os eixos usam o número por 90 minutos. Se a métrica tem
            aproveitamento, entra o que deu certo: duelos e disputas vencidos, dribles com sucesso, passes,
            cruzamentos e finalizações certas. Sem eficiência, o eixo mostra o próprio dado, como condução
            progressiva e pré-assistências.
          </p>
          <p>
            Passe o mouse em um ponto para ver o jogador e o clube. Clique para abrir o dossiê. Dá para
            destacar um, dois ou três atletas ao mesmo tempo; o restante do grupo continua no gráfico, mais
            discreto. As linhas tracejadas marcam a média.
          </p>
          <div className="scatter-links">
            <Link href={href(`/comparar/${family}?${compareQuery.toString()}`)}>Comparar atletas</Link>
            {selected.map((slot) => (
              <Link key={slot.id} href={href(`/posicao/${family}?atleta=${slot.id}`)}>
                Dossiê de {slot.player.name}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export function ScatterWithQuery(
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
    | "initialX"
    | "initialY"
  >,
) {
  const search = useSearchParams();
  const nasc = (key: string) => {
    const value = Number(search.get(`${key}_nasc`));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };
  return (
    <ScatterClient
      {...props}
      initialA={search.get("a") ?? undefined}
      initialB={search.get("b") ?? undefined}
      initialC={search.get("c") ?? undefined}
      initialAName={search.get("a_nome") ?? undefined}
      initialANasc={nasc("a")}
      initialBName={search.get("b_nome") ?? undefined}
      initialBNasc={nasc("b")}
      initialCName={search.get("c_nome") ?? undefined}
      initialCNasc={nasc("c")}
      initialX={search.get("x") ?? undefined}
      initialY={search.get("y") ?? undefined}
    />
  );
}
