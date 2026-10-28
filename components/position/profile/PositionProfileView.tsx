"use client";

import { useState } from "react";
import { useLeague } from "@/components/LeagueProvider";
import { usePlayerArchiveProfile } from "@/hooks/usePlayerArchiveProfile";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { CURRENT_SEASON } from "@/lib/seasons";
import { PlayerHero } from "./PlayerHero";
import { SeasonPeekModal } from "./SeasonPeekModal";
import { PlayerHeatmap } from "./PlayerHeatmap";
import { StatProfileRadarCard } from "./PlayerReport";
import { ProfileRadarCard } from "./ProfileCard";
import { ScoutStatsSections } from "./ScoutStatsSections";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
  heatmapsEnabled?: boolean;
};

export function PositionProfileView({ player, family, players, heatmapsEnabled = true }: Props) {
  const { isCurrentSeason, season: hubSeason } = useLeague();
  const archive = usePlayerArchiveProfile(player, family);
  const { displayPlayer, isArchiveView, showSlicer, loading, setFichaSeason, fichaSeason, basePlayer } = archive;
  const [peekYear, setPeekYear] = useState<string | null>(null);

  const showHeatmap = heatmapsEnabled && !isArchiveView && isCurrentSeason;

  return (
    <div
      className={[
        "profile-view-shell",
        isArchiveView ? "profile-view-shell-archive-ficha" : "",
        !isCurrentSeason ? "profile-view-shell-archive-hub" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isArchiveView ? (
        <p className="profile-archive-banner" role="status">
          Arquivo Wyscout · temporada {fichaSeason} · dados históricos (não é o scout {CURRENT_SEASON})
        </p>
      ) : null}
      {!isCurrentSeason ? (
        <p className="profile-archive-banner profile-archive-banner-hub" role="status">
          Hub em arquivo {hubSeason} · elenco e stats desta temporada
        </p>
      ) : null}

      <PlayerHero
        player={displayPlayer}
        family={family}
        players={players}
        scoutPlayer={basePlayer}
        isArchiveView={isArchiveView}
        fichaSeason={isArchiveView ? fichaSeason : undefined}
        seasonSlicer={
          showSlicer
            ? {
                active: fichaSeason,
                archiveYears: archive.archiveYears,
                loading,
                onSelect: (year) => {
                  if (year === CURRENT_SEASON) setFichaSeason(year);
                  else setPeekYear(year);
                },
              }
            : undefined
        }
      />

      <div className={`profile-content-grid${showHeatmap ? "" : " profile-content-grid-no-heatmap"}`}>
        {showHeatmap ? (
          <div className="profile-content-col profile-col-heatmap">
            <div className="player-card heatmap-card profile-perfil-card-score">
              <div className="profile-card-head">
                <h3 className="section-label">Mapa de calor</h3>
              </div>
              <PlayerHeatmap upright heatmap={displayPlayer.heatmap} playerName={displayPlayer.name} />
            </div>
          </div>
        ) : null}

        <div className="profile-content-col profile-col-middle">
          <ProfileRadarCard player={displayPlayer} family={family} players={players} />
        </div>

        <div className="profile-content-col profile-col-stats">
          <div className="player-card pass-scores-shell">
            <ScoutStatsSections
              player={displayPlayer}
              family={family}
              players={players}
              projectionSource={isArchiveView ? undefined : basePlayer}
              disableProjection={isArchiveView || !isCurrentSeason}
              radarView={<StatProfileRadarCard player={displayPlayer} bare />}
            />
          </div>
        </div>
      </div>

      {peekYear ? (
        <SeasonPeekModal
          year={peekYear}
          scout={basePlayer}
          onClose={() => setPeekYear(null)}
          onOpenFicha={(year) => {
            setPeekYear(null);
            setFichaSeason(year as Parameters<typeof setFichaSeason>[0]);
          }}
        />
      ) : null}
    </div>
  );
}
