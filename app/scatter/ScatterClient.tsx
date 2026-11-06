"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { MetricAxisPicker } from "@/components/scatter/MetricAxisPicker";
import { ScatterSavedChartsBar } from "@/components/scatter/ScatterSavedChartsBar";
import { ScatterPlot, type ScatterHighlight } from "@/components/scatter/ScatterPlot";
import { PositionFamilyTabs } from "@/components/PositionFamilyTabs";
import { useLeague } from "@/components/LeagueProvider";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { useSeasonRoster } from "@/hooks/useSeasonRoster";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { isProjectionEligible, realisticProjection } from "@/lib/minuteProjection";
import { familyBySlug } from "@/lib/positions";
import { resolveSeasonPlayerId } from "@/lib/seasonRosterMatch";
import { leaguePath } from "@/lib/leagues";
import { BRASILEIRAO_SEASONS, CURRENT_SEASON, isBrasileiraoLeague, withSeasonQuery } from "@/lib/seasons";
import { familySectionStats, scatterAxis, scatterAxisLabel } from "@/lib/scatterAxis";
import {
  newSavedChartId,
  readSavedScatterCharts,
  writeSavedScatterCharts,
  type SavedScatterChart,
} from "@/lib/scatterSavedCharts";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Metric = { key: string; label: string; section?: string };
type Tone = ScatterHighlight["tone"];

function normName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Nome da métrica sem o sufixo "/90" — sempre completo, nunca cortado. */
function shortLabel(label: string): string {
  return label.split("/")[0]?.trim() || label;
}

function deltaText(value: number, avg: number): string {
  const d = value - avg;
  const formatted = Math.abs(d).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return d >= 0 ? `+${formatted}` : `−${formatted}`;
}

function ShapeMark({ tone }: { tone: Tone }) {
  return (
    <svg viewBox="0 0 14 14" className={`sc-shape sc-shape-${tone}`} aria-hidden>
      {tone === "b" ? (
        <circle cx="7" cy="7" r="5.4" />
      ) : tone === "c" ? (
        <rect x="1.8" y="1.8" width="10.4" height="10.4" rx="1.6" />
      ) : (
        <rect x="2.6" y="2.6" width="8.8" height="8.8" transform="rotate(45 7 7)" />
      )}
    </svg>
  );
}

type SlotCardProps = {
  tone: Tone;
  ordinal: string;
  player: PlayerProfile | null;
  dossierHref?: string;
  xShort: string;
  yShort: string;
  xVal?: number;
  yVal?: number;
  outOfFilter?: boolean;
  avgX: number;
  avgY: number;
  options: PlayerProfile[];
  onPick: (id: string) => void;
  onClear: () => void;
};

