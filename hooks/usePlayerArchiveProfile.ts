"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLeague } from "@/components/LeagueProvider";
import { isLeagueId, type LeagueId } from "@/lib/leagues";
import {
  BRASILEIRAO_SEASONS,
  CURRENT_SEASON,
  FICHA_TEMPORADA_PARAM,
  parseFichaSeasonParam,
} from "@/lib/seasons";
import type { BrasileiraoSeason } from "@/lib/seasons";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

export function usePlayerArchiveProfile(basePlayer: PlayerProfile, _family: PositionFamily) {
  const { leagueId, isCurrentSeason } = useLeague();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fichaSeason = parseFichaSeasonParam(searchParams.get(FICHA_TEMPORADA_PARAM));
  const [archivePlayer, setArchivePlayer] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const archiveYears = useMemo((): BrasileiraoSeason[] => {
    if (!isCurrentSeason || !basePlayer.cross_season?.seasons?.length) return [];
    const years = new Set(basePlayer.cross_season.seasons.map((s) => s.year));
    return BRASILEIRAO_SEASONS.filter(
      (y): y is BrasileiraoSeason => y !== CURRENT_SEASON && years.has(y),
    );
  }, [basePlayer.cross_season, isCurrentSeason]);

  const showSlicer = isCurrentSeason && archiveYears.length > 0;

  const fichaLeague = useMemo((): LeagueId => {
    if (!fichaSeason) return leagueId;
    const row = basePlayer.cross_season?.seasons.find((s) => s.year === fichaSeason);
    return (row?.league && isLeagueId(row.league) ? row.league : leagueId) as LeagueId;
  }, [fichaSeason, basePlayer.cross_season, leagueId]);

  useEffect(() => {
    if (!fichaSeason || !isCurrentSeason) {
      setArchivePlayer(null);
      return;
    }
    const league = fichaLeague;
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({
      league,
      season: fichaSeason,
      name: basePlayer.name,
      birth_year: String(basePlayer.birth_year ?? ""),
    });
    fetch(`/api/player-season?${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PlayerProfile | null) => {
        if (!cancelled) setArchivePlayer(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fichaSeason, basePlayer, leagueId, isCurrentSeason, fichaLeague]);

  const isArchiveView = Boolean(fichaSeason && archivePlayer);
  const displayPlayer = isArchiveView ? archivePlayer! : basePlayer;

  const setFichaSeason = useCallback(
    (year: BrasileiraoSeason | typeof CURRENT_SEASON) => {
      const params = new URLSearchParams(searchParams.toString());
      if (year === CURRENT_SEASON) params.delete(FICHA_TEMPORADA_PARAM);
      else params.set(FICHA_TEMPORADA_PARAM, year);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return {
    basePlayer,
    displayPlayer,
    isArchiveView,
    fichaSeason: fichaSeason ?? CURRENT_SEASON,
    fichaLeague,
    archiveYears,
    showSlicer,
    loading,
    setFichaSeason,
  };
}
