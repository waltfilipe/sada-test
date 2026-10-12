import { NextResponse } from "next/server";
import { getPlayerProfile } from "@/lib/data.server";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const league = new URL(request.url).searchParams.get("league") ?? undefined;
  const profile = getPlayerProfile(id, league);
  if (!profile) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(profile);
}
