import { LeagueHomeMain } from "@/components/LeagueHomeMain";
import { isLeagueId } from "@/lib/leagues";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ league: string }> };

export default async function LeagueHomePage({ params }: Props) {
  const { league } = await params;
  if (!isLeagueId(league)) notFound();
  return <LeagueHomeMain leagueId={league} />;
}
