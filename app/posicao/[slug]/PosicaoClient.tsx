"use client";

import { PositionScoutPage } from "@/components/position/PositionScoutPage";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
};

export function PosicaoClient({ family, players }: Props) {
  return <PositionScoutPage family={family} players={players} />;
}
