import { reportLocale, type ReportLang } from "@/lib/reportI18n";
import { buildTacticalFit, type TacticalFit } from "@/lib/tacticalFit";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import type { PositionFamily } from "@/lib/types";

/** Leituras automáticas das páginas finais do PDF ("Resumo do analista" e "Encaixe tático"). */

export type InsightDir = "up" | "down" | "even";

export type InsightInput = {
  lang: ReportLang;
  /** Para variar a redação de forma estável entre atletas. */
  name: string;
  family: string;
  position: string;
  profile: { label: string; raw: string; share: number; second: { label: string; share: number } | null } | null;
  /** Perfis com rótulo do site (PT) e afinidade média, do maior para o menor. */
  profiles: { label: string; share: number }[];
  side: "left" | "right" | null;
  /** Temporadas em ordem cronológica. */
  seasons: { year: string; club: string; minutes: number; minutesPct: number | null }[];
  /** Blocos (média dos percentis): uma célula por temporada + média ponderada. */
  blocks: { title: string; tone: string; cells: (number | null)[]; avg: number }[];
  /** Métricas com percentil médio entre as temporadas. */
  metrics: { name: string; context: string; percentile: number; aspect?: string }[];
  errorsLabel: string;
  xprog: {
    actual: number;
    expected: number;
    delta: number;
    dir: InsightDir;
    accActual: number | null;
    accExpected: number | null;
    accDelta: number | null;
    accDir: InsightDir | null;
  } | null;
  production: { goals: number; assists: number; xg: number | null; xa: number | null; minutes: number };
  physical: { key: string; label: string; value: string; pct: number | null }[] | null;
  person: {
    age: number | null;
    heightCm: number | null;
    foot: string | null;
    contractDate: string | null;
    contractMonths: number | null;
    marketValue: string | null;
  };
};

export type InsightBar = {
  label: string;
  /** 0–100 */
  fill: number;
  display: string;
  tone: "high" | "low" | "mid" | "muted";
  median?: boolean;
};

export type InsightVisual =
  | { kind: "bars"; rows: InsightBar[] }
  | { kind: "spark"; cols: { label: string; value: number; tone: "high" | "low" | "mid" }[] };

export type Insight = {
  icon: string;
  tone: "good" | "bad" | "info" | "warn";
  title: string;
  big: string;
  note?: string;
  visual: InsightVisual;
};

export type InsightReport = {
  /** Síntese em tom de scout: manchete + parágrafos, com **destaques** inline. */
  story: { headline: string; body: string[] };
  insights: Insight[];
  fit: TacticalFit | null;
};

type Pair = { pt: string; en: string };

/** Como cada bloco se descreve quando está acima / abaixo da mediana da posição. */
const BLOCK_VOICE: Record<string, { up: Pair; down: Pair; role: Pair }> = {
  defensivos: {
    up: { pt: "mais defensivo", en: "more defensive" },
    down: { pt: "menos defensivo", en: "less defensive" },
    role: { pt: "solidez defensiva no setor", en: "defensive solidity in his zone" },
  },
  passes: {
    up: { pt: "mais envolvido na construção", en: "more involved in build-up" },
    down: { pt: "menos envolvido na construção", en: "less involved in build-up" },
    role: { pt: "construção desde trás", en: "build-up from the back" },
  },
  dribles: {
    up: { pt: "mais agudo com a bola", en: "sharper on the ball" },
    down: { pt: "menos agudo com a bola", en: "less sharp on the ball" },
    role: { pt: "progressão com bola e 1v1", en: "ball carrying and 1v1 play" },
  },
  finais: {
    up: { pt: "mais criativo", en: "more creative" },
    down: { pt: "menos criativo", en: "less creative" },
    role: { pt: "criação de chances", en: "chance creation" },
  },
  ofensividade: {
    up: { pt: "mais ofensivo", en: "more attacking" },
    down: { pt: "menos ofensivo", en: "less attacking" },
    role: { pt: "presença na área adversária", en: "presence in the opposition box" },
  },
  finalizacao: {
    up: { pt: "mais finalizador", en: "more clinical" },
    down: { pt: "menos finalizador", en: "less clinical" },
    role: { pt: "finalização", en: "finishing" },
  },
  aereo: {
    up: { pt: "mais dominante no jogo aéreo", en: "more dominant in the air" },
    down: { pt: "menos presente no jogo aéreo", en: "less present in the air" },
    role: { pt: "jogo aéreo", en: "aerial play" },
  },
};

