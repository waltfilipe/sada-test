import { NextResponse } from "next/server";
import { getFamilyPlayers } from "@/lib/data.server";
import type { PositionFamily } from "@/lib/types";

type Params = { params: Promise<{ family: string }> };

export async function GET(request: Request, { params }: Params) {
  const { family } = await params;
  const url = new URL(request.url);
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

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const avgX = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const avgY = ys.reduce((a, b) => a + b, 0) / (ys.length || 1);

  return NextResponse.json({
    family,
    xKey,
    yKey,
    avgX,
    avgY,
    points,
    highlightA: playerA,
    highlightB: playerB,
  });
}
