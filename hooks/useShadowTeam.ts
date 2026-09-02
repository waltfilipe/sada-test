"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addToSquad,
  addToWatchlist,
  assignPlayer,
  loadShadowTeamState,
  removeFromSquad,
  removeFromWatchlist,
  saveShadowTeamState,
  setFormation,
  STORAGE_KEY,
  dropPlayerOnSlot,
  swapSlots,
  type ShadowTeamState,
} from "@/lib/shadowTeamStorage";
import type { PositionFamily } from "@/lib/types";

export function useShadowTeam() {
  const [state, setState] = useState<ShadowTeamState | null>(null);

  useEffect(() => {
    setState(loadShadowTeamState());

    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) setState(loadShadowTeamState());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: ShadowTeamState) => {
    setState(next);
    saveShadowTeamState(next);
  }, []);

  const toggleWatchlist = useCallback(
    (playerId: string) => {
      if (!state) return;
      const next = state.watchlistIds.includes(playerId)
        ? removeFromWatchlist(state, playerId)
        : addToWatchlist(state, playerId);
      persist(next);
    },
    [state, persist],
  );

  const toggleSquad = useCallback(
    (playerId: string, family: PositionFamily) => {
      if (!state) return;
      const next = state.squadIds.includes(playerId)
        ? removeFromSquad(state, playerId)
        : addToSquad(state, playerId, family);
      persist(next);
    },
    [state, persist],
  );

  const assign = useCallback(
    (slotId: string, playerId: string | null) => {
      if (!state) return;
      persist(assignPlayer(state, slotId, playerId));
    },
    [state, persist],
  );

  const swap = useCallback(
    (slotA: string, slotB: string) => {
      if (!state) return;
      persist(swapSlots(state, slotA, slotB));
    },
    [state, persist],
  );

  const dropOnSlot = useCallback(
    (sourceSlotId: string | null, targetSlotId: string, playerId: string) => {
      if (!state) return;
      persist(dropPlayerOnSlot(state, sourceSlotId, targetSlotId, playerId));
    },
    [state, persist],
  );

  const changeFormation = useCallback(
    (formationId: string) => {
      if (!state) return;
      persist(setFormation(state, formationId));
    },
    [state, persist],
  );

  const isWatchlisted = useCallback(
    (playerId: string) => Boolean(state?.watchlistIds.includes(playerId)),
    [state],
  );

  const isInSquad = useCallback(
    (playerId: string) => Boolean(state?.squadIds.includes(playerId)),
    [state],
  );

  return {
    state,
    ready: state != null,
    toggleWatchlist,
    toggleSquad,
    assign,
    swap,
    dropOnSlot,
    changeFormation,
    isWatchlisted,
    isInSquad,
    removeFromSquad: (playerId: string) => state && persist(removeFromSquad(state, playerId)),
    removeFromWatchlist: (playerId: string) => state && persist(removeFromWatchlist(state, playerId)),
  };
}