const PROFILE_PHRASE: Record<string, Pair> = {
  Defensivo: { pt: "perfil de proteção: sustenta o setor e participa pouco da construção e da criação", en: "protective profile: holds his zone and takes little part in build-up and creation" },
  Construtor: { pt: "perfil de construção: dá saída e circula a bola com volume", en: "build-up profile: starts moves and circulates the ball with volume" },
  Vertical: { pt: "perfil vertical: acelera o jogo e busca o passe que quebra linhas", en: "vertical profile: speeds play up and looks for line-breaking passes" },
  Ofensivo: { pt: "perfil de ataque: apoia, pisa na área e participa da criação", en: "attacking profile: supports, gets into the box and helps create" },
  Contenção: { pt: "perfil de contenção: protege a defesa e recupera bola sem muita ambição com a posse", en: "screening profile: protects the back line and recovers without much ambition on the ball" },
  "Box-to-box": { pt: "perfil de ida e volta: cobre muito campo nas duas fases", en: "box-to-box profile: covers a lot of pitch in both phases" },
  Driblador: { pt: "perfil de condução: desequilibra no 1v1 e carrega a bola", en: "carrying profile: unbalances in 1v1 and drives with the ball" },
  "Meia Ponta": { pt: "perfil de criação entre linhas: associa e cria de dentro", en: "between-the-lines creator: combines and creates from inside" },
  Ruptura: { pt: "perfil de ruptura: ataca o espaço e a profundidade", en: "runner profile: attacks space and depth" },
  Finalizador: { pt: "perfil de área: vive da finalização", en: "box profile: lives off finishing" },
  Alvo: { pt: "perfil de referência: pivô e jogo aéreo na frente", en: "target profile: hold-up and aerial presence up front" },
  Móvel: { pt: "perfil móvel: sai da referência e associa", en: "mobile profile: drops off the reference point and combines" },
  "Defensor de Área": { pt: "perfil de área: protege a grande área e domina o jogo aéreo", en: "box-defender profile: protects the penalty area and dominates in the air" },
  Combativo: { pt: "perfil combativo: sai para o duelo e antecipa", en: "aggressive profile: steps out to duel and anticipates" },
  Híbrido: { pt: "perfil híbrido: equilibra as duas fases sem um traço que domine", en: "hybrid profile: balances both phases without one dominant trait" },
};

/** Aspecto (rótulo PT, sem acento) → o que o atleta faz em campo, acima / abaixo da posição. */
const ACTIONS: { match: string; up: Pair; down: Pair | null }[] = [
  { match: "duelos defensivos", up: { pt: "ganha a maioria dos duelos que disputa", en: "wins most of the duels he contests" }, down: { pt: "perde duelos demais para a posição", en: "loses too many duels for the position" } },
  { match: "duelos vencidos", up: { pt: "ganha muitos duelos", en: "wins a lot of duels" }, down: { pt: "perde muitos duelos", en: "loses a lot of duels" } },
  { match: "acoes defensivas", up: { pt: "intercepta e recupera muita bola", en: "intercepts and wins back a lot of balls" }, down: { pt: "participa pouco da recuperação", en: "takes little part in winning the ball back" } },
  { match: "recuperac", up: { pt: "recupera muitas bolas", en: "wins back a lot of balls" }, down: { pt: "recupera poucas bolas", en: "wins back few balls" } },
  { match: "eficiencia defensiva", up: { pt: "dificilmente é batido", en: "is rarely beaten" }, down: { pt: "é batido com frequência", en: "gets beaten too often" } },
  { match: "aereo", up: { pt: "é forte no jogo aéreo", en: "is strong in the air" }, down: { pt: "sofre no jogo aéreo", en: "struggles in the air" } },
  { match: "passes progressivos", up: { pt: "quebra linhas com o passe", en: "breaks lines with his passing" }, down: { pt: "pouco arrisca o passe vertical", en: "rarely risks the vertical pass" } },
  { match: "passes para terco final", up: { pt: "coloca a bola no terço final com frequência", en: "regularly gets the ball into the final third" }, down: { pt: "raramente leva a bola ao terço final", en: "rarely moves the ball into the final third" } },
  { match: "passes longos", up: { pt: "tem um bom lançamento", en: "has a good long pass" }, down: { pt: "não é jogador de lançamento", en: "is not a long-passing player" } },
  { match: "distribuicao", up: { pt: "circula a bola com segurança", en: "circulates the ball securely" }, down: { pt: "erra mais passes do que a posição tolera", en: "misplaces more passes than the position allows" } },
  { match: "disputas com bola", up: { pt: "protege bem a bola sob pressão", en: "shields the ball well under pressure" }, down: { pt: "perde a bola com facilidade sob pressão", en: "loses the ball easily under pressure" } },
  { match: "1v1", up: { pt: "parte para cima no um contra um", en: "takes defenders on one-on-one" }, down: { pt: "pouco busca o drible", en: "rarely looks to dribble" } },
  { match: "progress", up: { pt: "carrega a bola para a frente", en: "drives forward with the ball" }, down: { pt: "conduz pouco", en: "rarely carries the ball" } },
  { match: "cruzamentos", up: { pt: "cruza com volume e qualidade", en: "crosses with volume and quality" }, down: { pt: "cruza pouco", en: "crosses little" } },
  { match: "passes chave", up: { pt: "acha o passe que deixa o companheiro na cara do gol", en: "finds the pass that puts a team-mate through" }, down: { pt: "cria pouco no último terço", en: "creates little in the final third" } },
  { match: "pre assist", up: { pt: "aparece muito no penúltimo passe", en: "features a lot in the pass before the assist" }, down: null },
  { match: "passes criativos", up: { pt: "arrisca o passe criativo", en: "risks the creative pass" }, down: { pt: "arrisca pouco o passe criativo", en: "rarely risks the creative pass" } },
  { match: "gols e xg", up: { pt: "chega em boas condições de finalizar e converte", en: "gets into good shooting positions and converts" }, down: { pt: "chega pouco em condição de gol", en: "rarely gets into scoring positions" } },
  { match: "finalizacoes", up: { pt: "finaliza com volume", en: "shoots often" }, down: { pt: "finaliza pouco", en: "shoots little" } },
  { match: "efetividade", up: { pt: "converte acima da média", en: "converts above average" }, down: { pt: "desperdiça mais do que deveria", en: "wastes more chances than he should" } },
  { match: "ofensividade", up: { pt: "pisa muito na área adversária", en: "gets into the opposition box a lot" }, down: { pt: "aparece pouco na área adversária", en: "rarely appears in the opposition box" } },
  { match: "acoes terminais", up: { pt: "participa muito das jogadas finais", en: "is heavily involved in the final actions" }, down: { pt: "participa pouco das jogadas finais", en: "is rarely involved in the final actions" } },
  { match: "verticalidade", up: { pt: "joga sempre de frente para o gol", en: "always plays towards goal" }, down: { pt: "joga mais para os lados do que para a frente", en: "plays more sideways than forwards" } },
];

