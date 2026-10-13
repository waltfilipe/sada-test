import { NextResponse } from "next/server";
import { getFamilyPlayers, getPlayerProfile } from "@/lib/data.server";
import { rankCrossLeagueSimilarity } from "@/lib/crossLeagueSimilarity";
import { isLeagueId, type LeagueId } from "@/lib/leagues";
import type { PositionFamily } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fromLeague = url.searchParams.get("from");
  const toLeague = url.searchParams.get("to");
  const playerId = url.searchParams.get("playerId");
  const family = url.searchParams.get("family") as PositionFamily | null;
  const limitRaw = url.searchParams.get("limit");

  if (!fromLeague || !toLeague || !playerId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  if (!isLeagueId(fromLeague) || !isLeagueId(toLeague)) {
    return NextResponse.json({ error: "invalid_league" }, { status: 400 });
  }
  if (fromLeague === toLeague) {
    return NextResponse.json({ error: "same_league" }, { status: 400 });
  }

  const source = getPlayerProfile(playerId, fromLeague);
  if (!source) {
    return NextResponse.json({ error: "player_not_found" }, { status: 404 });
  }

  const positionFamily = family ?? source.position_family;
  const targetPool = getFamilyPlayers(positionFamily, toLeague as LeagueId);
  const limit = limitRaw ? Math.min(20, Math.max(1, Number(limitRaw))) : 5;

  const matches = rankCrossLeagueSimilarity(source, targetPool, { limit });

  return NextResponse.json({
    from: fromLeague,
    to: toLeague,
    player_id: playerId,
    family: positionFamily,
    matches,
  });
}