function ScatterSlotCard({ tone, ordinal, player, dossierHref, xShort, yShort, xVal, yVal, outOfFilter, avgX, avgY, options, onPick, onClear }: SlotCardProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = normName(query.trim());
    const pool = q
      ? options.filter((p) => normName(`${p.name} ${p.club}`).includes(q))
      : options;
    return pool.slice(0, 8);
  }, [options, query]);

  useEffect(() => {
    if (player) {
      setOpen(false);
      setQuery("");
    }
  }, [player]);

  if (!player) {
    return (
      <div className={`sc-card sc-card-empty side-${tone}`}>
        {open ? (
          <div className="sc-search">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
              placeholder="Buscar atleta ou clube…"
              aria-label={`Buscar ${ordinal} atleta`}
            />
            <ul className="sc-search-results">
              {results.map((option) => (
                <li key={option.player_id}>
                  <button type="button" onClick={() => onPick(option.player_id)}>
                    <span>{option.name}</span>
                    <em>{option.club}</em>
                  </button>
                </li>
              ))}
              {!results.length ? <li className="sc-search-none">Nenhum atleta</li> : null}
            </ul>
          </div>
        ) : (
          <button type="button" className="sc-add" onClick={() => setOpen(true)}>
            <i className="fa-solid fa-plus" aria-hidden /> Adicionar {ordinal} atleta
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`sc-card side-${tone}`}>
      <ShapeMark tone={tone} />
      {dossierHref ? (
        <Link href={dossierHref} className="sc-card-photo" aria-label={`Abrir dossiê de ${player.name}`}>
          {player.transfermarkt?.photo ? (
            <PlayerPhoto src={player.transfermarkt.photo} alt="" />
          ) : (
            <span className="sc-card-initials">{playerInitials(player.name)}</span>
          )}
        </Link>
      ) : (
        <span className="sc-card-photo">
          {player.transfermarkt?.photo ? (
            <PlayerPhoto src={player.transfermarkt.photo} alt="" />
          ) : (
            <span className="sc-card-initials">{playerInitials(player.name)}</span>
          )}
        </span>
      )}
      <div className="sc-card-body">
        <strong>{player.name}</strong>
        <span className="sc-card-meta">
          <ClubLogo club={player.display_club ?? player.club} size={13} />
          {player.display_club ?? player.club} · {player.position}
        </span>
        {outOfFilter ? (
          <span className="sc-card-values">
            <span>Abaixo do filtro de minutos</span>
          </span>
        ) : (
          <span className="sc-card-values">
            <span className="sc-card-value">
              <b>{xVal != null ? formatMetric(xVal) : "—"}</b>
              <small>{xShort}</small>
              <em>{xVal != null ? deltaText(xVal, avgX) : ""}</em>
            </span>
            <span className="sc-card-value">
              <b>{yVal != null ? formatMetric(yVal) : "—"}</b>
              <small>{yShort}</small>
              <em>{yVal != null ? deltaText(yVal, avgY) : ""}</em>
            </span>
          </span>
        )}
      </div>
      <button type="button" className="sc-card-remove" onClick={onClear} aria-label={`Remover ${player.name}`}>
        <i className="fa-solid fa-xmark" aria-hidden />
      </button>
    </div>
  );
}

/** Linha do atleta numa temporada somada — guarda as passagens para a média ponderada. */
type MergedPlayer = PlayerProfile & {
  __rows: { player: PlayerProfile; season: string }[];
  __repSeason: string;
  /** Id real do perfil da temporada exibida (links/API) — `player_id` pode ter sufixo anti-colisão. */
  __repId: string;
  __merged: boolean;
};

function personKey(player: {
  name: string;
  birth_year?: number | null;
  athlete_id?: string | null;
}): string {
  // athlete_id é o join canônico do registro (athletes.json); sem ele, cai no
  // heurístico local de nome+ano — linhas fora do grafo não têm id garantido.
  return player.athlete_id ?? `${normName(player.name)}|${player.birth_year ?? 0}`;
}

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  metrics: Metric[];
  /** Temporadas arquivadas com dados desta família nesta liga (ex.: ["2025","2024"]). */
  extraSeasons?: string[];
  /** Temporadas pré-selecionadas vindas da URL (`?temporadas=2026,2025`). */
  initialSeasons?: string[];
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

export function ScatterClient({
  family,
  players: initialPlayers,
  metrics,
  extraSeasons = [],
  initialSeasons,
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
  const { href, leagueId, name: leagueName } = useLeague();
  // Static props always carry the current season; in ?temporada=YYYY the family
  // roster is fetched client-side and the a=/b=/c= ids are re-resolved against it.
  const { players, season, isCurrentSeason, seasonLoading, archiveFailed, retry } =
    useSeasonRoster<PlayerProfile>({
      initial: initialPlayers,
      scope: family,
      resource: `families/${family}`,
    });
  const rootRef = useRef<HTMLDivElement>(null);

  // — Somar temporadas: pool une as temporadas marcadas; quem está em mais de
  // uma entra com a média ponderada pelos minutos de cada ano. —
  const seasonOptions = useMemo(() => {
    if (!isBrasileiraoLeague(leagueId)) return [] as string[];
    return [...new Set([CURRENT_SEASON, season, ...extraSeasons])].sort((a, b) => Number(b) - Number(a));
  }, [leagueId, season, extraSeasons]);
  const [pickedSeasons, setPickedSeasons] = useState<ReadonlySet<string>>(
    () => new Set(initialSeasons?.length ? initialSeasons : [season]),
  );
  const [extraRosters, setExtraRosters] = useState<Record<string, PlayerProfile[]>>({});
  const [rosterStatus, setRosterStatus] = useState<Record<string, "loading" | "error" | "ok">>({});
  const seasonRef = useRef(season);
  /** Dedupe de fetch por ano — resposta atrasada é idempotente, não precisa cancelar. */
  const requestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (seasonRef.current === season) return;
    seasonRef.current = season;
    setPickedSeasons(new Set(initialSeasons?.length ? initialSeasons : [season]));
    setExtraRosters({});
    setRosterStatus({});
    requestedRef.current = new Set();
  }, [season, initialSeasons]);

  useEffect(() => {
    for (const year of pickedSeasons) {
      if (year === season || requestedRef.current.has(year)) continue;
      requestedRef.current.add(year);
      setRosterStatus((s) => ({ ...s, [year]: "loading" }));
      fetch(`/api/families/${family}?league=${leagueId}&season=${year}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((payload: { players?: PlayerProfile[] }) => {
          setExtraRosters((map) => ({ ...map, [year]: payload.players ?? [] }));
          setRosterStatus((s) => ({ ...s, [year]: "ok" }));
        })
        .catch(() => {
          requestedRef.current.delete(year);
          setRosterStatus((s) => ({ ...s, [year]: "error" }));
        });
    }
  }, [pickedSeasons, season, family, leagueId]);

  const toggleSeason = useCallback(
    (year: string) => {
      setPickedSeasons((prev) => {
        if (prev.has(year)) {
          if (prev.size === 1) return prev;
          const next = new Set(prev);
          next.delete(year);
          return next;
        }
        const next = new Set(prev);
        next.add(year);
        return next;
      });
    },
    [],
  );

  const retrySeason = useCallback((year: string) => {
    requestedRef.current.delete(year);
    setExtraRosters((map) => {
      const next = { ...map };
      delete next[year];
      return next;
    });
    setRosterStatus((s) => {
      const next = { ...s };
      delete next[year];
      return next;
    });
  }, []);

  const multiSeason = pickedSeasons.size > 1;

  const poolPlayers = useMemo<MergedPlayer[]>(() => {
    const groups = new Map<string, { player: PlayerProfile; season: string }[]>();
    const push = (roster: PlayerProfile[], year: string) => {
      for (const player of roster) {
        const key = personKey(player);
        const group = groups.get(key) ?? [];
        group.push({ player, season: year });
        groups.set(key, group);
      }
    };
    if (pickedSeasons.has(season)) push(players, season);
    for (const year of pickedSeasons) {
      if (year === season) continue;
      const roster = extraRosters[year];
      if (roster) push(roster, year);
    }
    const merged: MergedPlayer[] = [];
    const usedIds = new Set<string>();
    for (const rows of groups.values()) {
      rows.sort((a, b) => Number(b.season) - Number(a.season));
      const rep = rows[0]!;
      // ids são por temporada (slug posicional): a mesma string pode ser pessoas
      // diferentes em anos distintos — sufixa colisões para não repetir key/id.
      let displayId = rep.player.player_id;
      if (usedIds.has(displayId)) displayId = `${rep.player.player_id}#${rep.season}`;
      usedIds.add(displayId);
      merged.push({
        ...rep.player,
        player_id: displayId,
        minutes: rows.reduce((sum, row) => sum + (row.player.minutes || 0), 0),
        __rows: rows,
        __repSeason: rep.season,
        __repId: rep.player.player_id,
        __merged: rows.length > 1,
      });
    }
    return merged;
  }, [players, season, pickedSeasons, extraRosters]);

  /** Eixo somado: média dos valores por-90 de cada temporada, peso = minutos daquele ano. */
  const axisValueOf = useCallback((merged: MergedPlayer, key: string): number => {
    if (!merged.__merged) return scatterAxis(merged, key).value;
    let num = 0;
    let den = 0;
    for (const row of merged.__rows) {
      const weight = Math.max(0, row.player.minutes || 0);
      num += scatterAxis(row.player, key).value * weight;
      den += weight;
    }
    return den > 0 ? num / den : scatterAxis(merged, key).value;
  }, []);

  const dossierHrefFor = useCallback(
    (merged: MergedPlayer) =>
      isBrasileiraoLeague(leagueId)
        ? withSeasonQuery(leaguePath(leagueId, `/posicao/${family}?atleta=${merged.__repId}`), merged.__repSeason)
        : href(`/posicao/${family}?atleta=${merged.__repId}`),
    [leagueId, family, href],
  );
  const familyMeta = familyBySlug(family);
  // Eixos = mesmas stats permenorizadas das seções da página de posição
  // (certos/90; gols/assist/xG/xA como totais). Deriva do pool → sempre o
  // conjunto exato que a página mostra para aquela posição.
  const axisMetrics = useMemo(() => {
    const map = new Map<string, Metric>();
    const seenLabels = new Set<string>();
    for (const player of poolPlayers) {
      for (const stat of familySectionStats(player, family)) {
        // Scatter só plota volumes — eficiência/score não agrega ao gráfico.
        if (stat.kind === "efficiency" || stat.kind === "score") continue;
        // Dedupe pelo rótulo exibido: chaves distintas podem convergir para o
        // mesmo label (ex.: "Duelos Defensivos/90" via item e sub-métrica).
        const labelKey = stat.label.toLowerCase();
        if (map.has(stat.key) || seenLabels.has(labelKey)) continue;
        seenLabels.add(labelKey);
        map.set(stat.key, { key: stat.key, label: stat.label, section: stat.section });
      }
    }
    const list = [...map.values()];
    return list.length ? list : positionMetrics(family);
  }, [poolPlayers, family]);

  const defaultX = axisMetrics[0]?.key ?? "intervencoes";
  const defaultY = axisMetrics[1]?.key ?? axisMetrics[0]?.key ?? "confrontos_of";

  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [idC, setIdC] = useState("");

  useEffect(() => {
    if (!poolPlayers.length) return;
    const reference = initialPlayers;
    const a =
      initialA === ""
        ? ""
        : (resolveSeasonPlayerId(poolPlayers, initialA, {
            name: initialAName,
            birthYear: initialANasc,
            reference,
          }) ??
          poolPlayers[0]?.player_id ??
          "");
    let b = "";
    if (initialB !== "") {
      b =
        resolveSeasonPlayerId(poolPlayers, initialB, {
          name: initialBName,
          birthYear: initialBNasc,
          reference,
        }) ??
        poolPlayers[1]?.player_id ??
        "";
      if (b === a) b = poolPlayers.find((player) => player.player_id !== a)?.player_id ?? "";
    }
    const c = initialC
      ? resolveSeasonPlayerId(poolPlayers, initialC, {
          name: initialCName,
          birthYear: initialCNasc,
          reference,
        }) ?? ""
      : "";
    setIdA(a);
    setIdB(b);
    setIdC(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolPlayers]);
  const axisKeyValid = (key: string | undefined, other?: string) =>
    Boolean(key) &&
    key !== other &&
    key!
      .split("||")
      .every((part) => axisMetrics.some((metric) => metric.key === part));
  const [xKey, setXKey] = useState(() => (axisKeyValid(initialX, initialY) ? initialX! : defaultX));
  const [yKey, setYKey] = useState(() =>
    axisKeyValid(initialY, initialX) ? initialY! : (axisMetrics.find((metric) => metric.key !== defaultX)?.key ?? defaultY),
  );
  const [savedCharts, setSavedCharts] = useState<SavedScatterChart[]>([]);
  const [minMinutes, setMinMinutes] = useState(0); // minutos absolutos (ex.: 450 min)
  const [useProjection, setUseProjection] = useState(false);

  useEffect(() => {
    setSavedCharts(readSavedScatterCharts(leagueId, family));
  }, [leagueId, family]);

  const slotIds = [idA, idB, idC];
  const athleteIds = useMemo(() => [idA, idB, idC] as [string, string, string], [idA, idB, idC]);
  const selected = useMemo(() => {
    const seen = new Set<string>();
    const rows: { id: string; tone: Tone; player: MergedPlayer }[] = [];
    [idA, idB, idC].forEach((id, index) => {
      if (!id || seen.has(id)) return;
      const player = poolPlayers.find((item) => item.player_id === id);
      if (!player) return;
      seen.add(id);
      rows.push({ id, tone: TONES[index], player });
    });
    return rows;
  }, [idA, idB, idC, poolPlayers]);

  const maxMinutes = useMemo(
    () => Math.max(90, ...poolPlayers.map((player) => player.minutes)),
    [poolPlayers],
  );

  const visiblePlayers = useMemo(
    () => poolPlayers.filter((player) => player.minutes >= minMinutes),
    [poolPlayers, minMinutes],
  );

  const projectedCount = useMemo(
    () => (multiSeason ? 0 : poolPlayers.filter(isProjectionEligible).length),
    [poolPlayers, multiSeason],
  );

  const projectionById = useMemo(() => {
    const map = new Map<string, PlayerProfile>();
    if (!useProjection || multiSeason) return map;
    for (const player of poolPlayers) {
      map.set(player.player_id, realisticProjection(player, poolPlayers)?.profile ?? player);
    }
    return map;
  }, [poolPlayers, useProjection, multiSeason]);

  const points = useMemo(
    () =>
      visiblePlayers.map((player) => {
        const source = projectionById.get(player.player_id);
        return {
          player_id: player.player_id,
          label: player.name,
          name: player.name,
          club: player.club,
          href: dossierHrefFor(player),
          x: source ? scatterAxis(source, xKey).value : axisValueOf(player, xKey),
          y: source ? scatterAxis(source, yKey).value : axisValueOf(player, yKey),
          minutes: player.minutes,
        };
      }),
    [visiblePlayers, projectionById, xKey, yKey, dossierHrefFor, axisValueOf],
  );

  const avgX = useMemo(
    () => points.reduce((sum, point) => sum + point.x, 0) / (points.length || 1),
    [points],
  );
  const avgY = useMemo(
    () => points.reduce((sum, point) => sum + point.y, 0) / (points.length || 1),
    [points],
  );

  const xLabel = scatterAxisLabel(poolPlayers, xKey);
  const yLabel = scatterAxisLabel(poolPlayers, yKey);
  const highlights = selected.map((slot) => ({ id: slot.id, tone: slot.tone }));

  const quickRead = useMemo(() => {
    const rows = selected
      .map((slot) => ({ slot, point: points.find((p) => p.player_id === slot.id) }))
      .filter((row): row is { slot: (typeof selected)[number]; point: (typeof points)[number] } => Boolean(row.point));
    if (!rows.length) return null;
    const topX = rows.reduce((best, row) => (row.point.x > best.point.x ? row : best));
    const topY = rows.reduce((best, row) => (row.point.y > best.point.y ? row : best));
    const aboveBoth = rows.filter((row) => row.point.x >= avgX && row.point.y >= avgY);
    return { topX, topY, aboveBoth };
  }, [selected, points, avgX, avgY]);

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
    return poolPlayers.filter((player) => !taken.has(player.player_id));
  };

  const pickedSeasonsLabel = useMemo(
    () => [...pickedSeasons].sort((a, b) => Number(b) - Number(a)).join(" + "),
    [pickedSeasons],
  );

  // Projeção EB é um modelo de temporada única — não se aplica ao pool somado.
  useEffect(() => {
    if (multiSeason) setUseProjection(false);
  }, [multiSeason]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("a", idA);
    params.set("b", idB);
    params.set("c", idC);
    params.set("x", xKey);
    params.set("y", yKey);
    if (multiSeason) params.set("temporadas", [...pickedSeasons].sort((a, b) => Number(b) - Number(a)).join(","));
    const next = href(`/scatter/${family}?${params.toString()}`);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== next) window.history.replaceState(window.history.state, "", next);
  }, [family, idA, idB, idC, xKey, yKey, href, multiSeason, pickedSeasons]);

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

  if (!poolPlayers.length) {
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
        <div className="scatter-context">
          <h1>
            {familyMeta.label} <i aria-hidden>|</i> {leagueName} {season}
          </h1>
          <div className="scatter-context-chips">
            {multiSeason ? (
              <span className="sc-chip">Temporadas {pickedSeasonsLabel}</span>
            ) : (
              <span className="sc-chip">Temporada {season}</span>
            )}
            <span className="sc-chip">{leagueName}</span>
            <span className="sc-chip">{familyMeta.label}</span>
            <span className="sc-chip is-count">
              {visiblePlayers.length} de {poolPlayers.length} atletas
            </span>
            {minMinutes > 0 ? <span className="sc-chip">Mín. {minMinutes} min</span> : null}
          </div>
        </div>

        <ScatterSavedChartsBar
          family={family}
          players={poolPlayers}
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
                  <p className="sc-eyebrow">Filtros</p>
                  <h2>Pool do gráfico</h2>
                </div>
                <p className="sc-note">
                  {visiblePlayers.length} de {poolPlayers.length}
                </p>
              </header>

              <div className="scatter-controls scatter-controls-top">
                <label className="scatter-minutes">
                  <span>
                    Minutos mínimos <b>{minMinutes} min</b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={maxMinutes}
                    step={90}
                    value={minMinutes}
                    onChange={(event) => setMinMinutes(Number(event.target.value))}
                    aria-label="Filtro de minutos mínimos"
                  />
                </label>
                {seasonOptions.length > 1 ? (
                  <div className="scatter-seasons">
                    <span className="scatter-seasons-label">Somar temporadas</span>
                    <div className="scatter-season-chips" role="group" aria-label="Temporadas somadas">
                      {seasonOptions.map((year) => {
                        const on = pickedSeasons.has(year);
                        const loading = rosterStatus[year] === "loading";
                        const failed = rosterStatus[year] === "error";
                        const lastOn = on && pickedSeasons.size === 1;
                        return (
                          <button
                            key={year}
                            type="button"
                            className={`scatter-season-chip${on ? " is-on" : ""}${failed ? " is-error" : ""}`}
                            aria-pressed={on}
                            disabled={lastOn || loading}
                            title={
                              failed
                                ? "Falha ao carregar — clique para tentar de novo"
                                : lastOn
                                  ? "Ao menos uma temporada fica marcada"
                                  : undefined
                            }
                            onClick={() => (failed ? retrySeason(year) : toggleSeason(year))}
                          >
                            {year}
                            {loading ? "…" : ""}
                          </button>
                        );
                      })}
                    </div>
                    {multiSeason ? (
                      <p className="scatter-seasons-note">
                        Quem jogou em mais de uma temporada entra com a média ponderada pelos
                        minutos de cada ano.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {!multiSeason ? (
                  <>
                    <button
                      type="button"
                      className={`scatter-proj-toggle${useProjection ? " on" : ""}`}
                      onClick={() => setUseProjection((value) => !value)}
                      aria-pressed={useProjection}
                    >
                      <i className="fa-solid fa-chart-line" aria-hidden />{" "}
                      {useProjection ? "Projeção EB ativa" : "Projetar reservas (EB)"}
                    </button>
                    {useProjection ? (
                      <p className="scatter-proj-note">
                        {projectedCount} reserva(s) projetados por EB + histórico; titulares mantêm
                        o valor atual.
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </section>

            <section className="sc-panel scatter-panel scatter-athletes-panel">
              <header className="sc-panel-head">
                <div>
                  <p className="sc-eyebrow">Atletas</p>
                  <h2>{selected.length} de 3 em destaque</h2>
                </div>
              </header>
              <div className="sc-card-list">
                {([idA, idB, idC] as const).map((id, index) => {
                  const tone = TONES[index]!;
                  const player = poolPlayers.find((item) => item.player_id === id) ?? null;
                  const point = id ? points.find((item) => item.player_id === id) : undefined;
                  const setId = index === 0 ? setIdA : index === 1 ? setIdB : setIdC;
                  return (
                    <ScatterSlotCard
                      key={tone}
                      tone={tone}
                      ordinal={`${index + 1}º`}
                      player={player}
                      dossierHref={player ? dossierHrefFor(player) : undefined}
                      xShort={shortLabel(xLabel)}
                      yShort={shortLabel(yLabel)}
                      xVal={point?.x}
                      yVal={point?.y}
                      outOfFilter={Boolean(player && !point)}
                      avgX={avgX}
                      avgY={avgY}
                      options={optionsFor(id)}
                      onPick={setId}
                      onClear={() => setId("")}
                    />
                  );
                })}
              </div>
            </section>

            {quickRead ? (
              <section className="sc-panel scatter-panel scatter-read">
                <header className="sc-panel-head">
                  <div>
                    <p className="sc-eyebrow">Leitura rápida</p>
                  </div>
                </header>
                <p>
                  <b>{quickRead.topX.slot.player.name}</b> lidera {shortLabel(xLabel)} (
                  {formatMetric(quickRead.topX.point.x)}) e <b>{quickRead.topY.slot.player.name}</b>{" "}
                  lidera {shortLabel(yLabel)} ({formatMetric(quickRead.topY.point.y)}) entre os
                  selecionados.
                </p>
                <p>
                  {quickRead.aboveBoth.length
                    ? `${quickRead.aboveBoth.map((row) => row.slot.player.name).join(" e ")} acima da média nos dois eixos.`
                    : "Nenhum selecionado acima da média nos dois eixos."}
                </p>
              </section>
            ) : null}
          </aside>

          <section className="scatter-map" aria-label="Mapa de dispersão">
            <div className="scatter-axisbar">
              <span className="scatter-axisbar-tag">X</span>
              <MetricAxisPicker
                bare
                axis="x"
                metrics={axisMetrics}
                groups={statSectionsForFamily(family)}
                value={xKey}
                otherValue={yKey}
                onChange={setXKey}
                onSwap={swapAxes}
              />
              <button
                type="button"
                className="axis-swap"
                onClick={swapAxes}
                title="Trocar eixos X e Y"
                aria-label="Trocar eixos X e Y"
              >
                ⇄
              </button>
              <span className="scatter-axisbar-tag">Y</span>
              <MetricAxisPicker
                bare
                axis="y"
                metrics={axisMetrics}
                groups={statSectionsForFamily(family)}
                value={yKey}
                otherValue={xKey}
                onChange={setYKey}
                onSwap={swapAxes}
              />
            </div>
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

        <section className="scatter-guide">
          <h2>Como ler este gráfico</h2>
          <p>
            Cada ponto é um atleta da posição. Os eixos usam o número por 90 minutos. Se a métrica tem
            aproveitamento, entra o que deu certo: duelos e disputas vencidos, dribles com sucesso, passes,
            cruzamentos e finalizações certas. Sem eficiência, o eixo mostra o próprio dado, como condução
            progressiva e pré-assistências.
          </p>
          <p>
            Passe o mouse em um ponto para ver jogador, clube, valores e percentil. Clique para abrir o
            dossiê. Até três atletas podem ser destacados; cada cartão usa a mesma cor e forma (losango,
            círculo ou quadrado) do marcador no gráfico. As linhas tracejadas marcam a média do grupo.
            {multiSeason
              ? " Com temporadas somadas, o ponto reúne os anos marcados: atleta em mais de uma temporada entra com a média ponderada pelos minutos de cada ano."
              : ""}
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
    | "initialSeasons"
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
      initialSeasons={
        search
          .get("temporadas")
          ?.split(",")
          .map((value) => value.trim())
          .filter((value) => (BRASILEIRAO_SEASONS as readonly string[]).includes(value))
      }
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
