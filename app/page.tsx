import Link from "next/link";
import { SiteLogo } from "@/components/SiteLogo";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { ESTADUAIS_LEVELS } from "@/lib/estaduaisHub";
import { BRASILEIRAO_LEAGUES } from "@/lib/leagues";

export default function HubPage() {
  return (
    <div className="scout-root home-page hub-page">
      <ScoutTopbar active="inicio" hubMode />
      <main className="home-main hub-main">
        <section className="home-hero hub-hero">
          <SiteLogo variant="stacked" className="hub-logo" />
          <p className="home-kicker">Temporada 2026</p>
          <h1>Escolha onde olhar.</h1>
          <p className="home-lead">
            Séries nacionais e estaduais por nível. Dentro de um nível, zagueiros, laterais e o restante são comparados
            só com quem joga naquele grupo.
          </p>
        </section>

        <section className="home-section" aria-labelledby="hub-serie-title">
          <h2 id="hub-serie-title">Brasileirão</h2>
          <div className="hub-serie-grid">
            {BRASILEIRAO_LEAGUES.map((league) => (
              <Link key={league.id} href={`/${league.id}/posicao/zagueiros`} className="hub-serie-card">
                <img src={league.logo} alt="" className="hub-serie-logo" />
                <span>
                  <strong>{league.name}</strong>
                  <em>{league.season}</em>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-section" aria-labelledby="hub-est-title">
          <h2 id="hub-est-title">Estaduais</h2>
          <div className="hub-level-grid">
            {ESTADUAIS_LEVELS.map((level) => (
              <Link key={level.id} href={`/${level.id}/posicao/zagueiros`} className="hub-level-card">
                <span className="hub-level-kicker">Um pool só</span>
                <strong>{level.name}</strong>
                <p>{level.hint}</p>
                <span className="hub-level-marks">
                  {level.members.map((member) => (
                    <img key={member.id} src={member.logo} alt={member.name} title={member.name} className="hub-mini-logo" />
                  ))}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
