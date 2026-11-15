import type { ReportLang } from "@/lib/reportI18n";

/** Encaixe tático do PDF: esquemas e funções indicados a partir do perfil e dos percentis do atleta. */

export type Trait = "defensivos" | "aereo" | "passes" | "dribles" | "finais" | "ofensividade" | "finalizacao";
export type XY = [number, number];
type Pair = { pt: string; en: string };
type FormationKey = "4-3-3" | "4-2-3-1" | "4-4-2" | "3-5-2" | "3-4-3" | "4-1-2-1-2" | "3-4-2-1";
type PhysKey = "speed" | "rep" | "vol";
type Weights = Partial<Record<Trait, number>>;

/** Pontos 0–100 (x: esquerda→direita, y: ataque em cima). O primeiro é o goleiro. */
const BACK4: XY[] = [[13, 73], [37, 78], [63, 78], [87, 73]];
const BACK3: XY[] = [[25, 77], [50, 80], [75, 77]];
const GK: XY = [50, 93];
export const FORMATIONS: Record<FormationKey, XY[]> = {
  "4-3-3": [GK, ...BACK4, [50, 60], [30, 47], [70, 47], [15, 22], [50, 14], [85, 22]],
  "4-2-3-1": [GK, ...BACK4, [37, 60], [63, 60], [15, 36], [50, 38], [85, 36], [50, 15]],
  "4-4-2": [GK, ...BACK4, [13, 52], [38, 55], [62, 55], [87, 52], [38, 17], [62, 17]],
  "3-5-2": [GK, ...BACK3, [10, 50], [90, 50], [50, 60], [32, 46], [68, 46], [38, 17], [62, 17]],
  "3-4-3": [GK, ...BACK3, [10, 52], [90, 52], [38, 54], [62, 54], [17, 22], [50, 14], [83, 22]],
  "4-1-2-1-2": [GK, ...BACK4, [50, 62], [28, 49], [72, 49], [50, 35], [38, 15], [62, 15]],
  "3-4-2-1": [GK, ...BACK3, [10, 53], [90, 53], [38, 56], [62, 56], [30, 33], [70, 33], [50, 14]],
};

type RoleDef = {
  key: string;
  name: Pair;
  blurb: Pair;
  profile?: string;
  traits: Weights;
};

type SchemeDef = {
  formation: FormationKey;
  role: string;
  slot: Pair;
  why: Pair;
  at: XY;
  need: Weights;
  phys?: Partial<Record<PhysKey, number>>;
};

type FamilyDef = { roles: RoleDef[]; schemes: SchemeDef[]; mirror: boolean };

const p = (pt: string, en: string): Pair => ({ pt, en });

