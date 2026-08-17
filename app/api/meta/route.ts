import { NextResponse } from "next/server";
import { getMeta } from "@/lib/data.server";

export async function GET() {
  return NextResponse.json(getMeta());
}
