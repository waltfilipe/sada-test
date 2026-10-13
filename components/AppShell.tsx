"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { POSITION_FAMILIES } from "@/lib/positions";

const NAV = [
  { href: "/filtros", label: "Filtros", icon: "⌕" },
  { href: "/posicao/zagueiros", label: "Posições", icon: "◎" },
  { href: "/comparar", label: "Comparar", icon: "⇄" },
  { href: "/scatter", label: "Scatter", icon: "◈" },
];

const LEGACY_SCOUT_PREFIXES = ["/posicao/", "/filtros", "/comparar", "/scatter", "/time-sombra", "/zagueiros-v2"];

function isScoutRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  if (/^\/(serie-a|serie-c)(\/|$)/.test(pathname)) return true;
  return LEGACY_SCOUT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isScoutPage = isScoutRoute(pathname);

  if (isScoutPage) {
    return <div className="app-shell scout-shell">{children}</div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">SA</span>
          <div>
            <strong>Série A Scout</strong>
            <small>2025/26</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${pathname.startsWith(item.href.split("/").slice(0, 2).join("/")) ? "active" : ""}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-section">
          <p className="sidebar-label">Posições</p>
          {POSITION_FAMILIES.map((family) => (
            <Link
              key={family.key}
              href={`/posicao/${family.slug}`}
              className={`sidebar-sublink ${pathname === `/posicao/${family.slug}` ? "active" : ""}`}
            >
              {family.label}
            </Link>
          ))}
        </div>
      </aside>
      <div className="app-main">{children}</div>
    </div>
  );
}