const FAMILIES: Record<string, FamilyDef> = {
  zagueiros: {
    mirror: true,
    roles: [
      { key: "libero", profile: "Construtor", name: p("Zagueiro construtor", "Ball-playing centre-back"), blurb: p("Sai jogando, quebra linhas com o passe e conduz", "Starts moves, breaks lines with the pass and carries"), traits: { passes: 0.5, defensivos: 0.25, dribles: 0.25 } },
      { key: "stopper", profile: "Combativo", name: p("Zagueiro stopper", "Aggressive stopper"), blurb: p("Sai para o duelo, antecipa e pressiona o portador", "Steps out to duel, anticipates and presses the carrier"), traits: { defensivos: 0.7, aereo: 0.3 } },
      { key: "area", profile: "Defensor de Área", name: p("Zagueiro de área", "Box-defending centre-back"), blurb: p("Protege a grande área e domina o jogo aéreo", "Protects the penalty area and dominates in the air"), traits: { aereo: 0.5, defensivos: 0.5 } },
    ],
    schemes: [
      { formation: "4-3-3", role: "libero", at: [63, 78], slot: p("Zagueiro de saída curta", "Ball-playing centre-back"), why: p("Linha alta e saída curta: pede passe vertical e cobertura", "High line and short build-up: needs vertical passing and cover"), need: { passes: 0.5, defensivos: 0.3, dribles: 0.2 } },
      { formation: "3-5-2", role: "libero", at: [50, 80], slot: p("Líbero da linha de 3", "Sweeper of the back three"), why: p("Central dos três: organiza a saída e cobre os companheiros", "Middle of three: organises build-up and covers team-mates"), need: { passes: 0.45, defensivos: 0.35, dribles: 0.2 } },
      { formation: "4-2-3-1", role: "area", at: [63, 78], slot: p("Zagueiro atrás do duplo pivô", "Centre-back behind the double pivot"), why: p("Bloco médio compacto: protege a área e vence no alto", "Compact mid-block: protects the box and wins in the air"), need: { defensivos: 0.5, aereo: 0.5 } },
      { formation: "4-4-2", role: "stopper", at: [63, 78], slot: p("Dupla de zaga compacta", "Compact centre-back pair"), why: p("Duas linhas de quatro: antecipa e duela perto da área", "Two banks of four: anticipates and duels near the box"), need: { defensivos: 0.6, aereo: 0.4 } },
      { formation: "3-4-3", role: "stopper", at: [75, 77], slot: p("Zagueiro de lado da linha de 3", "Wide centre-back of the back three"), why: p("Sai para duelar e acompanha o ala adversário", "Steps out to duel and tracks the opposing wide man"), need: { defensivos: 0.5, aereo: 0.15, dribles: 0.15 }, phys: { speed: 0.2, rep: 0.2 } },
      { formation: "4-1-2-1-2", role: "area", at: [63, 78], slot: p("Zagueiro com pivô à frente", "Centre-back with a screen ahead"), why: p("Losango sem amplitude: a zaga precisa vencer 1v1 e jogo aéreo", "Narrow diamond: the back line must win duels and aerials"), need: { defensivos: 0.5, aereo: 0.5 } },
    ],
  },
  laterais: {
    mirror: true,
    roles: [
      { key: "ala", profile: "Ofensivo", name: p("Ala / lateral ofensivo", "Wing-back / attacking full-back"), blurb: p("Corre o corredor inteiro: defende, apoia e cruza", "Runs the whole flank: defends, supports and crosses"), traits: { ofensividade: 0.25, finais: 0.3, dribles: 0.2, defensivos: 0.25 } },
      { key: "invertido", profile: "Construtor", name: p("Lateral construtor (invertido)", "Inverted full-back"), blurb: p("Entra por dentro na saída e ajuda a circular a bola", "Steps inside in build-up and helps circulate the ball"), traits: { passes: 0.55, dribles: 0.2, defensivos: 0.25 } },
      { key: "lat_def", profile: "Defensivo", name: p("Lateral de marcação", "Defensive full-back"), blurb: p("Cobre o corredor, marca por fora e arrisca pouco", "Covers the flank, marks wide and takes few risks"), traits: { defensivos: 0.65, passes: 0.2, ofensividade: 0.15 } },
    ],
    schemes: [
      { formation: "3-5-2", role: "ala", at: [90, 50], slot: p("Ala (corredor inteiro)", "Wing-back (whole flank)"), why: p("Defende como lateral e ataca como ponta: exige motor e cruzamento", "Defends like a full-back, attacks like a winger: needs engine and crossing"), need: { ofensividade: 0.25, finais: 0.3, dribles: 0.15, defensivos: 0.3 }, phys: { rep: 0.3, vol: 0.3, speed: 0.2 } },
      { formation: "3-4-3", role: "ala", at: [90, 52], slot: p("Ala de amplitude", "Wide wing-back"), why: p("Dá a largura toda ao time, com três à frente", "Gives the team all its width, with three up front"), need: { finais: 0.35, dribles: 0.25, ofensividade: 0.25, defensivos: 0.15 }, phys: { speed: 0.3, rep: 0.3 } },
      { formation: "4-3-3", role: "ala", at: [87, 73], slot: p("Lateral de apoio ao ponta", "Overlapping full-back"), why: p("Sobe em ultrapassagem com o trio de meio protegendo", "Overlaps while the midfield three cover behind"), need: { ofensividade: 0.3, finais: 0.3, dribles: 0.2, defensivos: 0.2 } },
      { formation: "4-2-3-1", role: "invertido", at: [87, 73], slot: p("Lateral construtor (entra por dentro)", "Inverted full-back (steps inside)"), why: p("Com o duplo pivô, vira meia na saída e libera o ponta", "With the double pivot, becomes a midfielder in build-up and frees the winger"), need: { passes: 0.5, dribles: 0.2, defensivos: 0.3 } },
      { formation: "4-4-2", role: "lat_def", at: [87, 73], slot: p("Lateral de marcação", "Defensive full-back"), why: p("Linha de quatro: cobre o corredor e fecha o meia aberto", "Back four: covers the flank and shuts down the wide midfielder"), need: { defensivos: 0.6, passes: 0.2, ofensividade: 0.2 } },
      { formation: "4-1-2-1-2", role: "ala", at: [87, 73], slot: p("Único corredor do time", "The team's only width"), why: p("Sem pontas, o lateral é a amplitude: pede motor e cruzamento", "With no wingers, the full-back is the width: needs engine and crossing"), need: { finais: 0.3, ofensividade: 0.25, defensivos: 0.25, dribles: 0.2 }, phys: { vol: 0.4, rep: 0.3 } },
    ],
  },
  "meio-campistas": {
    mirror: false,
    roles: [
      { key: "six", profile: "Contenção", name: p("Volante (camisa 6)", "Holding midfielder (6)"), blurb: p("Protege a zaga, recupera bola e faz o primeiro passe", "Shields the back line, wins the ball and plays the first pass"), traits: { defensivos: 0.6, passes: 0.4 } },
      { key: "regista", profile: "Construtor", name: p("Regista / meia construtor", "Deep-lying playmaker"), blurb: p("Recebe da defesa, dita o ritmo e lança", "Receives from defence, sets the tempo and switches play"), traits: { passes: 0.6, finais: 0.2, defensivos: 0.2 } },
      { key: "b2b", profile: "Box-to-box", name: p("Box-to-box (camisa 8)", "Box-to-box midfielder (8)"), blurb: p("Cobre o campo nas duas fases e chega na área", "Covers ground in both phases and arrives in the box"), traits: { defensivos: 0.25, passes: 0.2, dribles: 0.25, ofensividade: 0.3 } },
    ],
    schemes: [
      { formation: "4-3-3", role: "six", at: [50, 60], slot: p("Pivô único (6)", "Single pivot (6)"), why: p("Protege a zaga sozinho: recupera, cobre e dá o primeiro passe", "Shields the back line alone: recovers, covers and plays the first pass"), need: { defensivos: 0.6, passes: 0.4 } },
      { formation: "4-2-3-1", role: "six", at: [63, 60], slot: p("Volante do duplo pivô", "Double-pivot midfielder"), why: p("Dupla à frente da zaga: um segura, o outro distribui", "Pair in front of the defence: one holds, the other distributes"), need: { defensivos: 0.55, passes: 0.45 } },
      { formation: "3-5-2", role: "regista", at: [50, 60], slot: p("Regista do trio de meio", "Regista of the midfield three"), why: p("Dita o ritmo com três zagueiros atrás e alas abertos", "Sets the tempo with three centre-backs behind and wing-backs wide"), need: { passes: 0.55, finais: 0.2, defensivos: 0.25 } },
      { formation: "4-3-3", role: "b2b", at: [70, 47], slot: p("Interior (8) de chegada", "Arriving interior (8)"), why: p("Pisa na área e fecha o meio nas duas fases", "Gets into the box and shuts the middle in both phases"), need: { dribles: 0.25, ofensividade: 0.3, defensivos: 0.25, finais: 0.2 }, phys: { vol: 0.4, rep: 0.2 } },
      { formation: "4-1-2-1-2", role: "b2b", at: [72, 49], slot: p("Interior do losango", "Diamond interior"), why: p("Cobre o corredor sem pontas: pede fôlego e passe", "Covers the flank with no wingers: needs stamina and passing"), need: { defensivos: 0.3, passes: 0.3, ofensividade: 0.2, dribles: 0.2 }, phys: { vol: 0.4 } },
      { formation: "4-4-2", role: "b2b", at: [62, 55], slot: p("Dupla de meio (ida e volta)", "Central pair (box-to-box)"), why: p("Dois no meio: precisa chegar e voltar", "Only two in the middle: must arrive and recover"), need: { defensivos: 0.35, passes: 0.25, ofensividade: 0.2, dribles: 0.2 }, phys: { vol: 0.4 } },
    ],
  },
  extremos: {
    mirror: true,
    roles: [
      { key: "driblador", profile: "Driblador", name: p("Ponta de 1v1", "Touchline winger"), blurb: p("Abre o campo e desequilibra no drible", "Stretches the pitch and unbalances in 1v1"), traits: { dribles: 0.55, finais: 0.25, ofensividade: 0.2 } },
      { key: "meia_ponta", profile: "Meia Ponta", name: p("Meia-ponta / camisa 10", "Inside playmaker (10)"), blurb: p("Joga entre linhas: associa, cria e finaliza", "Plays between the lines: combines, creates and finishes"), traits: { finais: 0.4, passes: 0.25, dribles: 0.2, finalizacao: 0.15 } },
      { key: "ruptura", profile: "Ruptura", name: p("Ponta de ruptura", "Inside forward / runner"), blurb: p("Ataca a profundidade e finaliza", "Attacks depth and finishes"), traits: { ofensividade: 0.3, finalizacao: 0.3, dribles: 0.25, finais: 0.15 } },
    ],
    schemes: [
      { formation: "4-3-3", role: "ruptura", at: [85, 22], slot: p("Ponta que ataca o espaço", "Winger attacking space"), why: p("Pé trocado, corta para dentro e finaliza com o lateral por fora", "Cuts inside onto his strong foot and finishes, full-back overlapping"), need: { ofensividade: 0.3, finalizacao: 0.3, dribles: 0.25, finais: 0.15 }, phys: { speed: 0.3, rep: 0.3 } },
      { formation: "4-2-3-1", role: "meia_ponta", at: [50, 38], slot: p("Camisa 10 / meia por dentro", "Number 10 / inside midfielder"), why: p("Entre linhas, atrás do 9: cria, associa e finaliza", "Between the lines behind the 9: creates, combines and finishes"), need: { finais: 0.4, passes: 0.25, dribles: 0.2, finalizacao: 0.15 } },
      { formation: "3-4-3", role: "driblador", at: [83, 22], slot: p("Ponta aberto (1v1)", "Wide winger (1v1)"), why: p("Com alas atrás, joga na linha e decide no drible", "With wing-backs behind, hugs the line and decides in 1v1"), need: { dribles: 0.5, finais: 0.3, ofensividade: 0.2 }, phys: { speed: 0.3 } },
      { formation: "3-4-2-1", role: "meia_ponta", at: [70, 33], slot: p("Meia-atacante entre linhas", "Attacking midfielder between the lines"), why: p("Um dos dois meias atrás do centroavante: cria e finaliza", "One of two behind the striker: creates and finishes"), need: { finais: 0.35, passes: 0.25, finalizacao: 0.2, dribles: 0.2 } },
      { formation: "4-4-2", role: "driblador", at: [87, 52], slot: p("Meia aberto", "Wide midfielder"), why: p("Abre o campo, dribla e cruza; volta para compor a linha", "Stretches play, dribbles and crosses; tracks back into the line"), need: { dribles: 0.4, finais: 0.3, defensivos: 0.15, ofensividade: 0.15 }, phys: { rep: 0.2, vol: 0.3 } },
      { formation: "3-5-2", role: "ruptura", at: [62, 17], slot: p("Segundo atacante em transição", "Second striker in transition"), why: p("Dupla à frente: acelera atrás da linha defensiva", "Front pair: accelerates in behind the defensive line"), need: { ofensividade: 0.35, finalizacao: 0.3, dribles: 0.2, finais: 0.15 }, phys: { speed: 0.35 } },
    ],
  },
  atacantes: {
    mirror: false,
    roles: [
      { key: "poacher", profile: "Finalizador", name: p("Centroavante de área", "Penalty-box finisher"), blurb: p("Vive de finalização e posicionamento na área", "Lives on finishing and positioning in the box"), traits: { finalizacao: 0.7, aereo: 0.15, dribles: 0.15 } },
      { key: "target", profile: "Alvo", name: p("Referência / pivô", "Target man"), blurb: p("Segura a bola, ganha no alto e sobe o time", "Holds the ball up, wins in the air and brings the team up"), traits: { aereo: 0.45, finalizacao: 0.4, finais: 0.15 } },
      { key: "falso9", profile: "Móvel", name: p("Falso 9 / segundo atacante", "False nine / second striker"), blurb: p("Recua para associar e abre espaço para os companheiros", "Drops to link up and opens space for team-mates"), traits: { finais: 0.4, dribles: 0.35, finalizacao: 0.25 } },
    ],
    schemes: [
      { formation: "4-3-3", role: "poacher", at: [50, 14], slot: p("Centroavante com pontas por dentro", "Centre-forward with inside wingers"), why: p("Fixa a área e finaliza o que os pontas criam", "Pins the box and finishes what the wingers create"), need: { finalizacao: 0.6, aereo: 0.15, finais: 0.1, dribles: 0.15 } },
      { formation: "4-2-3-1", role: "target", at: [50, 15], slot: p("Camisa 9 de referência", "Reference number 9"), why: p("Sozinho na frente: segura a bola e ganha no alto", "Alone up front: holds the ball up and wins in the air"), need: { aereo: 0.4, finalizacao: 0.35, finais: 0.15, dribles: 0.1 } },
      { formation: "4-4-2", role: "poacher", at: [62, 17], slot: p("Atacante de área da dupla", "Box striker of the pair"), why: p("Dupla com um móvel: vive da finalização", "Paired with a mobile partner: lives on finishing"), need: { finalizacao: 0.6, aereo: 0.2, finais: 0.1, dribles: 0.1 } },
      { formation: "4-1-2-1-2", role: "falso9", at: [38, 15], slot: p("Atacante móvel do losango", "Mobile striker in the diamond"), why: p("Com o 10 atrás, recua, associa e ataca o espaço", "With a 10 behind, drops, links up and attacks space"), need: { finais: 0.35, dribles: 0.35, finalizacao: 0.3 } },
      { formation: "3-5-2", role: "falso9", at: [38, 17], slot: p("Segundo atacante da dupla", "Second striker of the pair"), why: p("Joga ao lado do 9: associa e ataca a segunda bola", "Plays next to the 9: links up and attacks the second ball"), need: { finais: 0.35, dribles: 0.3, finalizacao: 0.35 } },
      { formation: "3-4-2-1", role: "target", at: [50, 14], slot: p("Referência com dois meias", "Reference with two playmakers"), why: p("Pivô para os meias atacarem o espaço", "A pivot for the playmakers to run off"), need: { aereo: 0.35, finalizacao: 0.35, finais: 0.2, dribles: 0.1 } },
    ],
  },
};

