import { ScatterClient } from "@/app/scatter/ScatterClient";
import { getFamilyPlayers, getMeta } from "@/lib/data.server";
import { isLeagueId } from "@/lib/leagues";
import { familyBySlug } from "@/lib/positions";
import { notFound } from "next/navigation";
import type { PositionFamily } from "@/lib/types";

type Props = {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ posicao?: string; a?: string; b?: string }>;
};

export default async function ScatterPage({ params, searchParams }: Props) {
  const { league } = await params;
  if (!isLeagueId(league)) notFound();
  const { posicao, a, b } = await searchParams;
  const family = familyBySlug(posicao ?? "zagueiros");
  const players = getFamilyPlayers(family.key as PositionFamily, league).map((player) => {
    if (!player.heatmap) return player;
    const next = { ...player };
    delete next.heatmap;
    return next;
  });
  const meta = getMeta(league);

  return (
    <ScatterClient
      key={`${league}-${family.key}`}
      family={family.key as PositionFamily}
      players={players}
      metrics={meta.scatter_metrics[family.key] ?? []}
      initialA={a}
      initialB={b}
    />
  );
}