/** pct = média do aspecto; label/top = a linha mais forte dele (cita a métrica concreta). */
type AspectRead = { label: string; pct: number; top: number; action: (typeof ACTIONS)[number] };

const plain = (s: string) =>
  s
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Média dos percentis por aspecto, com a ação correspondente; do mais forte ao mais fraco. */
function aspectReads(metrics: InsightInput["metrics"]): AspectRead[] {
  const groups = new Map<string, { label: string; top: number; values: number[]; action: (typeof ACTIONS)[number] }>();
  for (const m of metrics) {
    const key = plain(m.aspect ?? m.name);
    if (key.includes("erro") || plain(m.name).includes("erro")) continue;
    const action = ACTIONS.find((a) => key.includes(a.match));
    if (!action) continue;
    // Uma leitura por ação: evita "forte no alto" e "sofre no alto" vindos de aspectos irmãos.
    const group = groups.get(action.match) ?? { label: "", top: -1, values: [], action };
    if (m.percentile > group.top) {
      group.top = m.percentile;
      group.label = m.name.replace(/\s*\/\s*90|\s*%$/g, "").trim().toLocaleLowerCase("pt-BR");
    }
    group.values.push(m.percentile);
    groups.set(action.match, group);
  }
  return [...groups.values()]
    .map((g) => ({ label: g.label, top: g.top, pct: g.values.reduce((a, b) => a + b, 0) / g.values.length, action: g.action }))
    .sort((a, b) => b.pct - a.pct);
}

function voiceKey(title: string): keyof typeof BLOCK_VOICE | null {
  const t = title.toLocaleLowerCase();
  if (/(defens|defend)/.test(t)) return "defensivos";
  if (/(a[ée]re|aerial)/.test(t)) return "aereo";
  if (/(dribl|condu|carry)/.test(t)) return "dribles";
  if (/(finais|final pass)/.test(t)) return "finais";
  if (/(ofensiv|attacking)/.test(t)) return "ofensividade";
  if (/(finaliz|finishing)/.test(t)) return "finalizacao";
  if (/(passes|passing)/.test(t)) return "passes";
  return null;
}

function voice(title: string, kind: "up" | "down" | "role", lang: ReportLang): string {
  const key = voiceKey(title);
  if (!key) return kind === "role" ? title.toLocaleLowerCase() : title;
  return BLOCK_VOICE[key][kind][lang];
}

