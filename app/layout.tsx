import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";
import "./scout.css";
import "./profile-layout.css";
import "./filters.css";
import "./compare.css";
import "./scatter.css";

export const metadata: Metadata = {
  title: "Série A Scout",
  description: "Dashboard de scouting da Série A com ratings, perfis e comparações.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Sora:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
