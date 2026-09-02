"use client";

import Link from "next/link";
import type { ReactNode } from "react";

const NAV = [
  { key: "posicoes", href: "/posicao/zagueiros", label: "Posições" },
  { key: "filtros", href: "/filtros", label: "Filtros" },
  { key: "comparar", href: "/comparar", label: "Comparar" },
  { key: "scatter", href: "/scatter", label: "Scatter" },
  { key: "time-sombra", href: "/time-sombra", label: "Time Sombra" },
] as const;

type Props = {
  active: (typeof NAV)[number]["key"];
  center?: ReactNode;
};

export function ScoutTopbar({ active, center }: Props) {
  return (
    <header className="scout-topbar">
      <Link href="/" className="scout-brand">
        <span className="sc-brand-mark">SA</span>
        <span className="sc-brand-copy">
          <strong>Série A Scout</strong>
          <em>Temporada 2025/26</em>
        </span>
      </Link>

      {center}

      <nav className="topbar-links" aria-label="Seções">
        {NAV.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={item.key === active ? "active" : ""}
            aria-current={item.key === active ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
