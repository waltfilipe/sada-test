"use client";

import Link from "next/link";
import { ClubLogo } from "@/components/ClubLogo";
import { ClusterTag, clusterTagProps } from "@/components/position/ClusterTag";
import { ProfileTag, profileTagProps } from "@/components/position/ProfileTag";
import { Tooltip } from "@/components/ui/Tooltip";
import { playerInitials, ratingTier, ratingToLetterGrade, tierVars } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Side = "a" | "b";

type Verdict = { winsA: number; winsB: number; total: number } | null;

type Props = {
  a: PlayerProfile;
  b: PlayerProfile;
  players: PlayerProfile[];
  family: PositionFamily;
  verdict: Verdict;
  onChangeA: (id: string) => void;
  onChangeB: (id: string) => void;
  onSwap: () => void;
};

function monthsRemaining(iso?: string | null): number | null {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month) return null;
  const end = new Date(year, month - 1, day || 1);
  const now = new Date();
  let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (end.getDate() < now.getDate()) months -= 1;
  return Math.max(0, months);
}

function DuelChip({
  icon,
  label,
  tone,
  tooltip,
  children,
}: {
  icon: string;
  label: string;
  tone?: "warn" | "danger";
  tooltip?: string;
  children: React.ReactNode;
}) {
  const chip = (
    <span className={`duel-chip${tone ? ` duel-chip-${tone}` : ""}`}>
      <i className={`fa-solid ${icon}`} aria-hidden="true" />
      <span className="duel-chip-copy">
        <em>{label}</em>
        <strong>{children}</strong>
      </span>
    </span>
  );
  if (!tooltip) return chip;
  return <Tooltip content={tooltip}>{chip}</Tooltip>;
}

function DuelSide({
  side,
  player,
  family,
}: {
  side: Side;
  player: PlayerProfile;
  family: PositionFamily;
}) {
  const tm = player.transfermarkt;
  const overall = player.ratings.geral ?? player.rating;
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const months = monthsRemaining(tm?.contract_until);
  const onLoanFrom = tm?.on_loan_from ?? null;
  const clusterProps = clusterTagProps(player);
  const contractTone: "warn" | "danger" | undefined =
    months != null && months < 6 ? "danger" : months != null && months < 12 ? "warn" : undefined;

  return (
    <div className={`duel-side side-${side}`}>
      <div className="duel-identity">
        <div className="duel-photo">
          {tm?.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tm.photo} alt={player.name} />
          ) : (
            <span className="duel-photo-fallback">{playerInitials(player.name)}</span>
          )}
        </div>

        <div className="duel-copy">
          <h2 className="duel-name">{player.name}</h2>
          <p className="duel-club">
            <ClubLogo club={player.club} size={16} />
            <span className="duel-club-name">{player.club}</span>
            <span aria-hidden="true">·</span>
            <span className="duel-position">{player.position}</span>
          </p>
          <div className="duel-tag-row">
            {clusterProps ? <ClusterTag {...clusterProps} /> : <ProfileTag {...profileTagProps(player)} />}
          </div>
        </div>

        {overall != null ? (
          <Tooltip content={`Avaliação no pool da posição · #${player.ranks.geral}`}>
            <div className="duel-rating" style={tierVars(ratingTier(overall))}>
              <span className="duel-rating-value duel-rating-letter">{ratingToLetterGrade(overall)}</span>
              <span className="duel-rating-rank">#{player.ranks.geral}</span>
            </div>
          </Tooltip>
        ) : null}
      </div>

      <div className="duel-meta">
        <div className="duel-chips">
          <DuelChip icon="fa-coins" label="Valor">
            {tm?.market_value ?? "—"}
          </DuelChip>
          <DuelChip
            icon={onLoanFrom ? "fa-right-left" : "fa-file-signature"}
            label={onLoanFrom ? "Empréstimo" : "Contrato"}
            tone={contractTone}
            tooltip={
              onLoanFrom
                ? `Emprestado por ${onLoanFrom}.`
                : contractTone === "danger"
                  ? "Contrato termina em menos de 6 meses."
                  : contractTone === "warn"
                    ? "Contrato termina em menos de 1 ano."
                    : undefined
            }
          >
            {months != null ? `${months} ${months === 1 ? "mês" : "meses"}` : "—"}
          </DuelChip>
          <DuelChip
            icon="fa-clock"
            label="Minutos"
            tooltip={
              player.minutes_pct != null
                ? `${Math.round(player.minutes_pct)}% dos minutos possíveis na competição`
                : undefined
            }
          >
            {player.minutes.toLocaleString("pt-BR")}
            {player.minutes_pct != null ? <small> · {Math.round(player.minutes_pct)}%</small> : null}
          </DuelChip>
        </div>

        <dl className="duel-facts">
          {age != null ? (
            <div>
              <dt>Idade</dt>
              <dd>{age}</dd>
            </div>
          ) : null}
          {player.height ? (
            <div>
              <dt>Altura</dt>
              <dd>{player.height}</dd>
            </div>
          ) : null}
          {player.foot ? (
            <div>
              <dt>Pé</dt>
              <dd>{player.foot}</dd>
            </div>
          ) : null}
          {player.nationality ? (
            <div>
              <dt>País</dt>
              <dd>{player.nationality}</dd>
            </div>
          ) : null}
        </dl>

        <div className="duel-actions">
          <Link className="duel-action-link" href={`/posicao/${family}?atleta=${player.player_id}`}>
            <i className="fa-solid fa-user" aria-hidden="true" /> Perfil
          </Link>
          {tm?.profile_url ? (
            <a className="duel-action-link" href={tm.profile_url} target="_blank" rel="noreferrer">
              <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Transfermarkt
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DuelHero({ a, b, players, family, verdict, onChangeA, onChangeB, onSwap }: Props) {
  return (
    <section className="duel-card" aria-label={`Comparação: ${a.name} vs ${b.name}`}>
      <div className="duel-pickers">
        <label className="duel-picker side-a">
          <span>Atleta 1</span>
          <select value={a.player_id} onChange={(event) => onChangeA(event.target.value)}>
            {players.map((option) => (
              <option key={option.player_id} value={option.player_id}>
                {option.name} — {option.club}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="duel-swap" onClick={onSwap} aria-label="Inverter atletas">
          <i className="fa-solid fa-right-left" aria-hidden="true" />
        </button>

        <label className="duel-picker side-b">
          <span>Atleta 2</span>
          <select value={b.player_id} onChange={(event) => onChangeB(event.target.value)}>
            {players.map((option) => (
              <option key={option.player_id} value={option.player_id}>
                {option.name} — {option.club}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="duel-grid">
        <DuelSide side="a" player={a} family={family} />

        <div className="duel-pivot" aria-label="Placar de indicadores">
          <span className="duel-vs">VS</span>
          {verdict ? (
            <>
              <p className="duel-score">
                <b className="side-a tabular">{verdict.winsA}</b>
                <i aria-hidden="true">–</i>
                <b className="side-b tabular">{verdict.winsB}</b>
              </p>
              <span className="duel-score-note">de {verdict.total} indicadores</span>
            </>
          ) : null}
        </div>

        <DuelSide side="b" player={b} family={family} />
      </div>
    </section>
  );
}
