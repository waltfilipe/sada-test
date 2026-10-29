"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLeague } from "@/components/LeagueProvider";
import { usePlayerArchiveProfile } from "@/hooks/usePlayerArchiveProfile";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import {
  BRASILEIRAO_SEASONS,
  CURRENT_SEASON,
  FICHA_TEMPORADA_PARAM,
  type BrasileiraoSeason,
} from "@/lib/seasons";
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
  currentPlayers?: PlayerProfile[];
  heatmapsEnabled?: boolean;
};

export function PositionProfileView({ player, family, players, currentPlayers, heatmapsEnabled = true }: Props) {
  const { leagueId, isCurrentSeason, season: hubSeason } = useLeague();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const archive = usePlayerArchiveProfile(player, family);
  const { displayPlayer, isArchiveView, loading, setFichaSeason, fichaSeason, basePlayer, archiveYears } = archive;
  const [peekYear, setPeekYear] = useState<string | null>(null);

  const archiveHubSlicer = useMemo(() => {
    if (isCurrentSeason) return undefined;
    const counterpart = currentPlayers?.find(
      (item) =>
        item.name === player.name &&
        (item.birth_year == null ||
          player.birth_year == null ||
          Math.abs(item.birth_year - player.birth_year) <= 1),
    );
    if (!counterpart) {
      return { active: hubSeason as string, years: [hubSeason] as BrasileiraoSeason[], onSelect: () => {} };
    }
    const years = BRASILEIRAO_SEASONS.filter(
      (year) =>
        year === CURRENT_SEASON ||
        year === hubSeason ||
        (counterpart.cross_season?.seasons.some((s) => s.year === year && s.league === leagueId) ?? false),
    );
    return {
      active: hubSeason as string,
      years,
      onSelect: (year: BrasileiraoSeason) => {
        if (year === hubSeason) return;
        const params = new URLSearchParams(searchParams.toString());
        params.delete("atleta");
        params.delete(FICHA_TEMPORADA_PARAM);
        params.set("atleta_nome", player.name);
        params.set("atleta_nasc", String(player.birth_year ?? ""));
        if (year === CURRENT_SEASON) params.delete("temporada");
        else params.set("temporada", year);
        const qs = params.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      },
    };
  }, [isCurrentSeason, currentPlayers, player, hubSeason, leagueId, searchParams, pathname, router]);

  const showHeatmap =
    heatmapsEnabled && ((isCurrentSeason && !isArchiveView) || Boolean(displayPlayer?.heatmap));

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
        similarSource={
          isArchiveView
            ? { league: archive.fichaLeague, season: fichaSeason }
            : { league: leagueId, season: hubSeason }
        }
        seasonSlicer={
          isCurrentSeason
            ? {
                active: fichaSeason,
                years: [CURRENT_SEASON, ...archiveYears],
                loading,
                onSelect: (year) => {
                  if (year === CURRENT_SEASON) setFichaSeason(year);
                  else setPeekYear(year);
                },
              }
            : archiveHubSlicer
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
