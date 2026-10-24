"use client";

import Link from "next/link";
import { useLeague } from "@/components/LeagueProvider";
import { PlayerSeasonSlicer } from "@/components/PlayerSeasonSlicer";
import { usePlayerArchiveProfile } from "@/hooks/usePlayerArchiveProfile";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { CURRENT_SEASON } from "@/lib/seasons";
import { PlayerHero } from "./PlayerHero";
import { PlayerHeatmap } from "./PlayerHeatmap";
import { ProfileCard } from "./ProfileCard";
import { ScoutStatsSections } from "./ScoutStatsSections";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
  heatmapsEnabled?: boolean;
};

export function PositionProfileView({ player, family, players, heatmapsEnabled = true }: Props) {
  const { href, isCurrentSeason, season: hubSeason } = useLeague();
  const archive = usePlayerArchiveProfile(player, family);
  const { displayPlayer, isArchiveView, showSlicer, loading, setFichaSeason, fichaSeason, basePlayer } = archive;

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

      {showSlicer ? (
        <PlayerSeasonSlicer
          active={fichaSeason}
          archiveYears={archive.archiveYears}
          loading={loading}
          onSelect={setFichaSeason}
        />
      ) : null}

      <PlayerHero
        player={displayPlayer}
        family={family}
        players={players}
        scoutPlayer={basePlayer}
        isArchiveView={isArchiveView}
        fichaSeason={isArchiveView ? fichaSeason : undefined}
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
          <ProfileCard player={displayPlayer} family={family} players={players} />
          <Link className="profile-radar-link" href={`${href(`/posicao/${family}/radares`)}?jogador=${encodeURIComponent(basePlayer.player_id)}`}>
            Ver afinidade e classificação em radares
          </Link>
        </div>

        <div className="profile-content-col profile-col-stats">
          <div className="player-card pass-scores-shell">
            <ScoutStatsSections
              player={displayPlayer}
              family={family}
              players={players}
              projectionSource={isArchiveView ? undefined : basePlayer}
              disableProjection={isArchiveView || !isCurrentSeason}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