export type FitInput = {
  lang: ReportLang;
  family: string;
  /** Rótulos de perfil como o site classifica (PT), com afinidade média 0–100. */
  profiles: { label: string; share: number }[];
  /** Blocos da temporada: tom (traço), título já localizado e percentil médio. */
  blocks: { tone: string; title: string; avg: number }[];
  physical: { key: string; pct: number | null }[] | null;
  side: "left" | "right" | null;
};

export type FitEvidence = { label: string; pct: number };

export type FitScheme = {
  formation: string;
  slot: string;
  why: string;
  score: number;
  level: string;
  dots: XY[];
  at: XY;
  evidence: FitEvidence[];
};

export type FitRole = {
  name: string;
  blurb: string;
  score: number;
  level: string;
  main: boolean;
  evidence: FitEvidence[];
};

export type TacticalFit = { schemes: FitScheme[]; roles: FitRole[]; verdict: string };

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

function traitScore(weights: Weights, byTrait: Map<string, number>): number | null {
  let sum = 0;
  let total = 0;
  for (const [trait, weight] of Object.entries(weights) as [Trait, number][]) {
    const pct = byTrait.get(trait);
    if (pct == null) continue;
    sum += pct * weight;
    total += weight;
  }
  return total ? sum / total : null;
}

function physLevels(physical: FitInput["physical"]): Partial<Record<PhysKey, number>> {
  if (!physical?.length) return {};
  const get = (key: string) => physical.find((m) => m.key === key)?.pct ?? null;
  const avg = (keys: string[]) => {
    const values = keys.map(get).filter((v): v is number => v != null);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const levels: Partial<Record<PhysKey, number>> = {};
  const speed = get("top_speed");
  const rep = avg(["sprints_p90", "sprinting_km_p90"]);
  const vol = avg(["kilometers_p90", "running_km_p90"]);
  if (speed != null) levels.speed = speed;
  if (rep != null) levels.rep = rep;
  if (vol != null) levels.vol = vol;
  return levels;
}

function level(score: number, lang: ReportLang): string {
  const en = lang === "en";
  if (score >= 75) return en ? "Ideal" : "Ideal";
  if (score >= 62) return en ? "Strong" : "Muito bom";
  return en ? "Good" : "Bom";
}

function snap(dots: XY[], at: XY): XY {
  let best = dots[1] ?? at;
  let dist = Infinity;
  for (const dot of dots.slice(1)) {
    const d = (dot[0] - at[0]) ** 2 + (dot[1] - at[1]) ** 2;
    if (d < dist) {
      dist = d;
      best = dot;
    }
  }
  return best;
}

export function buildTacticalFit(input: FitInput): TacticalFit | null {
  const def = FAMILIES[input.family];
  if (!def || !input.blocks.length) return null;
  const en = input.lang === "en";
  const lc = (pair: Pair) => (en ? pair.en : pair.pt);

  const byTrait = new Map<string, number>();
  const titles = new Map<string, string>();
  for (const block of input.blocks) {
    byTrait.set(block.tone, block.avg);
    titles.set(block.tone, block.title);
  }
  const phys = physLevels(input.physical);

  const evidenceFor = (weights: Weights): FitEvidence[] =>
    (Object.entries(weights) as [Trait, number][])
      .map(([trait, weight]) => ({ trait, weight, pct: byTrait.get(trait) }))
      .filter((row): row is { trait: Trait; weight: number; pct: number } => row.pct != null)
      .sort((a, b) => b.pct * b.weight - a.pct * a.weight)
      .slice(0, 2)
      .map((row) => ({ label: titles.get(row.trait) ?? row.trait, pct: Math.round(row.pct) }));

  const roleScores = new Map<string, number>();
  const roles = def.roles
    .map((role) => {
      const share = role.profile ? input.profiles.find((item) => item.label === role.profile)?.share ?? 0 : null;
      const profileScore = share != null && input.profiles.length ? clamp(share * 1.3) : null;
      const traits = traitScore(role.traits, byTrait);
      const parts = [profileScore, traits].filter((v): v is number => v != null);
      const score = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
      roleScores.set(role.key, score);
      return { role, score };
    })
    .sort((a, b) => b.score - a.score);

  const side = input.side;
  const mirrorX = (xy: XY): XY => (def.mirror && side === "left" ? [100 - xy[0], xy[1]] : xy);

  const schemes = def.schemes
    .map((scheme) => {
      const roleScore = roleScores.get(scheme.role) ?? 0;
      const need = traitScore(scheme.need, byTrait);
      let score = need == null ? roleScore : roleScore * 0.5 + need * 0.5;
      if (scheme.phys) {
        const bonus = (Object.entries(scheme.phys) as [PhysKey, number][]).reduce(
          (sum, [key, weight]) => (phys[key] != null ? sum + weight * ((phys[key] as number) - 50) * 0.3 : sum),
          0,
        );
        score += bonus;
      }
      return { scheme, score: clamp(score) };
    })
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const top = schemes.filter(({ scheme }) => (seen.has(scheme.formation) ? false : (seen.add(scheme.formation), true))).slice(0, 3);

  const fitSchemes: FitScheme[] = top.map(({ scheme, score }) => {
    const dots = FORMATIONS[scheme.formation].map(mirrorX);
    return {
      formation: scheme.formation,
      slot: lc(scheme.slot),
      why: lc(scheme.why),
      score: Math.round(score),
      level: level(score, input.lang),
      dots,
      at: snap(dots, mirrorX(scheme.at)),
      evidence: evidenceFor(scheme.need),
    };
  });

  const fitRoles: FitRole[] = roles.slice(0, 3).map(({ role, score }, index) => ({
    name: lc(role.name),
    blurb: lc(role.blurb),
    score: Math.round(score),
    level: index === 0 ? (en ? "Main" : "Principal") : en ? "Alternative" : "Alternativa",
    main: index === 0,
    evidence: evidenceFor(role.traits),
  }));

  const bestRole = roles[0].role;
  const formations = fitSchemes.slice(0, 2).map((s) => `**${s.formation}**`);
  const roleName = `**${lc(bestRole.name).toLowerCase()}**`;
  const verdict = en
    ? `By profile and data, the strongest read is a ${roleName} — best placed in ${formations.join(" or ")}.`
    : `Pelo perfil e pelos dados, a leitura mais forte é de ${roleName} — rende melhor em ${formations.join(" ou ")}.`;

  return { schemes: fitSchemes, roles: fitRoles, verdict };
}
