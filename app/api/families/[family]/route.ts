import { NextResponse } from "next/server";
import { getFamilyPlayers } from "@/lib/data.server";
import type { PositionFamily } from "@/lib/types";

type Params = { params: Promise<{ family: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { family } = await params;
  const players = getFamilyPlayers(family as PositionFamily);
  return NextResponse.json({ family, players, total: players.length });
}
