import { TimeSombraClient } from "@/app/time-sombra/TimeSombraClient";
import { getSearchRows } from "@/lib/data.server";
import { isLeagueId } from "@/lib/leagues";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ league: string }> };

export default async function TimeSombraPage({ params }: Props) {
  const { league } = await params;
  if (!isLeagueId(league)) notFound();
  const players = getSearchRows(league);
  return <TimeSombraClient players={players} />;
}
