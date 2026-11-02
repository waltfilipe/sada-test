import { Suspense } from "react";
import { HubSeasonPicker, type HubAthlete, type HubData } from "@/components/HubSeasonPicker";
import { getMeta, getPlayers } from "@/lib/data.server";
import { BRASILEIRAO_LEAGUES, LEAGUES, type LeagueId } from "@/lib/leagues";
import { BRASILEIRAO_SEASONS, CURRENT_SEASON } from "@/lib/seasons";
import type { SiteMeta } from "@/lib/types";

const FEATURED_MIN_MINUTES = 900;
const FEATURED_PER_LEAGUE = 3;

/** Top-rated athletes with a real Transfermarkt portrait — the faces of each competition on the cover. */
function featuredAthletes(league: LeagueId, season: string): HubAthlete[] {
  let players;
  try {
    players = getPlayers(league, season);
  } catch {
    return [];
  }
  return players
    .filter((player) => {
      const photo = player.transfermarkt?.photo;
      return player.minutes >= FEATURED_MIN_MINUTES && photo && !photo.includes("/default.");
    })
    .sort((a, b) => b.rating - a.rating || b.minutes - a.minutes)
    .slice(0, FEATURED_PER_LEAGUE)
    .map((player) => ({
      id: player.player_id,
      name: player.name,
      club: player.club,
      position: player.position,
      family: player.position_family,
      rating: player.rating,
      photo: player.transfermarkt!.photo!.replace("/portrait/header/", "/portrait/big/"),
    }));
}

function loadHubData(): HubData {
  const seasons: HubData["seasons"] = {};
  for (const season of BRASILEIRAO_SEASONS) {
    const leagues: HubData["seasons"][string]["leagues"] = {};
    const featured: HubData["seasons"][string]["featured"] = {};
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
      if (BRASILEIRAO_LEAGUES.some((item) => item.id === league.id)) {
        featured[league.id] = featuredAthletes(league.id, season);
      }
    }
    seasons[season] = { leagues, players, featured };
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
