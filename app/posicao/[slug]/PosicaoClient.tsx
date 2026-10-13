"use client";

import { Suspense } from "react";
import { PositionScoutPage } from "@/components/position/PositionScoutPage";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  heatmapsEnabled?: boolean;
  initialPlayerId?: string;
  filterOrigin?: string;
};

export function PosicaoClient({ family, players, heatmapsEnabled = true }: Props) {
  return (
    <Suspense fallback={<div className="scout-root" />}>
      <PositionScoutPage key={family} family={family} players={players} heatmapsEnabled={heatmapsEnabled} />
    </Suspense>
  );
}
