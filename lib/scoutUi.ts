import type { PlayerProfile } from "@/lib/types";

/** Maps a profile name to the CSS tone class used for its accent colour. */
export function profileTone(profile: string): string {
  switch (profile) {
    case "Combativo":
      return "combativo";
    case "Construtor":
      return "construtor";
    case "Posicional":
      return "posicional";
    case "Defensivo":
      return "defensivo";
    case "Vertical":
    case "Ruptura":
      return "vertical";
    case "Ofensivo":
      return "ofensivo";
    case "Contenção":
      return "contencao";
    case "Box-to-box":
    case "Box to Box":
      return "boxtobox";
    case "Criador":
    case "Driblador":
      return "criador";
    case "Meia Ponta":
      return "meia-ponta";
    case "Armador":
    case "Meia Armador":
      return "armador";
    case "Finalizador":
    case "Meia Atacante":
      return "finalizador";
    case "Alvo":
      return "alvo";
    case "Móvel":
      return "movel";
    default:
      return "hibrido";
  }
}

export function sortPlayers(players: PlayerProfile[], sort: "rating" | "name" | "minutes") {
  const copy = [...players];
  if (sort === "name") return copy.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  if (sort === "minutes") return copy.sort((a, b) => b.minutes - a.minutes);
  return copy.sort((a, b) => b.rating - a.rating);
}
