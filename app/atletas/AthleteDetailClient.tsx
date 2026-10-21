"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { useLeague } from "@/components/LeagueProvider";
import type { AthleteDetail } from "@/lib/athletes.types";
import { playerInitials } from "@/lib/scoutTheme";

type Props = {
  detail: AthleteDetail;
};

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits).replace(".", ",");
}

export function AthleteDetailClient({ detail }: Props) {
  const { href } = useLeague();
  const defaultSeason = detail.current ? "2026" : "2025";
  const [season, setSeason] = useState(defaultSeason);

  const tabs = useMemo(
    () => detail.seasons.map((s) => s.season).sort((a, b) => b.localeCompare(a)),
    [detail.seasons],
  );

  const show2026 = season === "2026" && detail.current;
  const show2025 = season === "2025" && detail.archive2025;

  return (
    <>
      <ScoutTopbar active="atletas" />
      <main className="athletes-page">
        <Link href={href("/atletas")} className="athlete-detail-back">
          ← Voltar para Atletas
        </Link>

        <header className="athlete-detail-hero">
          <PlayerPhoto
            src={detail.photo}
            alt=""
            className="athlete-detail-photo"
            fallback={
              <span className="athlete-detail-photo athlete-card-photo-fallback">{playerInitials(detail.name)}</span>
            }
          />
          <div>
            <h1 className="athlete-detail-name">{detail.name}</h1>
            <p className="athlete-detail-meta">
              {detail.club} · {detail.position}
              {detail.current?.summary.profile ? ` · ${detail.current.summary.profile}` : ""}
            </p>
          </div>
        </header>

        <div className="athlete-season-tabs" role="tablist" aria-label="Temporadas">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={season === tab}
              className={`athlete-season-tab ${season === tab ? "is-active" : ""}`}
              onClick={() => setSeason(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {show2026 && detail.current ? (
          <section aria-label="Temporada 2026">
            <div className="athlete-stat-grid">
              <div className="athlete-stat-card">
                <b>{detail.current.summary.rating.toFixed(1)}</b>
                <span>Nota scout</span>
              </div>
              <div className="athlete-stat-card">
                <b>{detail.current.summary.minutes}</b>
                <span>Minutos</span>
              </div>
              <div className="athlete-stat-card">
                <b>{detail.current.profile?.goals ?? 0}</b>
                <span>Gols</span>
              </div>
              <div className="athlete-stat-card">
                <b>{detail.current.profile?.assists ?? 0}</b>
                <span>Assistências</span>
              </div>
              <div className="athlete-stat-card">
                <b>{detail.current.summary.minutes_pct != null ? `${detail.current.summary.minutes_pct.toFixed(0)}%` : "—"}</b>
                <span>Minutos no elenco</span>
              </div>
              <div className="athlete-stat-card">
                <b>{detail.current.summary.nationality ?? "—"}</b>
                <span>Nacionalidade</span>
              </div>
            </div>
            {detail.current.summary.position_family ? (
              <p className="athlete-detail-actions">
                <Link
                  className="btn btn-primary btn-sm"
                  href={href(`/posicao/${detail.current.summary.position_family}?atleta=${encodeURIComponent(detail.athlete_id)}`)}
                >
                  Ver dossiê completo (2026)
                </Link>
              </p>
            ) : null}
          </section>
        ) : null}

        {show2025 && detail.archive2025 ? (
          <section aria-label="Temporada 2025">
            <div className="athlete-stat-grid">
              <div className="athlete-stat-card">
                <b>{detail.archive2025.minutes}</b>
                <span>Minutos</span>
              </div>
              <div className="athlete-stat-card">
                <b>{detail.archive2025.matches}</b>
                <span>Jogos</span>
              </div>
              <div className="athlete-stat-card">
                <b>{detail.archive2025.goals}</b>
                <span>Gols</span>
              </div>
              <div className="athlete-stat-card">
                <b>{detail.archive2025.assists}</b>
                <span>Assistências</span>
              </div>
              <div className="athlete-stat-card">
                <b>{fmt(detail.archive2025.xg, 2)}</b>
                <span>xG</span>
              </div>
              <div className="athlete-stat-card">
                <b>{fmt(detail.archive2025.xa, 2)}</b>
                <span>xA</span>
              </div>
              <div className="athlete-stat-card">
                <b>{fmt(detail.archive2025.highlights.gols_90)}</b>
                <span>Gols/90</span>
              </div>
              <div className="athlete-stat-card">
                <b>{fmt(detail.archive2025.highlights.passes_90)}</b>
                <span>Passes/90</span>
              </div>
              <div className="athlete-stat-card">
                <b>{fmt(detail.archive2025.highlights.passes_certos_pct, 0)}%</b>
                <span>Passes certos</span>
              </div>
              <div className="athlete-stat-card">
                <b>{fmt(detail.archive2025.highlights.passes_progressivos_90)}</b>
                <span>Passes prog./90</span>
              </div>
              <div className="athlete-stat-card">
                <b>{fmt(detail.archive2025.highlights.duelos_90)}</b>
                <span>Duelos/90</span>
              </div>
              <div className="athlete-stat-card">
                <b>{fmt(detail.archive2025.highlights.acoes_def_90)}</b>
                <span>Ações def./90</span>
              </div>
            </div>
          </section>
        ) : null}

        {!show2026 && !show2025 ? (
          <p className="similar-cross-hint">Sem dados para a temporada selecionada.</p>
        ) : null}
      </main>
    </>
  );
}
