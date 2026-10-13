import { NextResponse } from "next/server";
import { getMeta } from "@/lib/data.server";

export async function GET(request: Request) {
  const league = new URL(request.url).searchParams.get("league") ?? undefined;
  return NextResponse.json(getMeta(league ?? undefined));
}
