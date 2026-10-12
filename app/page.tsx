import Link from "next/link";
import { LEAGUES } from "@/lib/leagues";

export default function HubPage() {
  return (
    <div className="scout-root home-page hub-page">
      <main className="home-main hub-main">
        <section className="home-hero hub-hero">
          <p className="home-kicker">Brasil · Scouting</p>
          <h1>Escolha a competição</h1>
          <p className="home-lead">
            Mesmas ferramentas para cada liga: posições, filtros, comparar, scatter e time sombra.
          </p>
        </section>

        <section className="home-section" aria-labelledby="hub-leagues-title">
          <h2 id="hub-leagues-title">Ligas disponíveis</h2>
          <div className="hub-league-grid">
            {LEAGUES.map((league) => (
              <Link key={league.id} href={`/${league.id}`} className="hub-league-card">
                <span className="hub-league-mark">{league.brand}</span>
                <strong>{league.name}</strong>
                <em>{league.season}</em>
                <span className="home-card-go">Entrar</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
