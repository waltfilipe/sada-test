import { FiltrosClient } from "@/app/filtros/FiltrosClient";
import { getMeta, getSearchRows } from "@/lib/data.server";
import { isLeagueId } from "@/lib/leagues";
import { leagueStaticParams } from "@/lib/staticParams";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return leagueStaticParams();
}

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ league: string }> };

export default async function FiltrosPage({ params }: Props) {
  const { league } = await params;
  if (!isLeagueId(league)) notFound();
  const meta = getMeta(league);
  const players = getSearchRows(league);
  return <FiltrosClient meta={meta} players={players} />;
}
