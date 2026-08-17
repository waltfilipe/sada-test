"use client";

import { Suspense } from "react";
import { PositionScoutPage } from "@/components/position/PositionScoutPage";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
};

export function PosicaoClient({ family, players }: Props) {
  return (
    <Suspense fallback={<div className="scout-root" />}>
      <PositionScoutPage family={family} players={players} />
    </Suspense>
  );
}
