import { reportLocale, type ReportLang } from "@/lib/reportI18n";

/** Leituras automáticas da página final do PDF ("Resumo do analista"). */

export type InsightDir = "up" | "down" | "even";

export type InsightInput = {
  lang: ReportLang;
  position: string;
  profile: { label: string; share: number; second: { label: string; share: number } | null } | null;
  /** Temporadas em ordem cronológica. */
  seasons: { year: string; club: string; minutes: number; minutesPct: number | null }[];
  /** Blocos (média dos percentis): uma célula por temporada + média ponderada. */
  blocks: { title: string; cells: (number | null)[]; avg: number }[];
  /** Métricas com percentil médio entre as temporadas. */
  metrics: { name: string; context: string; percentile: number }[];
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
  /** Parágrafos da síntese (jogo, físico, trajetória). */
  paragraphs: { label: string; text: string }[];
  insights: Insight[];
  fit: { yes: string; no: string };
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
};

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

export function buildInsights(input: InsightInput): InsightReport {
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
  const worst2 = weakest[1] && weakest[1].avg < 45 ? weakest[1] : null;
  const second = byAvg[1] && byAvg[1].avg >= 55 ? byAvg[1] : null;
  const span = multi ? `${first.year.slice(2)}–${last.year.slice(2)}` : first?.year ?? "";

  const ranked = [...input.metrics].filter((m) => m.name !== input.errorsLabel).sort((a, b) => b.percentile - a.percentile);
  const allRanked = [...input.metrics].sort((a, b) => b.percentile - a.percentile);
  const tops = ranked.slice(0, 3);
  const bottoms = [...allRanked].reverse().slice(0, 3);
  const metricBars = (items: typeof tops): InsightBar[] =>
    items.map((m) => ({ label: m.name, fill: m.percentile, display: String(m.percentile), tone: toneOfPct(m.percentile), median: true }));

  // ── Síntese ─────────────────────────────────────────────────────────────
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
  const cap = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);
  const paragraphs: { label: string; text: string }[] = [];

  // Jogo: quem é o atleta.
  const share = input.profile ? Math.round(input.profile.share) : 0;
  const secondary = input.profile?.second && input.profile.second.share >= 25 ? input.profile.second : null;
  const phrase = input.profile ? PROFILE_PHRASE[input.profile.label]?.[lang] ?? null : null;
  const strongAerial = tops.some((m) => /(a[ée]re|aerial)/i.test(m.name));
  const tall = pr.heightCm != null && pr.heightCm >= 186;
  const tallBit = tall
    ? en
      ? `tall (${pr.heightCm} cm)${strongAerial ? ", which shows in the aerial numbers" : ""}`
      : `porte alto (${pr.heightCm} cm)${strongAerial ? ", que aparece nos números aéreos" : ""}`
    : null;
  const identity = [input.position, pr.age != null ? (en ? `${pr.age} years old` : `${pr.age} anos`) : null, pr.foot, tallBit]
    .filter(Boolean)
    .join(", ");
  let game = `${cap(identity)}.`;
  if (input.profile) {
    const lower = input.profile.label.toLocaleLowerCase(en ? "en-GB" : "pt-BR");
    const how = share >= 60 ? (en ? "predominantly" : "predominantemente") : share >= 45 ? (en ? "mostly" : "majoritariamente") : null;
    const tag = how
      ? `${how} ${lower} (${share}%)`
      : en
        ? `a blend led by ${input.profile.label} (${share}%)`
        : `perfil misto, liderado por ${input.profile.label} (${share}%)`;
    game += ` ${cap(phrase ?? (en ? "profile" : "perfil"))}, ${tag}`;
    if (secondary) game += en ? `, with traces of ${secondary.label} (${Math.round(secondary.share)}%)` : `, com traços de ${secondary.label} (${Math.round(secondary.share)}%)`;
    game += ".";
  }
  paragraphs.push({ label: en ? "Game" : "Jogo", text: game });

  if (phys) paragraphs.push({ label: en ? "Physical" : "Físico", text: phys.sentence });

  // Trajetória: minutos, histórico e situação contratual.
  const bits: string[] = [];
  const lastMin = last.minutesPct;
  const total = seasons.reduce((sum, season) => sum + season.minutes, 0);
  const fmtMin = (v: number) => v.toLocaleString(reportLocale(lang));
  const role =
    lastMin == null
      ? null
      : lastMin >= 55
        ? en ? "is a regular starter" : "é titular"
        : lastMin >= 30
          ? en ? "has a run of games" : "tem sequência"
          : en ? "has had few minutes" : "teve poucos minutos";
  if (multi) {
    const tail = role && lastMin != null
      ? en
        ? `; in ${last.year} he ${role} at ${last.club} (${Math.round(lastMin)}% of league minutes)`
        : `; em ${last.year} ${role} no ${last.club} (${Math.round(lastMin)}% dos minutos da competição)`
      : "";
    bits.push(en ? `${fmtMin(total)} minutes over ${n} seasons${tail}.` : `${fmtMin(total)} min em ${n} temporadas${tail}.`);
    const shorts = seasons.filter((season) => season.minutesPct != null && season.minutesPct < 30 && season !== last);
    if (shorts.length) {
      const names = list(shorts.map((x) => `${x.year} (${Math.round(x.minutesPct as number)}%)`), lang);
      bits.push(
        en
          ? `${names} ${shorts.length > 1 ? "are short samples" : "is a short sample"}, so read with caution.`
          : `${names} ${shorts.length > 1 ? "são amostras curtas e pedem" : "é amostra curta e pede"} cautela.`,
      );
    }
  } else {
    const where = en ? ` at ${last.club}` : ` no ${last.club}`;
    const pct = lastMin != null ? (en ? ` (${Math.round(lastMin)}% of league minutes)` : ` (${Math.round(lastMin)}% da competição)`) : "";
    bits.push(en ? `${fmtMin(total)} minutes${pct}${where}${role ? `; ${role}` : ""}.` : `${fmtMin(total)} min${pct}${where}${role ? `, onde ${role}` : ""}.`);
  }
  if (bigTrend) {
    const moved = first.club !== last.club;
    const up = bigTrend.delta > 0;
    bits.push(
      en
        ? `${bigTrend.title} ${up ? "rose" : "fell"} from ${bigTrend.from} to ${bigTrend.to}${moved ? `, coinciding with the move from ${first.club} to ${last.club}: worth checking whether it is the new team's tactical role` : ""}.`
        : `${bigTrend.title} ${up ? "subiu" : "caiu"} de ${bigTrend.from} para ${bigTrend.to}${moved ? `, junto com a mudança de ${first.club} para o ${last.club}: vale entender se é função tática do novo clube` : ""}.`,
    );
  } else if (multi) {
    bits.push(en ? "Profile stable across seasons and clubs." : "Perfil estável entre temporadas e clubes.");
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
  if (deal.length) bits.push(`${cap(list(deal, lang))}${ageNote}.`);
  paragraphs.push({ label: en ? "Track record" : "Trajetória", text: bits.join(" ") });

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

  // ── Encaixe ─────────────────────────────────────────────────────────────
  const yes = best
    ? en
      ? `Teams that need ${voice(best.title, "role", lang)}${second ? ` and ${voice(second.title, "role", lang)}` : ""}.`
      : `Times que precisem de ${voice(best.title, "role", lang)}${second ? ` e ${voice(second.title, "role", lang)}` : ""}.`
    : "—";
  const xga = p.xg != null && p.xa != null ? p.xg + p.xa : null;
  const overperf = xga != null && p.goals + p.assists - xga >= 1.5 && p.goals + p.assists >= xga * 1.3;
  let no = worst
    ? en
      ? `Roles that demand ${voice(worst.title, "role", lang)}${worst2 ? ` and ${voice(worst2.title, "role", lang)}` : ""}.`
      : `Funções que exijam ${voice(worst.title, "role", lang)}${worst2 ? ` e ${voice(worst2.title, "role", lang)}` : ""}.`
    : en
      ? "No clear statistical restriction."
      : "Sem restrição estatística clara.";
  if (overperf) no += en ? " G+A above xG+xA tends to drop." : " G+A acima do xG+xA tende a cair.";

  return { paragraphs, insights: insights.slice(0, 4), fit: { yes, no } };
}
