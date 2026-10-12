import Link from "next/link";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { getMeta } from "@/lib/data.server";
import { POSITION_FAMILIES } from "@/lib/positions";

const SECTIONS = [
  {
    href: "/posicao/zagueiros",
    kicker: "Dossiê",
    title: "Posições",
    text: "Perfil, heatmap e notas de cada atleta, organizados por posição.",
  },
  {
    href: "/filtros",
    kicker: "Busca",
    title: "Filtros",
    text: "Cruze clube, idade, minutagem, pé e tendências para achar o perfil certo.",
  },
  {
    href: "/comparar",
    kicker: "Duelo",
    title: "Comparar",
    text: "Coloque dois ou três atletas da mesma posição lado a lado.",
  },
  {
    href: "/scatter",
    kicker: "Mapa",
    title: "Scatter",
    text: "Veja a posição inteira num gráfico e encontre quem se destaca.",
  },
  {
    href: "/time-sombra",
    kicker: "Elenco",
    title: "Time Sombra",
    text: "Monte a escalação, o banco e a lista de observação.",
  },
] as const;

export default function HomePage() {
  const meta = getMeta();
  const counts = new Map(meta.families.map((family) => [family.key, family.count]));

  return (
    <div className="scout-root home-page">
      <ScoutTopbar active="inicio" />

      <main className="home-main">
        <section className="home-hero">
          <p className="home-kicker">
            {meta.league} · {meta.season}
          </p>
          <h1>Scouting da Série A em um só lugar.</h1>
          <p className="home-lead">
            Ratings por perfil, comparações e um time sombra para acompanhar os atletas da temporada.
          </p>
          <div className="home-hero-actions">
            <Link className="home-cta" href="/posicao/zagueiros">
              Explorar posições
            </Link>
            <Link className="home-cta home-cta-ghost" href="/time-sombra">
              Abrir Time Sombra
            </Link>
          </div>
          <dl className="home-stats">
            <div>
              <dt>Atletas</dt>
              <dd className="tabular">{meta.player_count}</dd>
            </div>
            <div>
              <dt>Clubes</dt>
              <dd className="tabular">{meta.clubs.length}</dd>
            </div>
            <div>
              <dt>Posições</dt>
              <dd className="tabular">{POSITION_FAMILIES.length}</dd>
            </div>
          </dl>
        </section>

        <section className="home-section" aria-labelledby="home-sections-title">
          <h2 id="home-sections-title">O que você pode fazer</h2>
          <div className="home-cards">
            {SECTIONS.map((section) => (
              <Link key={section.href} href={section.href} className="home-card">
                <span className="home-card-kicker">{section.kicker}</span>
                <strong>{section.title}</strong>
                <p>{section.text}</p>
                <span className="home-card-go">Abrir</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-section" aria-labelledby="home-positions-title">
          <h2 id="home-positions-title">Entrar por posição</h2>
          <div className="home-positions">
            <Link href="/zagueiros-v2" className="home-position">
              <span className="home-position-short">V2</span>
              <span className="home-position-copy">
                <strong>Zagueiros v2</strong>
                <em>Lista à esquerda · teste</em>
              </span>
            </Link>
            {POSITION_FAMILIES.map((family) => (
              <Link key={family.key} href={`/posicao/${family.slug}`} className="home-position">
                <span className="home-position-short">{family.short}</span>
                <span className="home-position-copy">
                  <strong>{family.label}</strong>
                  <em className="tabular">{counts.get(family.key) ?? 0} atletas</em>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
