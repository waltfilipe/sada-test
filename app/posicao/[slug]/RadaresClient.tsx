"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { ProfileRadars } from "@/components/position/profile/ProfileRadars";
import { useLeague } from "@/components/LeagueProvider";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  family: PositionFamily;
  familyLabel: string;
  players: PlayerProfile[];
};

export function RadaresClient({ family, familyLabel, players }: Props) {
  const { href, name } = useLeague();
  const params = useSearchParams();
  const initial = params.get("jogador") ?? players[0]?.player_id ?? "";
  const [playerId, setPlayerId] = useState(initial);
  const player = useMemo(
    () => players.find((item) => item.player_id === playerId) ?? players[0],
    [players, playerId],
  );

  return (
    <div className="scout-root radares-page">
      <ScoutTopbar active="posicoes" />
      <main className="radares-main">
        <header className="radares-head">
          <div>
            <p className="home-kicker">
              {name} · {familyLabel}
            </p>
            <h1>Radares de perfil</h1>
            <p>Afinidade e classificação no mesmo desenho do relatório, lado a lado.</p>
          </div>
          <Link className="radares-back" href={href(`/posicao/${family}`)}>
            Voltar ao dossiê
          </Link>
        </header>

        {player ? (
          <>
            <div className="radares-picker">
              <PlayerPhoto
                src={player.transfermarkt?.photo}
                alt=""
                className="radares-photo"
                fallback={<span className="radares-photo radares-photo-fallback">{playerInitials(player.name)}</span>}
              />
              <label>
                Atleta
                <select value={player.player_id} onChange={(event) => setPlayerId(event.target.value)}>
                  {players.map((item) => (
                    <option key={item.player_id} value={item.player_id}>
                      {item.name} · {item.club}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                <strong>{player.name}</strong>
                <span>
                  {player.club} · {player.position}
                </span>
              </p>
            </div>
            <ProfileRadars player={player} />
          </>
        ) : (
          <p>Nenhum atleta nesta posição.</p>
        )}
      </main>
    </div>
  );
}
