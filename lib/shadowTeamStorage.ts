import {
  DEFAULT_FORMATION_ID,
  formationById,
  remapAssignments,
  suggestSlotId,
  type Formation,
} from "@/lib/formations";
import type { PositionFamily } from "@/lib/types";

export const STORAGE_KEY = "serie-a-scout:shadow-team-v1";

export type ShadowTeamState = {
  formationId: string;
  /** Players in the shadow squad (may be on pitch or bench). */
  squadIds: string[];
  /** Observation list — independent from the shadow squad. */
  watchlistIds: string[];
  /** slotId → playerId */
  assignments: Record<string, string | null>;
};

export const EMPTY_STATE: ShadowTeamState = {
  formationId: DEFAULT_FORMATION_ID,
  squadIds: [],
  watchlistIds: [],
  assignments: {},
};

function emptyAssignments(formation: Formation): Record<string, string | null> {
  return Object.fromEntries(formation.slots.map((s) => [s.id, null]));
}

export function loadShadowTeamState(): ShadowTeamState {
  if (typeof window === "undefined") return { ...EMPTY_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATE, assignments: emptyAssignments(formationById(DEFAULT_FORMATION_ID)) };
    const parsed = JSON.parse(raw) as Partial<ShadowTeamState>;
    const formationId = parsed.formationId ?? DEFAULT_FORMATION_ID;
    const formation = formationById(formationId);
    const base = emptyAssignments(formation);
    return {
      formationId,
      squadIds: parsed.squadIds ?? [],
      watchlistIds: parsed.watchlistIds ?? [],
      assignments: { ...base, ...(parsed.assignments ?? {}) },
    };
  } catch {
    return { ...EMPTY_STATE, assignments: emptyAssignments(formationById(DEFAULT_FORMATION_ID)) };
  }
}

export function saveShadowTeamState(state: ShadowTeamState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function takenSlots(assignments: Record<string, string | null>): Set<string> {
  return new Set(Object.entries(assignments).filter(([, v]) => v).map(([k]) => k));
}

export function addToWatchlist(state: ShadowTeamState, playerId: string): ShadowTeamState {
  if (state.watchlistIds.includes(playerId)) return state;
  return { ...state, watchlistIds: [...state.watchlistIds, playerId] };
}

export function removeFromWatchlist(state: ShadowTeamState, playerId: string): ShadowTeamState {
  return { ...state, watchlistIds: state.watchlistIds.filter((id) => id !== playerId) };
}

export function addToSquad(
  state: ShadowTeamState,
  playerId: string,
  family: PositionFamily,
): ShadowTeamState {
  const formation = formationById(state.formationId);
  let squadIds = state.squadIds;
  if (!squadIds.includes(playerId)) {
    squadIds = [...squadIds, playerId];
  }

  const assignments = { ...state.assignments };
  const alreadyOnPitch = Object.values(assignments).includes(playerId);
  if (!alreadyOnPitch) {
    const taken = takenSlots(assignments);
    const slotId = suggestSlotId(formation, family, taken);
    if (slotId) assignments[slotId] = playerId;
  }

  return { ...state, squadIds, assignments };
}

export function removeFromSquad(state: ShadowTeamState, playerId: string): ShadowTeamState {
  const assignments = { ...state.assignments };
  for (const key of Object.keys(assignments)) {
    if (assignments[key] === playerId) assignments[key] = null;
  }
  return {
    ...state,
    squadIds: state.squadIds.filter((id) => id !== playerId),
    assignments,
  };
}

export function assignPlayer(state: ShadowTeamState, slotId: string, playerId: string | null): ShadowTeamState {
  const assignments = { ...state.assignments };
  if (playerId) {
    for (const key of Object.keys(assignments)) {
      if (assignments[key] === playerId) assignments[key] = null;
    }
    let squadIds = state.squadIds;
    if (!squadIds.includes(playerId)) squadIds = [...squadIds, playerId];
    assignments[slotId] = playerId;
    return { ...state, squadIds, assignments };
  }
  assignments[slotId] = null;
  return { ...state, assignments };
}

export function swapSlots(state: ShadowTeamState, slotA: string, slotB: string): ShadowTeamState {
  const assignments = { ...state.assignments };
  const a = assignments[slotA] ?? null;
  const b = assignments[slotB] ?? null;
  assignments[slotA] = b;
  assignments[slotB] = a;
  return { ...state, assignments };
}

export function setFormation(state: ShadowTeamState, formationId: string): ShadowTeamState {
  const from = formationById(state.formationId);
  const to = formationById(formationId);
  if (from.id === to.id) return state;
  const assignments = remapAssignments(from, to, state.assignments);
  return { ...state, formationId, assignments };
}

export function benchPlayerIds(state: ShadowTeamState): string[] {
  const onPitch = new Set(Object.values(state.assignments).filter(Boolean) as string[]);
  return state.squadIds.filter((id) => !onPitch.has(id));
}
