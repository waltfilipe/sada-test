import { Suspense } from "react";
import { ScatterWithQuery } from "@/app/scatter/ScatterClient";
import { getFamilyPlayers, getMeta } from "@/lib/data.server";
import { isLeagueId } from "@/lib/leagues";
import { familyBySlug } from "@/lib/positions";
import { leagueFamilyStaticParams } from "@/lib/staticParams";
import { notFound } from "next/navigation";
import type { PositionFamily } from "@/lib/types";

export function generateStaticParams() {
  return leagueFamilyStaticParams();
}

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ league: string; family: string }> };

export default async function ScatterPage({ params }: Props) {
  const { league, family: slug } = await params;
  if (!isLeagueId(league)) notFound();
  const family = familyBySlug(slug);
  if (family.slug !== slug) notFound();
  const players = getFamilyPlayers(family.key as PositionFamily, league).map((player) => {
    if (!player.heatmap) return player;
    const next = { ...player };
    delete next.heatmap;
    return next;
  });
  const meta = getMeta(league);

  return (
    <Suspense fallback={<div className="scout-root" />}>
      <ScatterWithQuery
        key={`${league}-${family.key}`}
        family={family.key as PositionFamily}
        players={players}
        metrics={meta.scatter_metrics[family.key] ?? []}
      />
    </Suspense>
  );
}
