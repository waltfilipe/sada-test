import { NextResponse } from "next/server";
import { filterPlayers, getFamilyPlayers, getMeta, getPlayerProfile, getPlayers } from "@/lib/data.server";
import { findPlayerInSeason } from "@/lib/playerSeasonMatch.server";
import { rankCrossLeagueSimilarity } from "@/lib/crossLeagueSimilarity";
import { isLeagueId, type LeagueId } from "@/lib/leagues";
import { CURRENT_SEASON, parseSeasonParam } from "@/lib/seasons";
import type { PositionFamily } from "@/lib/types";

type Params = { params: Promise<{ path: string[] }> };

/** Past seasons only change on deploy (which purges the CDN), so let Vercel's edge cache them. */
function archiveCacheHeaders(season: string | null | undefined): HeadersInit | undefined {
  if (parseSeasonParam(season) === CURRENT_SEASON) return undefined;
  return { "Cache-Control": "public, max-age=300, s-maxage=31536000, stale-while-revalidate=86400" };
}

/**
 * One route handler for every JSON API. Each `route.ts` is its own serverless
 * function when the traced bundle cannot be shared, and Hobby allows 12.
 */
export async function GET(request: Request, { params }: Params) {
  const { path } = await params;
  const url = new URL(request.url);
  const [resource, id] = path;

  if (resource === "meta" && path.length === 1) {
    const league = url.searchParams.get("league") ?? undefined;
    const season = url.searchParams.get("season") ?? url.searchParams.get("temporada") ?? undefined;
    return NextResponse.json(getMeta(league, season));
  }

  if (resource === "players" && path.length === 1) {
    return NextResponse.json(listPlayers(url));
  }

  if (resource === "players" && path.length === 2) {
    const league = url.searchParams.get("league") ?? undefined;
    const season = url.searchParams.get("season") ?? url.searchParams.get("temporada") ?? undefined;
    const profile = getPlayerProfile(id, league, season);
    if (!profile) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(profile);
  }

  if (resource === "families" && path.length === 2) {
    const league = url.searchParams.get("league") ?? undefined;
    const season = url.searchParams.get("season") ?? url.searchParams.get("temporada") ?? undefined;
    const players = getFamilyPlayers(id as PositionFamily, league, season);
    return NextResponse.json(
      { family: id, players, total: players.length },
      { headers: archiveCacheHeaders(season) },
    );
  }

  if (resource === "scatter" && path.length === 2) {
    return NextResponse.json(scatterPayload(url, id));
  }

  if (resource === "similar" && path.length === 1) {
    return similarPayload(url);
  }

  if (resource === "player-season" && path.length === 1) {
    const league = url.searchParams.get("league");
    const season = url.searchParams.get("season") ?? url.searchParams.get("temporada");
    const name = url.searchParams.get("name");
    const birthRaw = url.searchParams.get("birth_year");
    if (!league || !season || !name || !isLeagueId(league)) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 });
    }
    const birth = birthRaw ? Number(birthRaw) : null;
    const hit = findPlayerInSeason(
      league,
      season,
      name,
      Number.isFinite(birth) ? birth : null,
      url.searchParams.get("club"),
    );
    if (!hit) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(hit, { headers: archiveCacheHeaders(season) });
  }

  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

function listPlayers(url: URL) {
  const params = url.searchParams;
  const league = params.get("league") ?? undefined;
  const season = params.get("season") ?? params.get("temporada") ?? undefined;
  const family = params.get("family") as PositionFamily | null;
  const players = filterPlayers(
    getPlayers(league, season),
    {
      family: family ?? undefined,
      club: params.get("club") ?? undefined,
      nationality: params.get("nationality") ?? undefined,
      foot: params.get("foot") ?? undefined,
      search: params.get("search") ?? undefined,
      height: readRange(params, "height"),
      minutes: readRange(params, "minutes"),
      birthYear: readRange(params, "birth"),
      rating: readRange(params, "rating"),
    },
    league,
    season,
  );
  return { players, total: players.length };
}

function scatterPayload(url: URL, family: string) {
  const xKey = url.searchParams.get("x") ?? "intervencoes";
  const yKey = url.searchParams.get("y") ?? "confrontos_of";
  const playerA = url.searchParams.get("a");
  const playerB = url.searchParams.get("b");
  const players = getFamilyPlayers(family as PositionFamily);
  const points = players.map((player) => ({
    player_id: player.player_id,
    label: player.label,
    x: player.scatter[xKey] ?? 0,
    y: player.scatter[yKey] ?? 0,
  }));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const avgX = xs.reduce((sum, value) => sum + value, 0) / (xs.length || 1);
  const avgY = ys.reduce((sum, value) => sum + value, 0) / (ys.length || 1);
  return {
    family,
    xKey,
    yKey,
    avgX,
    avgY,
    points,
    highlightA: playerA,
    highlightB: playerB,
  };
}

function similarPayload(url: URL) {
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
  const matches = rankCrossLeagueSimilarity(source, targetPool, { limit }).map((hit) => ({
    ...hit,
    photo: getPlayerProfile(hit.player_id, toLeague)?.transfermarkt?.photo ?? null,
  }));

  return NextResponse.json({
    from: fromLeague,
    to: toLeague,
    player_id: playerId,
    family: positionFamily,
    matches,
  });
}

function readRange(params: URLSearchParams, prefix: string): [number, number] | undefined {
  const min = params.get(`${prefix}_min`);
  const max = params.get(`${prefix}_max`);
  if (min == null || max == null) return undefined;
  return [Number(min), Number(max)];
}
