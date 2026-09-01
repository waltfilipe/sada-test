"use client";

import { ProfileCard } from "@/components/position/profile/ProfileCard";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  playerA: PlayerProfile;
  playerB: PlayerProfile;
  family: PositionFamily;
};

export function CompareProfilePair({ playerA, playerB, family }: Props) {
  return (
    <div className="compare-profile-pair">
      <div className="compare-profile-col">
        <p className="compare-col-label side-a">{playerA.name.split(" ")[0]}</p>
        <ProfileCard player={playerA} family={family} />
      </div>
      <div className="compare-profile-col">
        <p className="compare-col-label side-b">{playerB.name.split(" ")[0]}</p>
        <ProfileCard player={playerB} family={family} />
      </div>
    </div>
  );
}
