"use client";

import { createContext, useContext, useMemo } from "react";
import { getLeague, leaguePath, type LeagueId } from "@/lib/leagues";

type LeagueContextValue = {
  leagueId: LeagueId;
  href: (path: string) => string;
  heatmaps: boolean;
  name: string;
  season: string;
  brand: string;
};

const LeagueContext = createContext<LeagueContextValue | null>(null);

export function LeagueProvider({ leagueId, children }: { leagueId: LeagueId; children: React.ReactNode }) {
  const info = getLeague(leagueId)!;
  const value = useMemo(
    () => ({
      leagueId,
      href: (path: string) => leaguePath(leagueId, path),
      heatmaps: info.heatmaps,
      name: info.name,
      season: info.season,
      brand: info.brand,
    }),
    [leagueId, info.brand, info.heatmaps, info.name, info.season],
  );
  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeague(): LeagueContextValue {
  const ctx = useContext(LeagueContext);
  if (!ctx) {
    throw new Error("useLeague must be used within LeagueProvider");
  }
  return ctx;
}
