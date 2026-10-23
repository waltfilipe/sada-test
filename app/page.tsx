import Link from "next/link";
import { SiteLogo } from "@/components/SiteLogo";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { ESTADUAIS_HUB } from "@/lib/estaduaisHub";
import { BRASILEIRAO_LEAGUES } from "@/lib/leagues";

export default function HubPage() {
  return (
    <div className="scout-root home-page hub-page">
      <ScoutTopbar active="inicio" hubMode />
      <main className="home-main hub-main">
        <section className="home-hero hub-hero">
          <SiteLogo variant="stacked" className="hub-logo" />
          <p className="home-kicker">Scouting · 2026</p>
          <h1>Escolha a competição</h1>
          <p className="home-lead">
            Brasileirão (Séries A–D) e campeonatos estaduais. Depois de entrar, use Posições, Filtros, Comparar e
            Scatter no menu superior.
          </p>
        </section>

        <section className="home-section" aria-labelledby="hub-serie-title">
          <h2 id="hub-serie-title">Brasileirão</h2>
          <div className="hub-league-grid">
            {BRASILEIRAO_LEAGUES.map((league) => (
              <Link key={league.id} href={`/${league.id}/posicao/zagueiros`} className="hub-league-card">
                <span className="hub-league-mark">{league.brand}</span>
                <strong>{league.name}</strong>
                <em>{league.season}</em>
                <span className="home-card-go">Entrar</span>
              </Link>
            ))}
          </div>
        </section>

        {ESTADUAIS_HUB.map((tier) => (
          <section key={tier.label} className="home-section" aria-labelledby={`hub-${tier.label}`}>
            <h2 id={`hub-${tier.label}`}>{tier.label}</h2>
            <div className="hub-league-grid">
              {tier.items.map((item) => (
                <Link key={item.id} href={`/${item.id}/posicao/zagueiros`} className="hub-league-card hub-league-card-estadual">
                  <span className="hub-league-mark">{item.brand}</span>
                  <strong>{item.name}</strong>
                  <em>2026</em>
                  <span className="home-card-go">Entrar</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
