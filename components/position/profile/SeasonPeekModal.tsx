"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLeague } from "@/components/LeagueProvider";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { flattenAspects } from "@/lib/aspectLookup";
import { formatFoot } from "@/lib/feet";
import { getLeague, isLeagueId } from "@/lib/leagues";
import { profileAccent } from "@/lib/profileShares";
import { playerStatBadges } from "@/lib/statBadges";
import type { PlayerProfile } from "@/lib/types";
import { StatSectionsBoard } from "./ScoutStatsSections";

type Props = {
  year: string;
  scout: PlayerProfile;
  onClose: () => void;
  onOpenFicha: (year: string) => void;
};

function metricDisplay(player: PlayerProfile, label: string): string {
  for (const item of flattenAspects(player)) {
    const value = item.sub_metrics?.find((row) => row.label === label)?.display_value?.trim();
    if (value) return value;
  }
  return "—";
}

export function SeasonPeekModal({ year, scout, onClose, onOpenFicha }: Props) {
  const { leagueId } = useLeague();
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [failed, setFailed] = useState(false);

  const seasonRow = scout.cross_season?.seasons.find((s) => s.year === year);
  const leagueLabel = getLeague(seasonRow?.league ?? "")?.name;

  useEffect(() => {
    const league = seasonRow?.league && isLeagueId(seasonRow.league) ? seasonRow.league : leagueId;
    const qs = new URLSearchParams({
      league,
      season: year,
      name: scout.name,
      birth_year: String(scout.birth_year ?? ""),
    });
    if (seasonRow?.club) qs.set("club", seasonRow.club);
    let cancelled = false;
    fetch(`/api/player-season?${qs}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: PlayerProfile) => {
        if (!cancelled) setPlayer(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [year, scout, leagueId, seasonRow]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const accent = useMemo(
    () => profileAccent(((player?.profile ?? scout.profile) || "").split("+").pop()!.trim()),
    [player, scout],
  );
  const badges = useMemo(() => (player ? playerStatBadges(player).slice(0, 7) : []), [player]);

  const age = player?.birth_year ? Number(year) - player.birth_year : null;
  const foot = player ? formatFoot(player.foot) : null;
  const marketValue = player?.transfermarkt?.market_value ?? null;
  const contract = player?.transfermarkt?.contract_remaining ?? null;
  const profiles = player?.season_meta?.profiles ?? [];
  const mainProfile = profiles[0] ?? null;
  const poolSize = player?.season_meta?.pool_size ?? 0;

  return createPortal(
    <div className="season-peek-backdrop" role="presentation" onClick={onClose}>
      <article
        className="season-peek"
        role="dialog"
        aria-modal="true"
        aria-label={`${scout.name} na temporada ${year}`}
        style={{ "--hero-accent": accent } as React.CSSProperties}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="season-peek-head">
          <div>
            <p className="season-peek-kicker">
              {leagueLabel ? `${leagueLabel} · ${year}` : `Temporada ${year}`}
            </p>
            <h3 className="season-peek-name">{scout.name}</h3>
          </div>
          <button type="button" className="season-peek-close" aria-label="Fechar" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        {failed ? (
          <p className="season-peek-status">Não foi possível carregar os dados de {year}.</p>
        ) : !player ? (
          <p className="season-peek-status">Carregando temporada {year}…</p>
        ) : (
          <>
            <div className="season-peek-body">
              <div className="season-peek-photo">
                <PlayerPhoto src={player.transfermarkt?.photo} alt={scout.name} />
              </div>
              <div className="season-peek-meta">
                <p className="season-peek-club">
                  <ClubLogo club={player.club} size={20} />
                  <span>{player.club}</span>
                  <span className="season-peek-pos">{player.position}</span>
                </p>
                <dl className="season-peek-facts">
                  {age != null ? (
                    <div>
                      <dt>Idade</dt>
                      <dd>{age}</dd>
                    </div>
                  ) : null}
                  {player.height ? (
                    <div>
                      <dt>Altura</dt>
                      <dd>{player.height} cm</dd>
                    </div>
                  ) : null}
                  {foot ? (
                    <div>
                      <dt>Pé</dt>
                      <dd>{foot}</dd>
                    </div>
                  ) : null}
                  {player.nationality ? (
                    <div>
                      <dt>País</dt>
                      <dd>{player.nationality}</dd>
                    </div>
                  ) : null}
                  {marketValue ? (
                    <div>
                      <dt>Valor</dt>
                      <dd>{marketValue}</dd>
                    </div>
                  ) : null}
                  {contract ? (
                    <div>
                      <dt>Contrato</dt>
                      <dd>{contract}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </div>

            {mainProfile ? (
              <div className="season-peek-profiles">
                <div className="season-peek-profile-row">
                  <span className="season-peek-profile-label" style={{ color: profileAccent(mainProfile.label) }}>
                    {mainProfile.label}
                  </span>
                  <span className="season-peek-profile-nums">
                    {mainProfile.grade ? (
                      <strong style={{ color: profileAccent(mainProfile.label) }}>{mainProfile.grade}</strong>
                    ) : null}
                    {mainProfile.rank ? <span className="tabular">{mainProfile.rank}º de {poolSize}</span> : null}
                    <span className="tabular">{Math.round(mainProfile.share)}%</span>
                  </span>
                </div>
              </div>
            ) : player.profile ? (
              <p className="season-peek-profile" style={{ color: accent }}>
                {player.profile}
              </p>
            ) : null}

            <div className="season-peek-stats">
              <div>
                <span>Minutos</span>
                <strong className="tabular">{player.minutes?.toLocaleString("pt-BR") ?? "—"}</strong>
              </div>
              <div>
                <span>Gols</span>
                <strong className="tabular">{player.goals?.toLocaleString("pt-BR") ?? "—"}</strong>
              </div>
              <div>
                <span>xG</span>
                <strong className="tabular">{metricDisplay(player, "xG")}</strong>
              </div>
              <div>
                <span>Assistências</span>
                <strong className="tabular">{player.assists?.toLocaleString("pt-BR") ?? "—"}</strong>
              </div>
              <div>
                <span>xA</span>
                <strong className="tabular">{metricDisplay(player, "xA")}</strong>
              </div>
            </div>

            {badges.length ? (
              <div className="season-peek-badges" aria-label="Selos">
                {badges.map((badge) => (
                  <span className="season-peek-badge" key={badge.key} title={badge.title}>
                    <i className={`fa-solid ${badge.icon}`} aria-hidden="true" /> {badge.label}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="season-peek-data" aria-label={`Dados de ${year}`}>
              <StatSectionsBoard player={player} family={player.position_family} showBadges={false} />
            </div>

            <footer className="season-peek-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenFicha(year)}>
                <i className="fa-solid fa-arrow-right" aria-hidden="true" /> Ver ficha de {year}
              </button>
              <span className="season-peek-hint">
                Para exportar em PDF, marque as temporadas no menu do botão PDF da ficha.
              </span>
            </footer>
          </>
        )}
      </article>
    </div>,
    document.body,
  );
}
