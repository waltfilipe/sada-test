"use client";

import { useMemo } from "react";
import { ShadowPlayerChip } from "@/components/shadow/ShadowPlayerChip";
import { formationById, type FormationSlot } from "@/lib/formations";
import type { PlayerSummary } from "@/lib/types";

type Props = {
  formationId: string;
  assignments: Record<string, string | null>;
  playersById: Map<string, PlayerSummary>;
  selectedSlotId: string | null;
  swapSourceId: string | null;
  placementPlayerId: string | null;
  onSelectSlot: (slotId: string | null) => void;
  onSwapSource: (slotId: string | null) => void;
  onAssign: (slotId: string, playerId: string | null) => void;
  onSwap: (slotA: string, slotB: string) => void;
};

export function PitchView({
  formationId,
  assignments,
  playersById,
  selectedSlotId,
  swapSourceId,
  placementPlayerId,
  onSelectSlot,
  onSwapSource,
  onAssign,
  onSwap,
}: Props) {
  const formation = useMemo(() => formationById(formationId), [formationId]);

  function handleSlotClick(slot: FormationSlot) {
    if (swapSourceId && swapSourceId !== slot.id) {
      onSwap(swapSourceId, slot.id);
      onSwapSource(null);
      return;
    }
    if (placementPlayerId) {
      onAssign(slot.id, placementPlayerId);
      return;
    }
    onSelectSlot(selectedSlotId === slot.id ? null : slot.id);
  }

  return (
    <div className="shadow-pitch-wrap">
      <div className="shadow-pitch" aria-label="Campo tático">
        <div className="shadow-pitch-lines" aria-hidden="true">
          <span className="shadow-pitch-mid" />
          <span className="shadow-pitch-circle" />
          <span className="shadow-pitch-box shadow-pitch-box-top" />
          <span className="shadow-pitch-box shadow-pitch-box-bottom" />
        </div>

        {formation.slots.map((slot) => {
          const playerId = assignments[slot.id];
          const player = playerId ? playersById.get(playerId) : undefined;
          const isSelected = selectedSlotId === slot.id;
          const isSwap = swapSourceId === slot.id;
          const isPlacementTarget = Boolean(placementPlayerId);

          return (
            <div
              key={slot.id}
              className={`shadow-pitch-slot${isSelected ? " selected" : ""}${isSwap ? " swap-source" : ""}${isPlacementTarget ? " placement-mode" : ""}${player ? " filled" : " empty"}`}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              <button
                type="button"
                className="shadow-slot-hit"
                onClick={() => handleSlotClick(slot)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  onSwapSource(swapSourceId === slot.id ? null : slot.id);
                }}
                title={player ? `${player.name} — duplo clique para trocar` : `Posição ${slot.label}`}
              >
                <span className="shadow-slot-label">{slot.label}</span>
                {player ? (
                  <span className="shadow-slot-player">
                    <ShadowPlayerChip player={player} size="sm" />
                  </span>
                ) : (
                  <span className="shadow-slot-empty">
                    <i className="fa-solid fa-plus" aria-hidden="true" />
                  </span>
                )}
              </button>
              {player && isSelected ? (
                <button
                  type="button"
                  className="shadow-slot-clear"
                  aria-label={`Remover ${player.name} da posição`}
                  onClick={() => onAssign(slot.id, null)}
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {swapSourceId ? (
        <p className="shadow-pitch-hint">
          <i className="fa-solid fa-right-left" aria-hidden="true" /> Clique em outra posição para trocar, ou{" "}
          <button type="button" className="shadow-link-btn" onClick={() => onSwapSource(null)}>
            cancelar
          </button>
        </p>
      ) : placementPlayerId ? (
        <p className="shadow-pitch-hint">
          <i className="fa-solid fa-location-dot" aria-hidden="true" /> Clique na posição para escalar o reserva
        </p>
      ) : (
        <p className="shadow-pitch-hint">
          Clique na posição para detalhes · duplo clique para trocar · use o banco para escalar reservas
        </p>
      )}
    </div>
  );
}

export function BenchStrip({
  playerIds,
  playersById,
  placementPlayerId,
  onPlace,
  onRemove,
}: {
  playerIds: string[];
  playersById: Map<string, PlayerSummary>;
  placementPlayerId: string | null;
  onPlace: (playerId: string | null) => void;
  onRemove: (playerId: string) => void;
}) {
  if (!playerIds.length) {
    return <p className="shadow-bench-empty">Nenhum reserva — adicione atletas pelo botão + no perfil.</p>;
  }

  return (
    <ul className="shadow-bench-list">
      {playerIds.map((id) => {
        const player = playersById.get(id);
        if (!player) return null;
        const placing = placementPlayerId === id;
        return (
          <li key={id}>
            <ShadowPlayerChip
              player={player}
              size="md"
              selected={placing}
              onClick={() => onPlace(placing ? null : id)}
              onRemove={() => onRemove(id)}
            />
          </li>
        );
      })}
    </ul>
  );
}
