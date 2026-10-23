import { RadaresClient } from "@/app/posicao/[slug]/RadaresClient";
import { getFamilyPlayers } from "@/lib/data.server";
import { isLeagueId } from "@/lib/leagues";
import { familyBySlug } from "@/lib/positions";
import { leaguePositionStaticParams } from "@/lib/staticParams";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { PositionFamily } from "@/lib/types";

export function generateStaticParams() {
  return leaguePositionStaticParams();
}

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ league: string; slug: string }> };

export default async function RadaresPage({ params }: Props) {
  const { league, slug } = await params;
  if (!isLeagueId(league)) notFound();
  const family = familyBySlug(slug);
  if (family.slug !== slug) notFound();
  const players = getFamilyPlayers(family.key as PositionFamily, league);

  return (
    <Suspense fallback={null}>
      <RadaresClient family={family.key as PositionFamily} familyLabel={family.label} players={players} />
    </Suspense>
  );
}
