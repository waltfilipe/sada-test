import type { PlayerProfile } from "@/lib/types";

export type FlankSide = "esquerdo" | "direito";

/** Laterais e meias ofensivos: filtro por lado do campo. */
export function playerMatchesFlankSide(player: PlayerProfile, side: FlankSide): boolean {
  const position = player.position ?? "";
  if (position.includes("Esquerdo")) return side === "esquerdo";
  if (position.includes("Direito")) return side === "direito";

  if (position === "Meia Ofensivo") {
    const foot = (player.foot ?? "").toLowerCase();
    if (side === "esquerdo") {
      return foot.includes("canh") || foot.includes("esquer");
    }
    return foot.includes("dest") || foot.includes("dire");
  }

  return false;
}

export function supportsFlankSideFilter(positionFamily: string): boolean {
  return positionFamily === "laterais" || positionFamily === "extremos";
}
