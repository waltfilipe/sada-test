import { Suspense } from "react";
import { HubSeasonPicker, type HubData } from "@/components/HubSeasonPicker";
import { getMeta } from "@/lib/data.server";
import { LEAGUES } from "@/lib/leagues";
import { BRASILEIRAO_SEASONS, CURRENT_SEASON, INTRO_STORAGE_KEY } from "@/lib/seasons";
import type { SiteMeta } from "@/lib/types";

/**
 * Roda antes do primeiro paint: se o splash já foi visto nesta sessão, ele nem chega a aparecer.
 * `?intro=1` (logo da topbar) força o splash de novo.
 */
const INTRO_SEEN_SCRIPT = `try{var k=${JSON.stringify(INTRO_STORAGE_KEY)};if(new URLSearchParams(location.search).has("intro"))sessionStorage.removeItem(k);else if(sessionStorage.getItem(k))document.documentElement.classList.add("sada-intro-seen")}catch(e){}`;

function loadHubData(): HubData {
  const seasons: HubData["seasons"] = {};
  for (const season of BRASILEIRAO_SEASONS) {
    const leagues: HubData["seasons"][string]["leagues"] = {};
    let players = 0;
    for (const league of LEAGUES) {
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
      // est-paua2 replica o recorte do Nv2 — não conta de novo no total.
      if (league.id !== "est-paua2") players += meta.player_count;
    }
    seasons[season] = { leagues, players };
  }
  return { seasons };
}

export default function HubPage() {
  const data = loadHubData();
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: INTRO_SEEN_SCRIPT }} />
      <Suspense fallback={<div className="scout-root home-page hub-page hx" />}>
        <HubSeasonPicker data={data} />
      </Suspense>
    </>
  );
}
