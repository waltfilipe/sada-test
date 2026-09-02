"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPlayer } from "@/lib/api";
import type { PlayerProfile } from "@/lib/types";

const cache = new Map<string, PlayerProfile>();

export function usePlayerProfile(playerId: string | undefined, enabled: boolean) {
  const [profile, setProfile] = useState<PlayerProfile | null>(
    playerId && cache.has(playerId) ? cache.get(playerId)! : null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !playerId) {
      setProfile(null);
      return;
    }
    if (cache.has(playerId)) {
      setProfile(cache.get(playerId)!);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPlayer(playerId)
      .then((data) => {
        cache.set(playerId, data);
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId, enabled]);

  const prefetch = useCallback((id: string) => {
    if (cache.has(id)) return;
    fetchPlayer(id).then((data) => cache.set(id, data)).catch(() => {});
  }, []);

  return { profile, loading, prefetch };
}
