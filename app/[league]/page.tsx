import { isLeagueId, type LeagueId } from "@/lib/leagues";
import { leagueStaticParams } from "@/lib/staticParams";
import { notFound, redirect } from "next/navigation";

export function generateStaticParams() {
  return leagueStaticParams();
}

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ league: string }> };

export default async function LeagueHomePage({ params }: Props) {
  const { league } = await params;
  if (!isLeagueId(league)) notFound();
  redirect(`/${league as LeagueId}/posicao/zagueiros`);
}
