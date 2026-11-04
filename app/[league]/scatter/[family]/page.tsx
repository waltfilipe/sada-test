import { Suspense } from "react";
import fs from "node:fs";
import path from "node:path";
import { ScatterWithQuery } from "@/app/scatter/ScatterClient";
import { getFamilyPlayers, getMeta } from "@/lib/data.server";
import { isLeagueId } from "@/lib/leagues";
import { familyBySlug } from "@/lib/positions";
import { BRASILEIRAO_SEASONS, CURRENT_SEASON } from "@/lib/seasons";
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

  // Temporadas arquivadas com dados desta família — alimentam o "somar temporadas".
  const extraSeasons = BRASILEIRAO_SEASONS.filter(
    (year) =>
      year !== CURRENT_SEASON &&
      fs.existsSync(
        path.join(process.cwd(), "data", league, "seasons", year, `family-${family.key}.json`),
      ),
  );

  return (
    <Suspense fallback={<div className="scout-root" />}>
      <ScatterWithQuery
        key={`${league}-${family.key}`}
        family={family.key as PositionFamily}
        players={players}
        metrics={meta.scatter_metrics[family.key] ?? []}
        extraSeasons={extraSeasons}
      />
    </Suspense>
  );
}
