import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import type { AspectItem, AspectSubMetric, PlayerProfile } from "@/lib/types";

/**
 * Aspect `efficiency_pct` is a pool percentile. The success rate lives in
 * `efficiency_value` ("55%") or in a percent sub-metric. Volume `display_value`
 * is already per 90 except for the season totals listed below.
 */
const SEASON_TOTALS = new Set([
  "gols",
  "xg",
  "xa",
  "pré assistências",
  "pre assistências",
  "assistências",
  "assistencias",
  "erros totais",
]);

const PREFERRED_SUB: Record<string, string> = {
  Progressão: "Conduções Progressivas",
  "Pré Assistências e xA": "Pré Assistências",
  Distribuição: "Passes",
  Finalizações: "Finalizações",
  "Gols e xG": "Gols",
  Ofensividade: "Ações Ofensivas",
  "Ações Terminais": "Ações Ofensivas",
  Verticalidade: "Recepção de Passes Longos",
  Efetividade: "Finalizações certas / passe recebido",
  Cruzamentos: "Cruzamentos",
};

const SUCCESS_LABELS: Record<string, string> = {
  "Duelos Defensivos": "Duelos Defensivos Vencidos/90",
  "Duelos Aéreos": "Duelos Aéreos Vencidos/90",
  Aéreo: "Duelos Aéreos Vencidos/90",
  "Duelos Vencidos": "Duelos Vencidos/90",
  "Disputas com Bola": "Disputas com Bola Vencidas/90",
  "Duelos Ofensivos": "Duelos Ofensivos Vencidos/90",
  "1v1 - Ofensivo": "Dribles com Sucesso/90",
  Dribles: "Dribles com Sucesso/90",
  "Passes Progressivos": "Passes Progressivos Certos/90",
  "Passes para Terço Final": "Passes para Terço Final Certos/90",
  "Passes Longos": "Passes Longos Certos/90",
  "Passes Criativos": "Passes Criativos Certos/90",
  Cruzamentos: "Cruzamentos Certos/90",
  Finalizações: "Finalizações Certas/90",
};

export type ScatterAxis = {
  value: number;
  label: string;
};

