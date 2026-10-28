import { Suspense } from "react";
import { HubSeasonPicker, type HubData } from "@/components/HubSeasonPicker";
import { getMeta } from "@/lib/data.server";
import { BRASILEIRAO_LEAGUES, LEAGUES } from "@/lib/leagues";
import { BRASILEIRAO_SEASONS, CURRENT_SEASON } from "@/lib/seasons";
import type { SiteMeta } from "@/lib/types";

function loadHubData(): HubData {
  const seasons: HubData["seasons"] = {};
  for (const season of BRASILEIRAO_SEASONS) {
    const leagues: HubData["seasons"][string]["leagues"] = {};
    let players = 0;
    for (const league of season === CURRENT_SEASON ? LEAGUES : BRASILEIRAO_LEAGUES) {
      let meta: SiteMeta;
      try {
        meta = getMeta(league.id, season);
      } catch {
        continue;
      }
      leagues[league.id] = {
        players: meta.player_count,
        families: Object.fromEntries(meta.families.map((family) => [family.key, family.count])),
      };
      players += meta.player_count;
    }
    seasons[season] = { leagues, players };
  }
  return { seasons };
}

export default function HubPage() {
  const data = loadHubData();
  return (
    <Suspense fallback={<div className="scout-root home-page hub-page hx" />}>
      <HubSeasonPicker data={data} />
    </Suspense>
  );
}
