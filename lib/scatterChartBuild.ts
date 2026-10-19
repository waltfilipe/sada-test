import { scatterAxis, scatterAxisLabel } from "@/lib/scatterAxis";
import type { SavedScatterChart } from "@/lib/scatterSavedCharts";
import type { ScatterHighlight, ScatterPoint } from "@/components/scatter/ScatterPlot";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

const TONES: ScatterHighlight["tone"][] = ["a", "b", "c"];

export type BuiltScatterChart = {
  xKey: string;
  yKey: string;
  xLabel: string;
  yLabel: string;
  points: ScatterPoint[];
  avgX: number;
  avgY: number;
  highlights: ScatterHighlight[];
  highlightCount: number;
};

export function buildScatterChartView(
  saved: SavedScatterChart,
  players: PlayerProfile[],
  family: PositionFamily,
  href: (path: string) => string,
): BuiltScatterChart {
  const { xKey, yKey } = saved;
  const points = players.map((player) => ({
    player_id: player.player_id,
    label: player.name,
    name: player.name,
    club: player.club,
    href: href(`/posicao/${family}?atleta=${player.player_id}`),
    x: scatterAxis(player, xKey).value,
    y: scatterAxis(player, yKey).value,
  }));
  const avgX = points.reduce((sum, point) => sum + point.x, 0) / (points.length || 1);
  const avgY = points.reduce((sum, point) => sum + point.y, 0) / (points.length || 1);
  const highlights: ScatterHighlight[] = [];
  saved.athleteIds.forEach((id, index) => {
    if (!id || highlights.some((item) => item.id === id)) return;
    if (!players.some((player) => player.player_id === id)) return;
    highlights.push({ id, tone: TONES[index] });
  });
  return {
    xKey,
    yKey,
    xLabel: scatterAxisLabel(players, xKey),
    yLabel: scatterAxisLabel(players, yKey),
    points,
    avgX,
    avgY,
    highlights,
    highlightCount: highlights.length,
  };
}
