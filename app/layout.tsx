import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "@fontsource-variable/tasa-orbiter";
import "./globals.css";
import "./scout.css";
import "./profile-layout.css";
import "./filters.css";
import "./compare.css";
import "./scatter.css";
import "./time-sombra.css";
import "./home.css";
import "./zag-v2.css";

export const metadata: Metadata = {
  title: "Brasil Scout",
  description: "Dashboard de scouting da Série A e Série C com ratings, perfis e comparações.",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
