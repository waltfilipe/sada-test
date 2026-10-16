import { NextResponse } from "next/server";
import { getFamilyPlayers } from "@/lib/data.server";
import type { PositionFamily } from "@/lib/types";

type Params = { params: Promise<{ family: string }> };

export async function GET(request: Request, { params }: Params) {
  const { family } = await params;
  const league = new URL(request.url).searchParams.get("league") ?? undefined;
  const players = getFamilyPlayers(family as PositionFamily, league);
  return NextResponse.json({ family, players, total: players.length });
}
