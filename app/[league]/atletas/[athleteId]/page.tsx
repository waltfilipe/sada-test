import { AthleteDetailClient } from "@/app/atletas/AthleteDetailClient";
import { athleteStaticIds, getAthleteDetail } from "@/lib/athletes.server";
import { isLeagueId, type LeagueId } from "@/lib/leagues";
import { leagueStaticParams } from "@/lib/staticParams";
import { notFound } from "next/navigation";

export const dynamicParams = true;

/** Pre-render fichas de elenco 2026; histórico 2025-only entra on-demand. */
export function generateStaticParams() {
  const leagues = leagueStaticParams();
  const params: { league: string; athleteId: string }[] = [];
  for (const entry of leagues) {
    const league = entry.league as LeagueId;
    for (const athleteId of athleteStaticIds(league)) {
      if (athleteId.startsWith("archive-")) continue;
      params.push({ league, athleteId });
    }
  }
  return params;
}

type Props = { params: Promise<{ league: string; athleteId: string }> };

export default async function AthleteDetailPage({ params }: Props) {
  const { league, athleteId } = await params;
  if (!isLeagueId(league)) notFound();
  const detail = getAthleteDetail(league, decodeURIComponent(athleteId));
  if (!detail) notFound();
  return <AthleteDetailClient detail={detail} />;
}