function num(value: number, digits: number, lang: ReportLang): string {
  return value.toLocaleString(reportLocale(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function signed(value: number, digits: number, lang: ReportLang): string {
  return `${value >= 0 ? "+" : "−"}${num(Math.abs(value), digits, lang)}`;
}

function list(items: string[], lang: ReportLang): string {
  if (items.length <= 1) return items[0] ?? "";
  const and = lang === "en" ? " and " : " e ";
  return `${items.slice(0, -1).join(", ")}${and}${items[items.length - 1]}`;
}

function toneOfPct(pct: number): "high" | "low" | "mid" {
  return pct >= 70 ? "high" : pct <= 30 ? "low" : "mid";
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / (values.length || 1);

type Level = "hi" | "mid" | "lo";
const level = (pct: number | null): Level | null => (pct == null ? null : pct >= 65 ? "hi" : pct <= 35 ? "lo" : "mid");

/** Leitura física: o que o conjunto de GPS diz sobre o tipo de atleta. */
export function physicalReading(
  physical: InsightInput["physical"],
  lang: ReportLang,
): { label: string; sentence: string } | null {
  if (!physical?.length) return null;
  const en = lang === "en";
  const find = (key: string) => physical.find((m) => m.key === key);
  const avg = (keys: string[]) => {
    const values = keys.map((k) => find(k)?.pct).filter((v): v is number => v != null);
    return values.length ? mean(values) : null;
  };
  const top = find("top_speed");
  const sprints = find("sprints_p90");
  const km = find("kilometers_p90");
  const speed = level(top?.pct ?? null);
  const rep = level(avg(["sprints_p90", "sprinting_km_p90"]));
  const vol = level(avg(["kilometers_p90", "running_km_p90"]));
  const inten = level(find("high_speed_km_p90")?.pct ?? null);
  if (!speed && !rep) return null;

  const t = top ? `${top.value}, p${Math.round(top.pct ?? 0)}` : "";
  const sp = sprints ? `${sprints.value.replace(" /90", "")} sprints/90, p${Math.round(sprints.pct ?? 0)}` : "";
  const kmText = km ? `${km.value}, p${Math.round(km.pct ?? 0)}` : "";
  const key = `${speed ?? "mid"}-${rep ?? "mid"}`;
  const table: Record<string, { label: [string, string]; text: [string, string] }> = {
    "hi-lo": {
      label: ["Pico alto · poucos sprints", "High peak · few sprints"],
      text: [
        `Tem velocidade de ponta alta (${t}), mas faz poucos sprints (${sp}): a arrancada existe, porém é pouco acionada em corridas explosivas repetidas. É o retrato de quem recompõe e cobre o espaço mais do que ataca a profundidade, e a velocidade funciona como recurso de proteção, não de jogo.`,
        `High top speed (${t}) but few sprints (${sp}): the burst is there, yet rarely used in repeated explosive runs. That reads as someone who recovers and covers space rather than attacking depth — speed as a protective resource, not a weapon.`,
      ],
    },
    "hi-hi": {
      label: ["Explosivo e repetidor", "Explosive, repeats sprints"],
      text: [
        `Explosivo e repetidor: pico de ${t} e ${sp}. Sustenta ações de alta intensidade com frequência, o que sustenta projeção e recomposição ao longo do jogo.`,
        `Explosive and repeatable: peak of ${t} and ${sp}. Sustains high-intensity actions often, supporting both forward runs and recovery runs.`,
      ],
    },
    "hi-mid": {
      label: ["Pico alto", "High peak"],
      text: [
        `Pico de velocidade alto (${t}), com repetição de sprints na média da posição: tem recurso de ponta, sem ser um atleta de explosões constantes.`,
        `High top speed (${t}) with sprint repetition in line with the position: a real top gear without constant explosive efforts.`,
      ],
    },
    "lo-hi": {
      label: ["Muitos sprints · pico baixo", "Many sprints · low peak"],
      text: [
        `Faz muitos sprints (${sp}) com velocidade de pico limitada (${t}): corre em arranques curtos e frequentes, sem grande velocidade final.`,
        `Many sprints (${sp}) with limited top speed (${t}): short, frequent bursts without a big final gear.`,
      ],
    },
    "lo-lo": {
      label: ["Perfil físico contido", "Contained physical profile"],
      text: [
        `Perfil físico contido: pico de ${t} e poucos sprints (${sp}). O jogo se apoia em posicionamento e leitura, não em explosão, e dificilmente aguenta funções de muita corrida em espaço aberto.`,
        `Contained physical profile: peak of ${t} and few sprints (${sp}). His game rests on positioning and reading, not explosiveness; open-space roles will expose him.`,
      ],
    },
    "mid-hi": {
      label: ["Repetidor de sprints", "Repeats sprints"],
      text: [
        `Repete bem os sprints (${sp}), com velocidade de pico na média: valor está na frequência dos esforços, não na ponta.`,
        `Repeats sprints well (${sp}) with average top speed: the value is in effort frequency, not in peak pace.`,
      ],
    },
    "mid-lo": {
      label: ["Poucos sprints", "Few sprints"],
      text: [
        `Poucos sprints (${sp}) e velocidade de pico na média (${t}): jogo mais posicional que de corrida em profundidade.`,
        `Few sprints (${sp}) and average top speed (${t}): a positional game rather than one built on runs in behind.`,
      ],
    },
    "mid-mid": {
      label: ["Dentro da média", "Within average"],
      text: [
        `Sem traço físico marcante: pico de ${t} e sprints na média da posição, o que torna a leitura física neutra para a decisão.`,
        `No standout physical trait: peak of ${t} and sprints in line with the position, so the physical read is neutral for the decision.`,
      ],
    },
  };
  const row = table[key];
  let text = row.text[en ? 1 : 0];
  if (km && vol && vol !== "mid") {
    text += en
      ? vol === "hi" ? ` Covers a lot of ground (${kmText}).` : ` Covers less ground than the position (${kmText}).`
      : vol === "hi" ? ` Cobre muito terreno (${kmText}).` : ` Cobre menos terreno que a posição (${kmText}).`;
  } else if (inten === "hi") {
    text += en ? " Sustains high-speed running well." : " Sustenta bem a corrida em alta velocidade.";
  }
  return { label: row.label[en ? 1 : 0], sentence: text };
}

/** Frase curta de leitura física, para encaixar no meio da síntese. */
function physicalBrief(physical: InsightInput["physical"], lang: ReportLang): string | null {
  if (!physical?.length) return null;
  const en = lang === "en";
  const find = (key: string) => physical.find((m) => m.key === key);
  const avg = (keys: string[]) => {
    const values = keys.map((k) => find(k)?.pct).filter((v): v is number => v != null);
    return values.length ? mean(values) : null;
  };
  const top = find("top_speed");
  const speed = level(top?.pct ?? null);
  const rep = level(avg(["sprints_p90", "sprinting_km_p90"]));
  const vol = level(avg(["kilometers_p90", "running_km_p90"]));
  if (!speed && !rep && !vol) return null;
  const parts: string[] = [];
  if (speed === "hi") parts.push(en ? `has a high top speed (${top?.value})` : `tem pico de velocidade alto (${top?.value})`);
  if (speed === "lo") parts.push(en ? `has a modest top speed (${top?.value})` : `tem pico de velocidade baixo (${top?.value})`);
  if (rep === "hi") parts.push(en ? "repeats sprints often" : "repete sprints com frequência");
  if (rep === "lo") parts.push(en ? "makes few sprints" : "faz poucos sprints");
  if (vol === "hi") parts.push(en ? "covers a lot of ground" : "cobre muito campo");
  if (vol === "lo") parts.push(en ? "covers less ground than the position" : "cobre menos campo que a posição");
  if (!parts.length) return en ? "Physically, he is in line with the position." : "Fisicamente, está dentro da média da posição.";
  return en ? `Physically, he ${list(parts, lang)}.` : `Fisicamente, ${list(parts, lang)}.`;
}

export function buildInsights(raw: InsightInput): InsightReport {
  // Só aspectos da família avaliada: temporadas curtas em outra posição não contaminam a leitura.
  const familyAspects = new Set(
    statSectionsForFamily(raw.family as PositionFamily)
      .flatMap((section) => section.labels)
      .map((label) => (label === "Conduções Progressivas" ? "Progressão" : label)),
  );
  const input: InsightInput = { ...raw, metrics: raw.metrics.filter((m) => !m.aspect || familyAspects.has(m.aspect)) };
  const { lang, blocks, seasons } = input;
  const en = lang === "en";
  const n = seasons.length;
  const first = seasons[0];
  const last = seasons[n - 1];
  const multi = n > 1;
  const byAvg = [...blocks].sort((a, b) => b.avg - a.avg);
  const best = byAvg[0] ?? null;
  const weakest = [...byAvg].reverse();
  const worst = weakest[0] && weakest[0].avg < 50 ? weakest[0] : null;
  const second = byAvg[1] && byAvg[1].avg >= 55 ? byAvg[1] : null;
  const span = multi ? `${first.year.slice(2)}–${last.year.slice(2)}` : first?.year ?? "";

  const ranked = [...input.metrics].filter((m) => m.name !== input.errorsLabel).sort((a, b) => b.percentile - a.percentile);
  const allRanked = [...input.metrics].sort((a, b) => b.percentile - a.percentile);
  const tops = ranked.slice(0, 3);
  const bottoms = [...allRanked].reverse().slice(0, 3);
  const metricBars = (items: typeof tops): InsightBar[] =>
    items.map((m) => ({ label: m.name, fill: m.percentile, display: String(m.percentile), tone: toneOfPct(m.percentile), median: true }));

  // ── Encaixe tático (antes da síntese: a função vira o sujeito do texto) ──
  const fit = buildTacticalFit({
    lang,
    family: input.family,
    profiles: input.profiles,
    blocks: blocks.map((b) => ({ tone: b.tone, title: b.title, avg: b.avg })),
    metrics: input.metrics.map((m) => ({ aspect: m.aspect ?? m.name, label: m.name, percentile: m.percentile })),
    physical: input.physical,
    side: input.side,
    heightCm: input.person.heightCm,
  });

  // ── Síntese (tom de scout) ──────────────────────────────────────────────
  const seed = [...`${input.name}|${input.position}|${n}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const pick = <T,>(salt: number, options: T[]): T => options[(seed + salt * 7) % options.length];
  const trends = multi
    ? blocks
        .map((b) => ({ title: b.title, from: b.cells[0], to: b.cells[b.cells.length - 1], cells: b.cells }))
        .filter((t): t is typeof t & { from: number; to: number } => t.from != null && t.to != null)
        .map((t) => ({ ...t, delta: t.to - t.from }))
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    : [];
  const bigTrend = trends[0] && Math.abs(trends[0].delta) >= 15 ? trends[0] : null;
  const phys = physicalReading(input.physical, lang);
  const pr = input.person;
  const loc = en ? "en-GB" : "pt-BR";
  const cap = (text: string) => text.charAt(0).toLocaleUpperCase(loc) + text.slice(1);
  const lower = (text: string) => text.toLocaleLowerCase(loc);
  const bold = (value: string | number) => `**${value}**`;
  const L = (pair: Pair) => pair[lang];
  const and = en ? " and " : " e ";
  const an = (word: string) => (/^[aeiou]/i.test(word.replace(/\*/g, "")) ? "an" : "a");

  const secondary = input.profile?.second && input.profile.second.share >= 25 ? input.profile.second : null;
  const share = input.profile ? Math.round(input.profile.share) : 0;
  const archetype = input.profile ? lower(input.profile.label) : null;
  const [profileNoun, phrase] = input.profile ? PROFILE_PHRASE[input.profile.raw]?.[lang]?.split(": ") ?? [null, null] : [null, null];

  // O que ele FAZ em campo: aspectos agregados e traduzidos em ação.
  const aspects = aspectReads(input.metrics);
  const strengths = aspects.filter((a) => a.pct >= 70).slice(0, 3);
  const gaps = [...aspects].reverse().filter((a) => a.pct <= 35 && a.action.down).slice(0, 2);
  const up = (a: AspectRead) => L(a.action.up);
  const down = (a: AspectRead) => L(a.action.down as Pair);

  // Manchete: a função como sujeito + o que entrega + a ressalva.
  const subject = fit?.best?.role ?? input.position;
  let headline: string;
  if (strengths.length) {
    const does = strengths.slice(0, 2).map(up).join(and);
    const but = gaps[0] ? ` — ${en ? `${pick(2, ["but", "though"])} he` : pick(2, ["mas", "só que"])} ${down(gaps[0])}` : "";
    headline = `${cap(lower(subject))} ${en ? "who" : "que"} ${does}${but}.`;
  } else {
    const top = byAvg[0];
    const lead = `${cap(lower(subject))}${archetype ? (en ? ` with a ${archetype} profile` : ` de perfil ${archetype}`) : ""}`;
    headline = top
      ? en
        ? `${lead}: no standout trait, his best area is ${voice(top.title, "role", lang)}.`
        : `${lead}: sem um traço dominante, o melhor que entrega é ${voice(top.title, "role", lang)}.`
      : `${lead}.`;
  }

  // 1º parágrafo: como joga, com o dado sustentando a leitura.
  const play: string[] = [];
  if (input.profile && phrase && profileNoun) {
    if (share >= 45 || !secondary) {
      play.push(
        en
          ? pick(3, [`${cap(profileNoun)}: ${phrase}.`, `First and foremost a ${profileNoun} — ${phrase}.`])
          : pick(3, [`${cap(profileNoun)}: ${phrase}.`, `É, antes de tudo, um ${profileNoun} — ${phrase}.`]),
      );
    } else {
      play.push(
        en
          ? `He doesn't fit a single label — a ${profileNoun} with traces of ${lower(secondary.label)}: ${phrase}.`
          : `Não cabe num rótulo só — ${profileNoun} com traços de ${lower(secondary.label)}: ${phrase}.`,
      );
    }
  }
  const lead = strengths.find((a) => a.top >= 80);
  if (lead) {
    const top = Math.max(5, Math.ceil((100 - lead.top) / 5) * 5);
    play.push(
      en
        ? pick(4, [
            `The data backs it up: in ${lead.label} he is in the ${bold(`top ${top}%`)} for the position.`,
            `It shows in the numbers — ${lead.label} puts him in the ${bold(`top ${top}%`)} of the position.`,
          ])
        : pick(4, [
            `O dado confirma: em ${lead.label}, está entre os ${bold(`${top}% melhores`)} da posição.`,
            `Aparece nos números — em ${lead.label}, fica entre os ${bold(`${top}% melhores`)} da posição.`,
          ]),
    );
  }
  if (strengths[2]) play.push(en ? `He also ${up(strengths[2])}.` : `Além disso, ${up(strengths[2])}.`);
  const worstBlock = byAvg.length > 1 && byAvg[byAvg.length - 1].avg < 45 ? byAvg[byAvg.length - 1] : null;
  if (gaps[1] || worstBlock) {
    const first = gaps[1] ? down(gaps[1]) : null;
    const where = worstBlock ? bold(lower(worstBlock.title)) : null;
    const label = en ? pick(5, ["The caveat", "Where he falls short"]) : pick(5, ["A ressalva", "Onde deixa a desejar"]);
    const body = en
      ? [first ? `he ${first}` : null, where ? `${where} is the weakest area of his game` : null].filter(Boolean).join(", and ")
      : [first, where ? `${where} é o setor mais frágil do jogo dele` : null].filter(Boolean).join(", e ");
    play.push(`${label}: ${body}.`);
  }
  if (input.xprog && input.xprog.dir !== "even") {
    const above = input.xprog.dir === "up";
    const delta = num(Math.abs(input.xprog.delta), 1, lang);
    play.push(
      en
        ? `He progresses the ball ${above ? "more" : "less"} than his passing volume suggests (${delta} progressive passes/90 ${above ? "above" : "below"} expected).`
        : `Progride ${above ? "mais" : "menos"} do que o volume de passes sugere (${delta} passes progressivos/90 ${above ? "acima" : "abaixo"} do esperado).`,
    );
  }

  // 2º parágrafo: físico, minutos, trajetória e situação contratual.
  const ctx: string[] = [];
  const brief = physicalBrief(input.physical, lang);
  if (brief) ctx.push(brief);
  const lastMin = last.minutesPct;
  const total = seasons.reduce((sum, season) => sum + season.minutes, 0);
  const fmtMin = (v: number) => v.toLocaleString(reportLocale(lang));
  const standing =
    lastMin == null
      ? null
      : lastMin >= 55
        ? en ? "was a regular starter" : "foi titular"
        : lastMin >= 30
          ? en ? "got a run of games" : "ganhou sequência"
          : en ? "had few minutes" : "teve poucos minutos";
  if (multi) {
    ctx.push(
      standing && lastMin != null
        ? en
          ? `In ${last.year} he ${standing} at ${last.club} (${Math.round(lastMin)}% of the minutes).`
          : `Em ${last.year}, ${standing} no ${last.club} (${Math.round(lastMin)}% dos minutos).`
        : en ? `${fmtMin(total)} minutes over ${n} seasons.` : `Soma ${fmtMin(total)} minutos em ${n} temporadas.`,
    );
    const shorts = seasons.filter((season) => season.minutesPct != null && season.minutesPct < 30 && season !== last);
    if (shorts.length) {
      const names = list(shorts.map((x) => `${x.year} (${Math.round(x.minutesPct as number)}%)`), lang);
      ctx.push(
        en
          ? `${names} ${shorts.length > 1 ? "are short samples" : "is a short sample"}, so read with caution.`
          : `${names} ${shorts.length > 1 ? "são amostras curtas" : "é amostra curta"} — vale ler com cautela.`,
      );
    }
  } else {
    const pct = lastMin != null ? ` (${Math.round(lastMin)}%${en ? " of the minutes" : " da competição"})` : "";
    ctx.push(
      en
        ? `${fmtMin(total)} minutes at ${last.club}${pct}${standing ? `; he ${standing}` : ""}.`
        : `Foram ${fmtMin(total)} minutos no ${last.club}${pct}${standing ? `; ${standing}` : ""}.`,
    );
  }
  if (bigTrend) {
    const moved = first.club !== last.club;
    const rose = bigTrend.delta > 0;
    const t = lower(bigTrend.title);
    ctx.push(
      en
        ? `His ${bold(t)} average ${rose ? "rose" : "fell"} from ${bigTrend.from} to ${bigTrend.to}${moved ? ` — in step with the move from ${first.club} to ${last.club}, which points to the role at the new club` : ""}.`
        : `No bloco ${bold(bigTrend.title)}, a média ${rose ? "subiu" : "caiu"} de ${bigTrend.from} para ${bigTrend.to}${moved ? ` — junto com a troca do ${first.club} pelo ${last.club}, o que sugere efeito da função no novo clube` : ""}.`,
    );
  } else if (multi) {
    ctx.push(en ? "His profile has held steady from season to season." : "De uma temporada para outra, o perfil se manteve.");
  }
  const pdt = input.production;
  const xgaTotal = pdt.xg != null && pdt.xa != null ? pdt.xg + pdt.xa : null;
  if (xgaTotal != null && pdt.minutes > 0) {
    const ga = pdt.goals + pdt.assists;
    if (ga - xgaTotal >= 1.5 && ga >= xgaTotal * 1.3) ctx.push(en ? "He has produced more G+A than his xG+xA suggests, which tends to regress." : "Produziu mais G+A do que o xG+xA indica, o que costuma regredir.");
    else if (ga - xgaTotal <= -1.5) ctx.push(en ? "His G+A trails his xG+xA, so there is room to grow." : "O G+A está abaixo do xG+xA: há margem para crescer.");
  }
  const expiring = pr.contractMonths != null && pr.contractMonths >= 0 && pr.contractMonths <= 8;
  const contract = pr.contractDate
    ? en
      ? `contract until ${pr.contractDate}${expiring ? " (about to expire)" : ""}`
      : `contrato até ${pr.contractDate}${expiring ? " (perto do fim)" : ""}`
    : null;
  const market = pr.marketValue && pr.marketValue !== "—" ? (en ? `market value ${pr.marketValue}` : `valor de mercado ${pr.marketValue}`) : null;
  const ageNote =
    pr.age == null
      ? ""
      : pr.age >= 31
        ? en
          ? " — fits a short-term, low-cost signing better than a long-term bet"
          : " — encaixa melhor como reforço pontual, de baixo custo, do que como aposta de longo prazo"
        : pr.age <= 22
          ? en ? " — still has room to grow" : " — ainda com margem de evolução"
          : "";
  const deal = [contract, market].filter((item): item is string => Boolean(item));
  if (deal.length) ctx.push(`${cap(list(deal, lang))}${ageNote}.`);

  // ── Leituras visuais ────────────────────────────────────────────────────
  const insights: Insight[] = [];
  if (best) {
    const above = best.cells.filter((v) => v != null && v >= 70).length;
    const counted = best.cells.filter((v) => v != null).length;
    insights.push({
      icon: "fa-arrow-trend-up",
      tone: "good",
      title: en ? `Strength · ${best.title}` : `Força · ${best.title}`,
      big: String(Math.round(best.avg)),
      note: multi ? (en ? `70+ in ${above} of ${counted} seasons` : `70+ em ${above} de ${counted} temporadas`) : undefined,
      visual: { kind: "bars", rows: metricBars(tops) },
    });
  }
  if (worst) {
    const below = worst.cells.filter((v) => v != null && v < 50).length;
    const counted = worst.cells.filter((v) => v != null).length;
    insights.push({
      icon: "fa-arrow-trend-down",
      tone: "bad",
      title: en ? `Gap · ${worst.title}` : `Lacuna · ${worst.title}`,
      big: String(Math.round(worst.avg)),
      note: multi ? (en ? `Under the median in ${below} of ${counted} seasons` : `Abaixo da mediana em ${below} de ${counted} temporadas`) : undefined,
      visual: { kind: "bars", rows: metricBars(bottoms) },
    });
  }

  const p = input.production;
  if (p.minutes > 0) {
    const ga = p.goals + p.assists;
    const xga = p.xg != null && p.xa != null ? p.xg + p.xa : null;
    let note: string | undefined;
    let tone: Insight["tone"] = "info";
    if (xga != null) {
      if (ga - xga >= 1.5 && ga >= xga * 1.3) {
        note = en ? "Above expected — tends to regress" : "Acima do esperado — tende a regredir";
        tone = "warn";
      } else if (ga - xga <= -1.5) note = en ? "Below expected — room to grow" : "Abaixo do esperado — margem para crescer";
      else note = en ? "In line with expected" : "Em linha com o esperado";
    }
    const top = Math.max(p.goals, p.assists, p.xg ?? 0, p.xa ?? 0, 1) * 1.15;
    const rows: InsightBar[] = [{ label: en ? "Goals" : "Gols", fill: (p.goals / top) * 100, display: String(p.goals), tone: "mid" }];
    if (p.xg != null) rows.push({ label: "xG", fill: (p.xg / top) * 100, display: num(p.xg, 1, lang), tone: "muted" });
    rows.push({ label: en ? "Assists" : "Assistências", fill: (p.assists / top) * 100, display: String(p.assists), tone: "mid" });
    if (p.xa != null) rows.push({ label: "xA", fill: (p.xa / top) * 100, display: num(p.xa, 1, lang), tone: "muted" });
    insights.push({
      icon: "fa-futbol",
      tone,
      title: en ? "Output" : "Produção",
      big: `${p.goals} G · ${p.assists} A`,
      note,
      visual: { kind: "bars", rows },
    });
  }

  if (input.physical?.length) {
    const rows = input.physical
      .filter((m) => m.pct != null && ["top_speed", "sprints_p90", "high_speed_km_p90", "kilometers_p90"].includes(m.key))
      .map((m) => ({
        label: m.label,
        fill: m.pct as number,
        display: m.value,
        tone: toneOfPct(m.pct as number),
        median: true,
      }));
    if (rows.length) {
      insights.push({
        icon: "fa-person-running",
        tone: "info",
        title: en ? "Physical (GPS)" : "Físico (GPS)",
        big: "",
        note: phys?.label,
        visual: { kind: "bars", rows },
      });
    }
  }

  // 3º parágrafo: na prática — onde rende, o movimento-chave e a adaptação possível.
  const body = [play.join(" "), ctx.join(" ")].filter(Boolean);
  if (fit?.best) {
    const b = fit.best;
    const where = en
      ? pick(6, [
          `In practice, he is at his best as ${an(b.role)} ${bold(lower(b.role))} in a ${bold(b.formation)} (${lower(b.tag)})`,
          `His natural fit is the ${bold(lower(b.role))} role in a ${bold(b.formation)}, as the ${lower(b.tag)}`,
        ])
      : pick(6, [
          `Na prática, rende mais como ${bold(lower(b.role))} num ${bold(b.formation)} (${lower(b.tag)})`,
          `O encaixe natural é como ${bold(lower(b.role))} num ${bold(b.formation)}, no papel de ${lower(b.tag)}`,
        ]);
    const move = b.moveLabel ? (en ? `; the key movement: ${lower(b.moveLabel)}` : `; o movimento-chave: ${lower(b.moveLabel)}`) : "";
    const cross = fit.cross
      ? en
        ? ` If the squad needs it, he can be adapted as ${an(fit.cross.name)} ${bold(lower(fit.cross.name))} (${fit.cross.formation}) — ${fit.cross.reason}.`
        : ` Se o elenco pedir, dá para adaptá-lo como ${bold(lower(fit.cross.name))} (${fit.cross.formation}): ${fit.cross.reason}.`
      : "";
    body.push(`${where}${move}.${cross}`);
  }

  return { story: { headline, body }, insights: insights.slice(0, 4), fit };
}
