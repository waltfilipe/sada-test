import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hobby permite 12 funções por deploy. A Vercel empacota rotas Node no
  // mesmo lambda até ~225 MB; acima disso cada rota vira uma função. Os
  // perfis por jogador repetem o que já está em family-*.json (~110 MB).
  outputFileTracingExcludes: {
    "*": [
      "./data/heatmaps/**/*",
      "./data/profiles/**/*",
      "./data/*/profiles/**/*",
      "./data/**/profiles/**/*",
      "./data/family-*.json",
      "./data/players.json",
      "./data/meta.json",
      "./data/transfermarkt-cache.json",
      "./data/transfermarkt-clubs.json",
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
    ],
  },
  allowedDevOrigins: ["*.agent.cvm.dev", "*.cvm.dev"],
  // Túnel same-origin para a API do SADA-Elencos (sync do time sombra via
  // /elencos/api/* → evita CORS no fetch). A navegação usa o domínio próprio
  // do app; o proxy integral fica como fallback para links antigos.
  async rewrites() {
    return [
      {
        source: "/elencos/:path*",
        destination: "https://sada-elencos.vercel.app/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.a.transfermarkt.technology",
        pathname: "/portrait/**",
      },
    ],
  },
};

export default nextConfig;
