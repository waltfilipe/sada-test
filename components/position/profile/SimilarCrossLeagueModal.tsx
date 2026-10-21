"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LEAGUES, leaguePath, type LeagueId } from "@/lib/leagues";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import type { SimilarPlayerHit } from "@/lib/crossLeagueSimilarity";
import { ClubLogo } from "@/components/ClubLogo";

type Step = "pick-league" | "loading" | "results" | "error";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  currentLeagueId: LeagueId;
  onClose: () => void;
};

export function SimilarCrossLeagueModal({ player, family, currentLeagueId, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("pick-league");
  const [targetLeague, setTargetLeague] = useState<LeagueId | null>(null);
  const [matches, setMatches] = useState<SimilarPlayerHit[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const otherLeagues = LEAGUES.filter((league) => league.id !== currentLeagueId);

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
          <h3>Similares em outra divisão</h3>
          <button type="button" className="stat-window-close" onClick={onClose} aria-label="Fechar">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <div className="stat-window-body">
          <p className="similar-cross-intro">
            Referência: <strong>{player.name}</strong> · {player.profile}
            <span className="similar-cross-intro-note">
              Comparação por ações certas por 90, com % total e por bloco do dossiê.
            </span>
          </p>

          {step === "pick-league" ? (
            <div className="similar-league-pick">
              <p className="similar-cross-hint">Escolha a divisão para comparar o estilo de jogo:</p>
              <div className="similar-league-buttons">
                {otherLeagues.map((league) => (
                  <button
                    key={league.id}
                    type="button"
                    className="btn btn-primary similar-league-btn"
                    onClick={() => {
                      setTargetLeague(league.id);
                      void fetchSimilar(league.id);
                    }}
                  >
                    <span className="similar-league-brand">{league.brand}</span>
                    <span>
                      {league.name}
                      <span className="similar-league-season">{league.season}</span>
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

          {step === "results" ? (
            <>
              <div className="similar-results-head">
                <span>
                  Top 5 · {LEAGUES.find((l) => l.id === targetLeague)?.name}
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep("pick-league")}>
                  Trocar divisão
                </button>
              </div>
              {matches.length === 0 ? (
                <p className="similar-cross-hint">Nenhum atleta com minutos suficientes nessa posição.</p>
              ) : (
                <ul className="similar-results-list">
                  {matches.map((hit, index) => (
                    <li key={hit.player_id}>
                      <Link
                        href={leaguePath(
                          targetLeague!,
                          `/posicao/${family}?atleta=${encodeURIComponent(hit.player_id)}`,
                        )}
                        className="similar-result-row"
                        onClick={onClose}
                      >
                        <span className="similar-result-rank">{index + 1}</span>
                        <span className="similar-result-main">
                          <span className="similar-result-name">{hit.name}</span>
                          <span className="similar-result-meta">
                            <ClubLogo club={hit.club} size={14} />
                            {hit.club} · {hit.profile} · {hit.rating.toFixed(1)}
                          </span>
                          {hit.blocks.length ? (
                            <span className="similar-result-blocks">
                              <span className="similar-result-blocks-total tabular">
                                Total {hit.similarity}%
                              </span>
                              {hit.blocks.map((block) => (
                                <span key={block.title} className="similar-result-block-chip tabular">
                                  {block.title} {block.similarity}%
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </span>
                        <span className="similar-result-pct tabular">{hit.similarity}%</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
