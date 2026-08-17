"use client";

import { useEffect, useMemo, useState } from "react";
import { RangeFilter } from "@/components/RangeFilter";
import { formatRating, ratingColor, POSITION_FAMILIES } from "@/lib/positions";
import type { PlayerProfile, PlayerSummary, PositionFamily, SiteMeta } from "@/lib/types";

type Props = {
  meta: SiteMeta;
  initialPlayers: PlayerSummary[];
};

export function FiltrosClient({ meta, initialPlayers }: Props) {
  const [family, setFamily] = useState<PositionFamily>("zagueiros");
  const [club, setClub] = useState("all");
  const [nationality, setNationality] = useState("all");
  const [foot, setFoot] = useState("all");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<PlayerProfile | null>(null);
  const [height, setHeight] = useState<[number, number]>(meta.filters.height);
  const [minutes, setMinutes] = useState<[number, number]>(meta.filters.minutes);
  const [birthYear, setBirthYear] = useState<[number, number]>(meta.filters.birth_year);
  const [rating, setRating] = useState<[number, number]>(meta.filters.rating);
  const [tendencies, setTendencies] = useState({
    construcao: [0, 100] as [number, number],
    ofensividade: [0, 100] as [number, number],
    def1v1: [0, 100] as [number, number],
    contencao: [0, 100] as [number, number],
    duelo_aereo: [0, 100] as [number, number],
  });

  const familyMeta = meta.families.find((f) => f.key === family)!;

  const filtered = useMemo(() => {
    return initialPlayers.filter((player) => {
      if (player.position_family !== family) return false;
      if (club !== "all" && player.club !== club) return false;
      if (nationality !== "all" && player.nationality !== nationality) return false;
      if (foot !== "all" && player.foot !== foot) return false;
      if (profiles.length && !profiles.includes(player.profile) && player.profile !== "Híbrido") return false;
      if (player.height != null && (player.height < height[0] || player.height > height[1])) return false;
      if (player.minutes < minutes[0] || player.minutes > minutes[1]) return false;
      if (player.birth_year != null && (player.birth_year < birthYear[0] || player.birth_year > birthYear[1])) return false;
      if (player.rating < rating[0] || player.rating > rating[1]) return false;
      return true;
    });
  }, [initialPlayers, family, club, nationality, foot, profiles, height, minutes, birthYear, rating]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      setSelectedProfile(null);
      return;
    }
    if (!selectedId || !filtered.some((p) => p.player_id === selectedId)) {
      setSelectedId(filtered[0].player_id);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/players/${selectedId}`)
      .then((res) => res.json())
      .then((data: PlayerProfile) => {
        setSelectedProfile(data);
        if (
          data.tendencies.construcao < tendencies.construcao[0] ||
          data.tendencies.construcao > tendencies.construcao[1] ||
          data.tendencies.ofensividade < tendencies.ofensividade[0] ||
          data.tendencies.ofensividade > tendencies.ofensividade[1] ||
          data.tendencies.def1v1 < tendencies.def1v1[0] ||
          data.tendencies.def1v1 > tendencies.def1v1[1] ||
          data.tendencies.contencao < tendencies.contencao[0] ||
          data.tendencies.contencao > tendencies.contencao[1] ||
          data.tendencies.duelo_aereo < tendencies.duelo_aereo[0] ||
          data.tendencies.duelo_aereo > tendencies.duelo_aereo[1]
        ) {
          // tendency filters are applied client-side after profile fetch
        }
      })
      .catch(() => setSelectedProfile(null));
  }, [selectedId]);

  const tendencyFiltered = useMemo(() => {
    if (!selectedProfile) return filtered;
    const t = selectedProfile.tendencies;
    const matchesTendencies = (profile: PlayerProfile | null) => {
      if (!profile) return true;
      return (
        profile.tendencies.construcao >= tendencies.construcao[0] &&
        profile.tendencies.construcao <= tendencies.construcao[1] &&
        profile.tendencies.ofensividade >= tendencies.ofensividade[0] &&
        profile.tendencies.ofensividade <= tendencies.ofensividade[1] &&
        profile.tendencies.def1v1 >= tendencies.def1v1[0] &&
        profile.tendencies.def1v1 <= tendencies.def1v1[1] &&
        profile.tendencies.contencao >= tendencies.contencao[0] &&
        profile.tendencies.contencao <= tendencies.contencao[1] &&
        profile.tendencies.duelo_aereo >= tendencies.duelo_aereo[0] &&
        profile.tendencies.duelo_aereo <= tendencies.duelo_aereo[1]
      );
    };
    return filtered.filter((player) => {
      if (player.player_id === selectedId) return matchesTendencies(selectedProfile);
      return true;
    });
  }, [filtered, selectedProfile, selectedId, tendencies]);

  const toggleProfile = (profile: string) => {
    setProfiles((current) =>
      current.includes(profile) ? current.filter((p) => p !== profile) : [...current, profile],
    );
  };

  return (
    <div className="page filtros-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Explorar elenco</p>
          <h1>Filtros de jogadores</h1>
          <p className="lede">Refine por posição, clube, perfil e métricas normalizadas do modelo.</p>
        </div>
        <div className="header-pill">{tendencyFiltered.length} atletas</div>
      </header>

      <div className="filtros-layout">
        <section className="panel filters-panel">
          <div className="position-switch">
            {POSITION_FAMILIES.map((item) => (
              <button
                key={item.key}
                className={family === item.key ? "active" : ""}
                onClick={() => setFamily(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="field-grid">
            <label>
              Clubes
              <select value={club} onChange={(e) => setClub(e.target.value)}>
                <option value="all">Todos</option>
                {meta.clubs.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nacionalidade
              <select value={nationality} onChange={(e) => setNationality(e.target.value)}>
                <option value="all">Todos</option>
                {meta.nationalities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pé dominante
              <select value={foot} onChange={(e) => setFoot(e.target.value)}>
                <option value="all">Todos</option>
                <option value="Destro">Destro</option>
                <option value="Canhoto">Canhoto</option>
                <option value="Ambidestro">Ambidestro</option>
              </select>
            </label>
          </div>

          <div className="profile-checks">
            <span>Perfil</span>
            <div className="checks">
              {familyMeta.profiles.map((profile) => (
                <label key={profile}>
                  <input
                    type="checkbox"
                    checked={profiles.includes(profile)}
                    onChange={() => toggleProfile(profile)}
                  />
                  {profile}
                </label>
              ))}
            </div>
          </div>

          <div className="range-grid">
            <RangeFilter label="Altura" min={meta.filters.height[0]} max={meta.filters.height[1]} value={height} onChange={setHeight} />
            <RangeFilter label="Minutagem" min={meta.filters.minutes[0]} max={meta.filters.minutes[1]} value={minutes} onChange={setMinutes} />
            <RangeFilter label="Nascimento" min={meta.filters.birth_year[0]} max={meta.filters.birth_year[1]} value={birthYear} onChange={setBirthYear} />
            <RangeFilter label="Rating" min={meta.filters.rating[0]} max={meta.filters.rating[1]} value={rating} onChange={setRating} format={(v) => v.toFixed(1)} />
            <RangeFilter label="Construção" min={0} max={100} value={tendencies.construcao} onChange={(v) => setTendencies((t) => ({ ...t, construcao: v }))} />
            <RangeFilter label="Ofensividade" min={0} max={100} value={tendencies.ofensividade} onChange={(v) => setTendencies((t) => ({ ...t, ofensividade: v }))} />
            <RangeFilter label="1vs1 - Defensivo" min={0} max={100} value={tendencies.def1v1} onChange={(v) => setTendencies((t) => ({ ...t, def1v1: v }))} />
            <RangeFilter label="Contenção" min={0} max={100} value={tendencies.contencao} onChange={(v) => setTendencies((t) => ({ ...t, contencao: v }))} />
            <RangeFilter label="Duelo Aéreo" min={0} max={100} value={tendencies.duelo_aereo} onChange={(v) => setTendencies((t) => ({ ...t, duelo_aereo: v }))} />
          </div>
        </section>

        <section className="panel list-panel">
          <div className="panel-title">
            <span>Selecionar</span>
            <strong>Atletas filtrados</strong>
          </div>
          <div className="player-list">
            {tendencyFiltered.map((player) => (
              <button
                key={player.player_id}
                className={`player-list-item ${selectedId === player.player_id ? "active" : ""}`}
                onClick={() => setSelectedId(player.player_id)}
              >
                <div>
                  <strong>{player.name}</strong>
                  <span>{player.club}</span>
                </div>
                <em style={{ color: ratingColor(player.rating) }}>{formatRating(player.rating)}</em>
              </button>
            ))}
          </div>
        </section>

        <section className="panel preview-panel">
          {selectedProfile ? (
            <>
              <div className="preview-top">
                <div>
                  <p className="eyebrow">{selectedProfile.position}</p>
                  <h2>{selectedProfile.name}</h2>
                  <p>{selectedProfile.club}</p>
                </div>
                <div className="preview-rating" style={{ color: ratingColor(selectedProfile.rating) }}>
                  {formatRating(selectedProfile.rating)}
                </div>
              </div>
              <div className="preview-grid">
                <div><span>Ano</span><strong>{selectedProfile.birth_year}</strong></div>
                <div><span>Nacionalidade</span><strong>{selectedProfile.nationality}</strong></div>
                <div><span>Altura</span><strong>{selectedProfile.height}</strong></div>
                <div><span>Pé dominante</span><strong>{selectedProfile.foot}</strong></div>
              </div>
              <div className="preview-stats">
                <div><span>Minutagem</span><strong>{selectedProfile.minutes}</strong></div>
                <div><span>Gols/Assist.</span><strong>{selectedProfile.goals} / {selectedProfile.assists}</strong></div>
                <div><span>Perfil</span><strong>{selectedProfile.profile}</strong></div>
              </div>
            </>
          ) : (
            <p className="muted">Selecione um jogador para visualizar o resumo.</p>
          )}
        </section>
      </div>
    </div>
  );
}
