import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hobby permite 12 funções por deploy. Cada rota que rastreia mais de ~225 MB
  // vira uma função própria; a pasta data/ inteira estoura isso. Heatmaps soltos,
  // perfis e famílias na raiz já estão embutidos nos JSON de cada liga.
  outputFileTracingExcludes: {
    "*": [
      "./data/heatmaps/**/*",
      "./data/profiles/**/*",
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
