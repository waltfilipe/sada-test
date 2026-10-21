/**
 * Sanity check: certos-based cross-league similarity (same as production lib).
 * Run: npx tsx scripts/compare_similarity_models.mts
 */
import fs from "fs";
import path from "path";
import { rankCrossLeagueSimilarity } from "../lib/crossLeagueSimilarity.ts";
import type { PlayerProfile, PositionFamily } from "../lib/types.ts";

function readFamily(league: string, family: PositionFamily): PlayerProfile[] {
  const file = path.join(process.cwd(), "data", league, `family-${family}.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8")).players as PlayerProfile[];
}

function print(sourceId: string, from: string, to: string, family: PositionFamily) {
  const source = readFamily(from, family).find((p) => p.player_id === sourceId);
  if (!source) return;
  const pool = readFamily(to, family);
  const matches = rankCrossLeagueSimilarity(source, pool, { limit: 3 });
  console.log(`\n${source.name} → ${to}`);
  for (const m of matches) {
    const blocks = m.blocks.map((b) => `${b.title} ${b.similarity}%`).join(" · ");
    console.log(`  ${m.similarity}% ${m.name} — ${blocks}`);
  }
}

print("igor-rabello-fluminense-560", "serie-a", "serie-b", "zagueiros");
