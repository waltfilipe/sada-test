"use client";

import { useEffect, useMemo, useState } from "react";
import { AspectPanel, PlayerIdentityCard, RatingStrip, TendencyBars } from "@/components/PlayerCards";
import { RadarChart } from "@/components/Charts";
import { POSITION_FAMILIES } from "@/lib/positions";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
};

export function PosicaoClient({ family, players }: Props) {
  const [selectedId, setSelectedId] = useState(players[0]?.player_id ?? "");
  const [profiles, setProfiles] = useState<string[]>([]);
  const familyMeta = POSITION_FAMILIES.find((f) => f.key === family)!;

  const filtered = useMemo(() => {
    if (!profiles.length) return players;
    return players.filter((player) => profiles.includes(player.profile) || player.profile === "Híbrido");
  }, [players, profiles]);

  const selected = filtered.find((player) => player.player_id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (filtered.length && !filtered.some((p) => p.player_id === selectedId)) {
      setSelectedId(filtered[0].player_id);
    }
  }, [filtered, selectedId]);

  const toggleProfile = (profile: string) => {
    setProfiles((current) =>
      current.includes(profile) ? current.filter((p) => p !== profile) : [...current, profile],
    );
  };

  if (!selected) {
    return <div className="page"><p className="muted">Nenhum jogador disponível para esta posição.</p></div>;
  }

  return (
    <div className="page posicao-page">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">{familyMeta.label}</p>
          <h1>Análise por posição</h1>
        </div>
        <div className="header-pill">{filtered.length} jogadores analisados</div>
      </header>

      <div className="posicao-layout">
        <aside className="panel posicao-sidebar">
          <div className="profile-checks">
            <span>Perfil</span>
            <div className="checks">
              {selected.profiles_available.map((profile) => (
                <label key={profile}>
                  <input type="checkbox" checked={profiles.includes(profile)} onChange={() => toggleProfile(profile)} />
                  {profile}
                </label>
              ))}
            </div>
          </div>

          <label className="player-select">
            Jogadores
            <select value={selected.player_id} onChange={(e) => setSelectedId(e.target.value)}>
              {filtered.map((player) => (
                <option key={player.player_id} value={player.player_id}>
                  {player.label}
                </option>
              ))}
            </select>
          </label>

          <div className="position-switch vertical">
            {POSITION_FAMILIES.map((item) => (
              <a key={item.key} href={`/posicao/${item.slug}`} className={item.key === family ? "active" : ""}>
                {item.label}
              </a>
            ))}
          </div>
        </aside>

        <section className="panel posicao-main">
          <div className="posicao-grid">
            <PlayerIdentityCard player={selected} />
            <RatingStrip player={selected} />
            <div className="aspect-grid">
              <AspectPanel title="Aspectos Defensivos" items={selected.aspects.defensivos} />
              <AspectPanel title="Aspectos de Construção" items={selected.aspects.construcao} />
              <AspectPanel title="Aspectos Ofensivos" items={selected.aspects.ofensivos} />
            </div>
          </div>

          <div className="profile-analysis">
            <div className="profile-summary">
              <h3>Perfil: {selected.profile}</h3>
              <div className="profile-shares">
                <span>Combativo {selected.profile_shares.combativo}%</span>
                <span>Construtor {selected.profile_shares.construtor}%</span>
                <span>Posicional {selected.profile_shares.posicional}%</span>
              </div>
              <RadarChart
                labels={["Combativo", "Posicional", "Construtor"]}
                values={[
                  selected.profile_shares.combativo,
                  selected.profile_shares.posicional,
                  selected.profile_shares.construtor,
                ]}
                color="#f59e0b"
              />
            </div>
            <TendencyBars tendencies={selected.tendencies} />
          </div>
        </section>
      </div>
    </div>
  );
}
