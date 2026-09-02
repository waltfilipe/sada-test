"use client";

import Link from "next/link";
import { ClubLogo } from "@/components/ClubLogo";
import { ShadowPlayerTooltip } from "@/components/shadow/ShadowPlayerMiniReport";
import { formatRating, playerInitials, ratingTier, tierVars } from "@/lib/scoutTheme";
import type { PlayerSearchRow } from "@/lib/types";

type Props = {
  player: PlayerSearchRow;
  size?: "sm" | "md";
  onRemove?: () => void;
  onClick?: () => void;
  selected?: boolean;
};

export function ShadowPlayerChip({ player, size = "md", onRemove, onClick, selected }: Props) {
  const token = ratingTier(player.rating);
  const photo = player.transfermarkt?.photo;

  const inner = (
    <>
      <span className={`shadow-chip-photo shadow-chip-photo-${size}`}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" loading="lazy" />
        ) : (
          <span>{playerInitials(player.name)}</span>
        )}
      </span>
      <span className="shadow-chip-copy">
        <strong>{player.name.split(" ").slice(-1)[0]}</strong>
        <em>
          <ClubLogo club={player.club} size={12} />
          {player.position}
        </em>
      </span>
      <span className="shadow-chip-rating tabular" style={tierVars(token)}>
        {formatRating(player.rating)}
      </span>
      {onRemove ? (
        <button
          type="button"
          className="shadow-chip-remove"
          aria-label={`Remover ${player.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      ) : null}
    </>
  );

  const className = `shadow-player-chip shadow-player-chip-${size}${selected ? " selected" : ""}${onClick ? " is-clickable" : ""}`;

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function ShadowPlayerRow({
  player,
  profileLabel,
  onRemove,
}: {
  player: PlayerSearchRow;
  profileLabel?: string | null;
  onRemove?: () => void;
}) {
  const token = ratingTier(player.rating);
  const photo = player.transfermarkt?.photo;

  return (
    <div className="shadow-player-row">
      <ShadowPlayerTooltip player={player} block>
        <Link href={`/posicao/${player.position_family}?atleta=${player.player_id}`} className="shadow-player-row-link">
          <span className="shadow-player-row-photo">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" loading="lazy" />
            ) : (
              <span>{playerInitials(player.name)}</span>
            )}
          </span>
          <span className="shadow-player-row-copy">
            <strong>{player.name}</strong>
            <em>
              <ClubLogo club={player.club} size={13} />
              {player.position}
              {profileLabel ? ` · ${profileLabel}` : ""}
            </em>
          </span>
          <span className="shadow-player-row-rating tabular" style={tierVars(token)}>
            {formatRating(player.rating)}
          </span>
        </Link>
      </ShadowPlayerTooltip>
      {onRemove ? (
        <button type="button" className="shadow-player-row-remove" aria-label={`Remover ${player.name}`} onClick={onRemove}>
          <i className="fa-solid fa-trash-can" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
