import { Suspense } from "react";
import { CompararWithQuery } from "@/app/comparar/CompararClient";
import { compactHeatmap, getFamilyPlayers, getMeta } from "@/lib/data.server";
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

export default async function CompararPage({ params }: Props) {
  const { league, family: slug } = await params;
  if (!isLeagueId(league)) notFound();
  const family = familyBySlug(slug);
  if (family.slug !== slug) notFound();
  const players = getFamilyPlayers(family.key as PositionFamily, league).map((player) => {
    const heatmap = compactHeatmap(player.heatmap);
    return heatmap === player.heatmap ? player : { ...player, heatmap };
  });
  const meta = getMeta(league);

  return (
    <Suspense fallback={<div className="scout-root" />}>
      <CompararWithQuery
        key={`${league}-${family.key}`}
        family={family.key as PositionFamily}
        players={players}
        scatterMetrics={meta.scatter_metrics[family.key] ?? []}
        heatmapsEnabled={meta.heatmaps_enabled !== false}
      />
    </Suspense>
  );
}