function parseNumber(raw?: string | null): number | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text || text === "—" || text.includes("%") || /^[+\-−]/.test(text)) return null;
  const value = Number(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function parseSigned(raw?: string | null): number | null {
  if (!raw) return null;
  const text = raw.trim().replace("−", "-").replace(/\s/g, "").replace(",", ".");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function parseSuccessRate(raw?: string | null): number | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value / 100 : null;
}

function per90(value: number, label: string, minutes: number): number {
  if (!SEASON_TOTALS.has(label.trim().toLowerCase())) return value;
  const exposure = minutes / 90;
  if (exposure <= 0) return 0;
  return value / exposure;
}

function volumeLabel(label: string): string {
  if (label.includes("/") || label.includes("%") || /\/90$/.test(label)) return label;
  if (/^efici[eê]ncia/i.test(label)) return label;
  return `${label}/90`;
}

export function successAxisLabel(label: string): string {
  if (SUCCESS_LABELS[label]) return SUCCESS_LABELS[label];
  if (/^finaliza/i.test(label)) return "Finalizações Certas/90";
  if (/drib|1v1/i.test(label)) return "Dribles com Sucesso/90";
  if (/a[eé]reo/i.test(label)) return "Duelos Aéreos Vencidos/90";
  if (/disput/i.test(label)) return `${label} Vencidas/90`;
  if (/duel/i.test(label)) return `${label} Vencidos/90`;
  if (/cruzament/i.test(label)) return "Cruzamentos Certos/90";
  if (/passe/i.test(label)) return `${label} Certos/90`;
  return `${label} com Sucesso/90`;
}

function alreadyWon(label: string): boolean {
  return /vencid/i.test(label);
}

function successRate(item: AspectItem): number | null {
  const direct = parseSuccessRate(item.efficiency_value);
  if (direct != null) return direct;
  for (const sub of item.sub_metrics ?? []) {
    const rate = parseSuccessRate(sub.display_value);
    if (rate == null) continue;
    if (/efici|certa|sucesso|ganh|vencid/i.test(sub.label)) return rate;
  }
  return null;
}

function volumeSubs(item: AspectItem): AspectSubMetric[] {
  return (item.sub_metrics ?? []).filter((sub) => {
    if (parseSuccessRate(sub.display_value) != null) return false;
    if (/^efici/i.test(sub.label)) return false;
    return parseNumber(sub.display_value) != null;
  });
}

function chosenSub(item: AspectItem, subs: AspectSubMetric[]): AspectSubMetric | undefined {
  const preferred = PREFERRED_SUB[item.label];
  if (preferred) return subs.find((sub) => sub.label === preferred) ?? subs[0];
  return subs[0];
}

function volumeOnlyLabel(parent: string, subLabel: string): string {
  if (parent === "Progressão") return "Conduções Progressivas/90";
  if (parent === "Pré Assistências e xA") return "Pré Assistências/90";
  if (parent === "Distribuição") return "Passes/90";
  if (parent === "Gols e xG") return "Gols/90";
  if ((parent === "Ofensividade" || parent === "Ações Terminais") && /ações ofensivas/i.test(subLabel)) {
    return "Ações Ofensivas/90";
  }
  if (/toques na área/i.test(subLabel)) return "Toques na Área/90";
  if (parent === "Verticalidade") return "Recepção de Passes Longos/90";
  if (parent === "Finalizações") return "Finalizações/90";
  if (parent === "Efetividade") return subLabel;
  return volumeLabel(subLabel === parent ? parent : subLabel);
}

function sumPer90(subs: AspectSubMetric[], minutes: number): number {
  return subs.reduce((total, sub) => total + per90(parseNumber(sub.display_value) ?? 0, sub.label, minutes), 0);
}

export function scatterAxis(player: PlayerProfile, key: string): ScatterAxis {
  const item = findAspect(flattenAspects(player), key);
  if (!item) return { value: player.scatter[key] ?? 0, label: volumeLabel(key) };

  const minutes = player.minutes ?? 0;

  if (item.kind === "def_efficiency_group" || item.label === "Eficiência Defensiva") {
    const score = item.sub_metrics?.find((sub) => /efici[eê]ncia defensiva/i.test(sub.label));
    return { value: parseSigned(score?.display_value) ?? 0, label: "Eficiência Defensiva" };
  }

  if (alreadyWon(item.label)) {
    const won = parseNumber(item.display_value);
    if (won != null) return { value: won, label: successAxisLabel(item.label) };
  }

  const rate = successRate(item);
  const subs = volumeSubs(item);

  if (!subs.length) {
    const raw = parseNumber(item.display_value) ?? item.certos_per90 ?? null;
    if (raw == null) return { value: 0, label: volumeLabel(item.label) };
    const base = per90(raw, item.label, minutes);
    if (rate != null) return { value: base * rate, label: successAxisLabel(item.label) };
    return { value: base, label: volumeLabel(item.label) };
  }

  if (item.label === "Ações Defensivas") {
    return { value: sumPer90(subs, minutes), label: "Ações Defensivas/90" };
  }

  if (item.label === "Passes Chave e Área") {
    return { value: sumPer90(subs, minutes), label: "Passes Chave e Área/90" };
  }

  const sub = chosenSub(item, subs);
  if (!sub) return { value: 0, label: volumeLabel(item.label) };
  const base = per90(parseNumber(sub.display_value) ?? 0, sub.label, minutes);
  if (rate != null) return { value: base * rate, label: successAxisLabel(item.label) };
  return { value: base, label: volumeOnlyLabel(item.label, sub.label) };
}

export function scatterAxisLabel(players: PlayerProfile[], key: string): string {
  for (const player of players) {
    const axis = scatterAxis(player, key);
    if (/\/90$/.test(axis.label) && /vencid|sucesso|cert/i.test(axis.label)) return axis.label;
  }
  const sample = players.find((player) => findAspect(flattenAspects(player), key)) ?? players[0];
  return sample ? scatterAxis(sample, key).label : volumeLabel(key);
}
