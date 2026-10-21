import { AthletesClient } from "@/app/atletas/AthletesClient";
import { getAthleteList } from "@/lib/athletes.server";
import { isLeagueId } from "@/lib/leagues";
import { leagueStaticParams } from "@/lib/staticParams";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return leagueStaticParams();
}

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ league: string }> };

export default async function AthletesPage({ params }: Props) {
  const { league } = await params;
  if (!isLeagueId(league)) notFound();
  const athletes = getAthleteList(league);
  return <AthletesClient athletes={athletes} />;
}
