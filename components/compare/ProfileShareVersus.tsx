"use client";

import { useMemo } from "react";

import { profileMetaForFamily } from "@/lib/profileMeta";
import { VersusBar } from "@/components/compare/VersusBar";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  family: PositionFamily;
  a: PlayerProfile;
  b: PlayerProfile;
};

export function ProfileShareVersus({ family, a, b }: Props) {
  const rows = useMemo(() => {
    const meta = profileMetaForFamily(family);
    return meta
      .map((item) => ({
        key: item.key,
        label: item.label,
        valueA: a.profile_shares[item.key] ?? 0,
        valueB: b.profile_shares[item.key] ?? 0,
      }))
      .filter((item) => item.valueA > 0 || item.valueB > 0);
  }, [family, a.profile_shares, b.profile_shares]);

  if (!rows.length) return null;

  return (
    <div className="versus-rows">
      {rows.map((item) => (
        <VersusBar
          key={item.key}
          label={item.label}
          valueA={item.valueA}
          valueB={item.valueB}
          max={100}
          format={(value) => `${Math.round(value)}%`}
        />
      ))}
    </div>
  );
}
