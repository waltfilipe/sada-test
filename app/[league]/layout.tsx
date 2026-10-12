import { notFound } from "next/navigation";
import { LeagueProvider } from "@/components/LeagueProvider";
import { isLeagueId } from "@/lib/leagues";

type Props = {
  children: React.ReactNode;
  params: Promise<{ league: string }>;
};

export default async function LeagueLayout({ children, params }: Props) {
  const { league } = await params;
  if (!isLeagueId(league)) notFound();
  return <LeagueProvider leagueId={league}>{children}</LeagueProvider>;
}
