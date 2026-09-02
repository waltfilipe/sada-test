"use client";

import { useMemo, useState } from "react";
import { ShadowPlayerChip } from "@/components/shadow/ShadowPlayerChip";
import { ShadowPlayerTooltip } from "@/components/shadow/ShadowPlayerMiniReport";
import { fieldSlots, formationById, type FormationSlot } from "@/lib/formations";
import type { PlayerSearchRow } from "@/lib/types";

const DRAG_MIME = "application/x-shadow-player";

type DragPayload = { playerId: string; sourceSlotId: string | null };

function parseDrag(data: DataTransfer): DragPayload | null {
  const raw = data.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

type Props = {
  formationId: string;
  assignments: Record<string, string | null>;
  playersById: Map<string, PlayerSearchRow>;
  selectedSlotId: string | null;
  placementPlayerId: string | null;
  onSelectSlot: (slotId: string | null) => void;
  onAssign: (slotId: string, playerId: string | null) => void;
  onDrop: (sourceSlotId: string | null, targetSlotId: string, playerId: string) => void;
};

export function PitchView({
  formationId,
  assignments,
  playersById,
  selectedSlotId,
  placementPlayerId,
  onSelectSlot,
  onAssign,
  onDrop,
}: Props) {
  const formation = useMemo(() => formationById(formationId), [formationId]);
  const slots = useMemo(() => fieldSlots(formation), [formation]);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);

  function handleSlotClick(slot: FormationSlot) {
    if (placementPlayerId) {
      onDrop(null, slot.id, placementPlayerId);
      return;
    }
    onSelectSlot(selectedSlotId === slot.id ? null : slot.id);
  }

  function handleDragStart(e: React.DragEvent, playerId: string, sourceSlotId: string | null) {
    const payload: DragPayload = { playerId, sourceSlotId };
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, slotId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlotId(slotId);
  }

  function handleDrop(e: React.DragEvent, slot: FormationSlot) {
    e.preventDefault();
    setDragOverSlotId(null);
    const payload = parseDrag(e.dataTransfer);
    if (!payload) return;
    onDrop(payload.sourceSlotId, slot.id, payload.playerId);
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

        {slots.map((slot) => {
          const playerId = assignments[slot.id];
          const player = playerId ? playersById.get(playerId) : undefined;
          const isSelected = selectedSlotId === slot.id;
          const isDragOver = dragOverSlotId === slot.id;
          const isPlacementTarget = Boolean(placementPlayerId);

          return (
            <div
              key={slot.id}
              className={`shadow-pitch-slot${isSelected ? " selected" : ""}${isDragOver ? " drag-over" : ""}${isPlacementTarget ? " placement-mode" : ""}${player ? " filled" : " empty"}`}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              onDragOver={(e) => handleDragOver(e, slot.id)}
              onDragLeave={() => setDragOverSlotId((id) => (id === slot.id ? null : id))}
              onDrop={(e) => handleDrop(e, slot)}
            >
              <span className="shadow-slot-label">{slot.label}</span>
              {player ? (
                <div
                  className="shadow-slot-draggable"
                  draggable
                  onDragStart={(e) => handleDragStart(e, player.player_id, slot.id)}
                  onClick={() => handleSlotClick(slot)}
                >
                  <ShadowPlayerTooltip player={player} block>
                    <ShadowPlayerChip player={player} size="sm" />
                  </ShadowPlayerTooltip>
                </div>
              ) : (
                <button type="button" className="shadow-slot-hit" onClick={() => handleSlotClick(slot)}>
                  <span className="shadow-slot-empty">
                    <i className="fa-solid fa-plus" aria-hidden="true" />
                  </span>
                </button>
              )}
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

      {placementPlayerId ? (
        <p className="shadow-pitch-hint">
          <i className="fa-solid fa-location-dot" aria-hidden="true" /> Clique na posição para escalar o reserva
        </p>
      ) : (
        <p className="shadow-pitch-hint">
          Arraste jogadores entre posições · clique para detalhes · use o banco para escalar reservas
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
  onDropStart,
}: {
  playerIds: string[];
  playersById: Map<string, PlayerSearchRow>;
  placementPlayerId: string | null;
  onPlace: (playerId: string | null) => void;
  onRemove: (playerId: string) => void;
  onDropStart?: (playerId: string) => void;
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
            <div
              className="shadow-bench-draggable"
              draggable
              onDragStart={(e) => {
                const payload: DragPayload = { playerId: id, sourceSlotId: null };
                e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
                e.dataTransfer.effectAllowed = "move";
                onDropStart?.(id);
              }}
            >
              <ShadowPlayerTooltip player={player} block>
                <ShadowPlayerChip
                  player={player}
                  size="md"
                  selected={placing}
                  onClick={() => onPlace(placing ? null : id)}
                  onRemove={() => onRemove(id)}
                />
              </ShadowPlayerTooltip>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
