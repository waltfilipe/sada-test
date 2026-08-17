import { NextResponse } from "next/server";
import { filterPlayers, getPlayers } from "@/lib/data.server";
import type { PositionFamily } from "@/lib/types";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const family = params.get("family") as PositionFamily | null;
  const players = filterPlayers(getPlayers(), {
    family: family ?? undefined,
    club: params.get("club") ?? undefined,
    nationality: params.get("nationality") ?? undefined,
    foot: params.get("foot") ?? undefined,
    search: params.get("search") ?? undefined,
    height: readRange(params, "height"),
    minutes: readRange(params, "minutes"),
    birthYear: readRange(params, "birth"),
    rating: readRange(params, "rating"),
  });
  return NextResponse.json({ players, total: players.length });
}

function readRange(params: URLSearchParams, prefix: string): [number, number] | undefined {
  const min = params.get(`${prefix}_min`);
  const max = params.get(`${prefix}_max`);
  if (min == null || max == null) return undefined;
  return [Number(min), Number(max)];
}
