"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLeague } from "@/components/LeagueProvider";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { flattenAspects } from "@/lib/aspectLookup";
import { formatFoot } from "@/lib/feet";
import { isLeagueId } from "@/lib/leagues";
import { profileAccent } from "@/lib/profileShares";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerProfile } from "@/lib/types";

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

  useEffect(() => {
    const row = scout.cross_season?.seasons.find((s) => s.year === year);
    const league = row?.league && isLeagueId(row.league) ? row.league : leagueId;
    const qs = new URLSearchParams({
      league,
      season: year,
      name: scout.name,
      birth_year: String(scout.birth_year ?? ""),
    });
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
  }, [year, scout, leagueId]);

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

  const age = player?.birth_year ? Number(year) - player.birth_year : null;
  const foot = player ? formatFoot(player.foot) : null;

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
            <p className="season-peek-kicker">Temporada {year}</p>
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
                <p className="season-peek-profile" style={{ color: accent }}>
                  {player.profile || "—"}
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
                </dl>
              </div>
            </div>

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
