"use client";

import { ClubLogo } from "@/components/ClubLogo";
import { Tooltip } from "@/components/ui/Tooltip";
import { usePlayerProfile } from "@/hooks/usePlayerProfileCache";
import {
  clampPercent,
  formatRating,
  playerInitials,
  ratingTier,
  ratingToLetterGrade,
  tierVars,
  TENDENCY_META,
} from "@/lib/scoutTheme";
import type { PlayerSearchRow } from "@/lib/types";

function monthsRemaining(iso?: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month) return "—";
  const end = new Date(year, month - 1, day || 1);
  const now = new Date();
  let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (end.getDate() < now.getDate()) months -= 1;
  if (months < 0) return "Expirado";
  return `${months} ${months === 1 ? "mês" : "meses"}`;
}

export function ShadowPlayerMiniReport({ player }: { player: PlayerSearchRow }) {
  const { profile, loading } = usePlayerProfile(player.player_id, true);
  const tm = player.transfermarkt ?? profile?.transfermarkt;
  const rating = profile?.ratings.geral ?? player.rating;
  const token = ratingTier(rating);
  const archetype = player.cluster?.archetype_label ?? player.profile;

  const ratingEntries = profile
    ? Object.entries(profile.ratings).filter(([key]) => key !== "geral" && key !== "perfil")
    : [];

  return (
    <div className="shadow-mini-report">
      <div className="shadow-mini-report-head">
        <strong>{player.name}</strong>
        <span className="shadow-mini-report-club">
          <ClubLogo club={player.club} size={14} />
          {player.club} · {player.position}
        </span>
      </div>

      <div className="shadow-mini-report-hero">
        <span className="shadow-mini-report-grade" style={tierVars(token)}>
          {ratingToLetterGrade(rating)}
        </span>
        <span className="shadow-mini-report-rating tabular">
          Rating <strong>{formatRating(rating)}</strong>
        </span>
        <span className="shadow-mini-report-profile">{archetype}</span>
      </div>

      {ratingEntries.length > 0 ? (
        <div className="shadow-mini-report-ratings">
          {ratingEntries.slice(0, 4).map(([key, value]) => (
            <span key={key} className="shadow-mini-report-rating-pill tabular">
              <em>{key.replace(/_/g, " ")}</em>
              <strong style={tierVars(ratingTier(value))}>{formatRating(value)}</strong>
            </span>
          ))}
        </div>
      ) : null}

      <div className="shadow-mini-report-tendencies">
        <span className="shadow-mini-report-section-label">Tendências</span>
        {TENDENCY_META.map((item) => {
          const raw = player.tendencies[item.key] ?? 0;
          const value = clampPercent(raw);
          return (
            <div key={item.key} className="shadow-mini-tendency-row">
              <span className="shadow-mini-tendency-label">{item.label}</span>
              <span className="shadow-mini-tendency-track" aria-hidden="true">
                <i style={{ width: `${value}%` }} />
              </span>
              <span className="shadow-mini-tendency-val tabular">{Math.round(value)}</span>
            </div>
          );
        })}
      </div>

      <div className="shadow-mini-report-market">
        <div>
          <span className="shadow-mini-report-section-label">Valor</span>
          <strong>{tm?.market_value ?? "—"}</strong>
        </div>
        <div>
          <span className="shadow-mini-report-section-label">Contrato</span>
          <strong>{monthsRemaining(tm?.contract_until)}</strong>
        </div>
      </div>

      {loading ? <p className="shadow-mini-report-loading">Carregando ratings…</p> : null}
    </div>
  );
}

export function ShadowPlayerTooltip({
  player,
  children,
  block,
}: {
  player: PlayerSearchRow;
  children: React.ReactNode;
  block?: boolean;
}) {
  return (
    <Tooltip content={<ShadowPlayerMiniReport player={player} />} block={block}>
      {children}
    </Tooltip>
  );
}
