import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { playerSectionScore } from "@/lib/sectionGrades";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

function givenName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function joinPt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function sectionPhrase(title: string): string {
  const map: Record<string, string> = {
    Defensivos: "defesa",
    Aéreo: "jogo aéreo",
    "Duelos Aéreos": "jogo aéreo",
    Passes: "passe",
    "Dribles e Condução": "condução",
    "Condução e Drible": "condução",
    "Passes Finais": "passe final",
    Ofensividade: "ofensividade",
    Finalização: "finalização",
  };
  return map[title] ?? title.toLowerCase();
}

/** Short scouting note for a head-to-head, using the same section scores as the position page. */
export function compareNarrative(
  playerA: PlayerProfile,
  playerB: PlayerProfile,
  family: PositionFamily,
): string {
  const nameA = givenName(playerA.name);
  const nameB = givenName(playerB.name);

  const edges: { title: string; gap: number; leader: "a" | "b" }[] = [];
  for (const section of statSectionsForFamily(family)) {
    const scoreA = playerSectionScore(playerA, family, section.title);
    const scoreB = playerSectionScore(playerB, family, section.title);
    if (scoreA == null || scoreB == null) continue;
    const gap = scoreA - scoreB;
    if (Math.abs(gap) < 6) continue;
    edges.push({ title: sectionPhrase(section.title), gap, leader: gap > 0 ? "a" : "b" });
  }
  edges.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  const profileLine =
    playerA.profile === playerB.profile
      ? `Os dois têm perfil de ${playerA.profile}.`
      : `${nameA} tem perfil de ${playerA.profile}; ${nameB}, de ${playerB.profile}.`;

  function clause(leader: "a" | "b"): string | null {
    const mine = edges.filter((edge) => edge.leader === leader).slice(0, 3);
    if (!mine.length) return null;
    const who = leader === "a" ? nameA : nameB;
    const clear = mine.filter((edge) => Math.abs(edge.gap) >= 16).map((edge) => edge.title);
    const ahead = mine.filter((edge) => Math.abs(edge.gap) < 16).map((edge) => edge.title);
    const parts: string[] = [];
    if (ahead.length) parts.push(`${who} é melhor em ${joinPt(ahead)}`);
    if (clear.length) {
      parts.push(
        ahead.length
          ? `e claramente superior em ${joinPt(clear)}`
          : `${who} é claramente superior em ${joinPt(clear)}`,
      );
    }
    return `${parts.join(" ")}.`;
  }

  const lineA = clause("a");
  const lineB = clause("b");
  const body = [lineA, lineB].filter(Boolean).join(" ");
  if (!body) {
    return `${profileLine} Nos blocos da posição, os dois estão próximos. A diferença aparece mais no detalhe de cada métrica.`;
  }
  return `${profileLine} ${body}`;
}
