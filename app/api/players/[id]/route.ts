import { NextResponse } from "next/server";
import { getPlayerProfile } from "@/lib/data.server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const profile = getPlayerProfile(id);
  if (!profile) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(profile);
}
