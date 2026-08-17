import type { PlayerProfile } from "@/lib/types";

export function gradeTone(grade: string): "excellent" | "good" | "average" | "weak" {
  const g = grade.trim().toUpperCase().replace("−", "-");
  if (g.startsWith("A")) return "excellent";
  if (g.startsWith("B")) return "good";
  if (g.startsWith("C")) return "average";
  return "weak";
}

export function profileTone(profile: string): string {
  switch (profile) {
    case "Combativo":
      return "combativo";
    case "Construtor":
      return "construtor";
    case "Posicional":
      return "posicional";
    default:
      return "hibrido";
  }
}

export function playerInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function percentileLabel(value: number): string {
  if (value >= 85) return "Elite";
  if (value >= 70) return "Alto";
  if (value >= 45) return "Médio";
  return "Baixo";
}

export function sortPlayers(players: PlayerProfile[], sort: "rating" | "name" | "minutes") {
  const copy = [...players];
  if (sort === "name") return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "minutes") return copy.sort((a, b) => b.minutes - a.minutes);
  return copy.sort((a, b) => b.rating - a.rating);
}

export const TENDENCY_META = [
  { key: "construcao", label: "Construção", hint: "Qualidade na saída e progressão de bola" },
  { key: "ofensividade", label: "Ofensividade", hint: "Impacto em ações com a bola no terço ofensivo" },
  { key: "def1v1", label: "1vs1 Defensivo", hint: "Eficiência em duelos e confrontos defensivos" },
  { key: "contencao", label: "Contenção", hint: "Leitura e contenção defensiva" },
  { key: "duelo_aereo", label: "Duelo Aéreo", hint: "Domínio em disputas aéreas" },
] as const;

export const PROFILE_META = [
  { key: "combativo", label: "Combativo" },
  { key: "construtor", label: "Construtor" },
  { key: "posicional", label: "Posicional" },
] as const;
