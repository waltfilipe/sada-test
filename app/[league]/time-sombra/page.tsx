import { TimeSombraClient } from "@/app/time-sombra/TimeSombraClient";
import { getSearchRows } from "@/lib/data.server";
import { isLeagueId, LEAGUES, type LeagueId } from "@/lib/leagues";
import type { PlayerSearchRow } from "@/lib/types";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ league: string }> };

function squadRows(league: LeagueId): PlayerSearchRow[] {
  return getSearchRows(league).map((player) => ({ ...player, heatmap: undefined }));
}

export default async function TimeSombraPage({ params }: Props) {
  const { league } = await params;
  if (!isLeagueId(league)) notFound();
  const playersByLeague = Object.fromEntries(LEAGUES.map((item) => [item.id, squadRows(item.id)])) as Record<
    LeagueId,
    PlayerSearchRow[]
  >;
  return <TimeSombraClient playersByLeague={playersByLeague} />;
}
