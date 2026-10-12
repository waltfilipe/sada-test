import { PosicaoClient } from "@/app/posicao/[slug]/PosicaoClient";
import { getFamilyPlayers, getMeta } from "@/lib/data.server";
import { isLeagueId } from "@/lib/leagues";
import { familyBySlug } from "@/lib/positions";
import { notFound } from "next/navigation";
import type { PositionFamily } from "@/lib/types";

type Props = {
  params: Promise<{ league: string; slug: string }>;
  searchParams: Promise<{ atleta?: string; origem?: string }>;
};

export default async function PosicaoPage({ params, searchParams }: Props) {
  const { league, slug } = await params;
  if (!isLeagueId(league)) notFound();
  const family = familyBySlug(slug);
  if (!family) notFound();
  const players = getFamilyPlayers(family.key as PositionFamily, league);
  const meta = getMeta(league);
  const { atleta, origem } = await searchParams;

  return (
    <PosicaoClient
      family={family.key as PositionFamily}
      players={players}
      heatmapsEnabled={meta.heatmaps_enabled !== false}
      initialPlayerId={atleta}
      filterOrigin={origem}
    />
  );
}
