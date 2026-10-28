"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { rankCrossLeagueSimilarity, type SimilarPlayerHit } from "@/lib/crossLeagueSimilarity";
import { LEAGUES, leaguePath, type LeagueId } from "@/lib/leagues";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerPhoto } from "@/components/PlayerPhoto";

type Step = "pick-league" | "loading" | "results" | "error";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  currentLeagueId: LeagueId;
  players: PlayerProfile[];
  onClose: () => void;
};

function withPhotos(hits: SimilarPlayerHit[], pool: PlayerProfile[]): SimilarPlayerHit[] {
  const byId = new Map(pool.map((p) => [p.player_id, p]));
  return hits.map((hit) => ({
    ...hit,
    photo: byId.get(hit.player_id)?.transfermarkt?.photo ?? hit.photo ?? null,
  }));
}

function SimilarResultsList({
  matches,
  leagueId,
  family,
  onClose,
}: {
  matches: SimilarPlayerHit[];
  leagueId: LeagueId;
  family: PositionFamily;
  onClose: () => void;
}) {
  if (!matches.length) {
    return <p className="similar-cross-hint">Nenhum atleta com minutos suficientes nessa posição.</p>;
  }
  return (
    <ul className="similar-results-list">
      {matches.map((hit, index) => (
        <li key={hit.player_id}>
          <Link
            href={leaguePath(leagueId, `/posicao/${family}?atleta=${encodeURIComponent(hit.player_id)}`)}
            className="similar-result-card"
            onClick={onClose}
          >
            <div className="similar-result-top">
              <span className="similar-result-rank">{index + 1}</span>
              <div className="similar-result-identity">
                <span className="similar-result-photo">
                  <PlayerPhoto
                    src={hit.photo}
                    alt=""
                    fallback={
                      <span className="similar-result-photo similar-cross-photo-fallback">
                        {playerInitials(hit.name)}
                      </span>
                    }
                  />
                </span>
                <div className="similar-result-headline">
                  <span className="similar-result-name">{hit.name}</span>
                  <span className="similar-result-meta">
                    <ClubLogo club={hit.club} size={14} />
                    {hit.club} · {hit.profile}
                  </span>
                </div>
              </div>
              <span className="similar-result-total tabular">
                <span className="similar-result-total-label">Total</span>
                {hit.similarity}%
              </span>
            </div>
            {hit.blocks.length ? (
              <div className="similar-result-blocks">
                {hit.blocks.map((block) => (
                  <div key={block.title} className={`similar-result-block tone-${block.tone}`}>
                    <span className="similar-result-block-title">{block.title}</span>
                    <span className="similar-result-block-pct tabular">{block.similarity}%</span>
                    <span className="similar-result-block-bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, block.similarity)}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SimilarCrossLeagueModal({ player, family, currentLeagueId, players, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("pick-league");
  const [targetLeague, setTargetLeague] = useState<LeagueId | null>(null);
  const [matches, setMatches] = useState<SimilarPlayerHit[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const referencePhoto = player.transfermarkt?.photo;
  const positionSections = useMemo(() => statSectionsForFamily(family), [family]);
  const leagueOptions = useMemo(
    () => [
      ...LEAGUES.filter((league) => league.id === currentLeagueId),
      ...LEAGUES.filter((league) => league.id !== currentLeagueId),
    ],
    [currentLeagueId],
  );

  const fetchSimilar = useCallback(
    async (to: LeagueId) => {
      setStep("loading");
      setErrorMessage(null);
      try {
        const params = new URLSearchParams({
          from: currentLeagueId,
          to,
          playerId: player.player_id,
          family,
          limit: "5",
        });
        const res = await fetch(`/api/similar?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "request_failed");
        }
        setMatches(data.matches ?? []);
        setStep("results");
      } catch {
        setErrorMessage("Não foi possível calcular similares. Tente de novo.");
        setStep("error");
      }
    },
    [currentLeagueId, family, player.player_id],
  );

  const pickLeague = useCallback(
    (to: LeagueId) => {
      setTargetLeague(to);
      if (to === currentLeagueId) {
        setMatches(withPhotos(rankCrossLeagueSimilarity(player, players, { limit: 5 }), players));
        setStep("results");
        return;
      }
      void fetchSimilar(to);
    },
    [currentLeagueId, fetchSimilar, player, players],
  );

  useEffect(() => {
    setMounted(true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="stat-window-backdrop" onClick={onClose}>
      <div
        className="stat-window similar-cross-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Atletas similares a ${player.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="stat-window-head">
          <h3>Atletas similares</h3>
          <button type="button" className="stat-window-close" onClick={onClose} aria-label="Fechar">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <div className="stat-window-body">
          <div className="similar-cross-ref">
            <span className="similar-cross-ref-photo">
              <PlayerPhoto
                src={referencePhoto}
                alt=""
                fallback={
                  <span className="similar-cross-ref-photo similar-cross-photo-fallback">
                    {playerInitials(player.name)}
                  </span>
                }
              />
            </span>
            <div className="similar-cross-ref-copy">
              <p className="similar-cross-ref-name">{player.name}</p>
              <p className="similar-cross-ref-meta">
                {player.club} · {player.profile}
              </p>
              <p className="similar-cross-intro-note">
                Ações certas por 90 · % total e por bloco ({positionSections.map((s) => s.title).join(" · ")})
              </p>
            </div>
          </div>

          {step === "pick-league" ? (
            <div className="similar-league-pick">
              <p className="similar-cross-hint">Em qual competição buscar atletas parecidos?</p>
              <div className="similar-league-buttons">
                {leagueOptions.map((league) => (
                  <button
                    key={league.id}
                    type="button"
                    className={`btn similar-league-btn${league.id === currentLeagueId ? " is-current" : ""}`}
                    onClick={() => pickLeague(league.id)}
                  >
                    <span className="similar-league-brand">{league.brand}</span>
                    <span>
                      {league.name}
                      <span className="similar-league-season">
                        {league.id === currentLeagueId ? `Competição atual · ${league.season}` : league.season}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === "loading" ? (
            <p className="similar-cross-hint" aria-live="polite">
              Calculando top 5 em {LEAGUES.find((l) => l.id === targetLeague)?.name ?? "…"}…
            </p>
          ) : null}

          {step === "error" ? (
            <div className="similar-cross-error">
              <p>{errorMessage}</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep("pick-league")}>
                Voltar
              </button>
            </div>
          ) : null}

          {step === "results" && targetLeague ? (
            <>
              <div className="similar-results-head">
                <span>Top 5 · {LEAGUES.find((l) => l.id === targetLeague)?.name}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep("pick-league")}>
                  Trocar competição
                </button>
              </div>
              <SimilarResultsList matches={matches} leagueId={targetLeague} family={family} onClose={onClose} />
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
