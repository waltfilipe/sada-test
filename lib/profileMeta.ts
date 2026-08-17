import type { PositionFamily } from "./types";

export type ProfileMetaItem = {
  key: string;
  label: string;
  tone: string;
};

export const FAMILY_PROFILE_META: Record<PositionFamily, ProfileMetaItem[]> = {
  zagueiros: [
    { key: "combativo", label: "Combativo", tone: "combativo" },
    { key: "construtor", label: "Construtor", tone: "construtor" },
    { key: "posicional", label: "Posicional", tone: "posicional" },
  ],
  laterais: [
    { key: "defensivo", label: "Defensivo", tone: "defensivo" },
    { key: "construtor", label: "Construtor", tone: "construtor" },
    { key: "vertical", label: "Vertical", tone: "vertical" },
    { key: "ofensivo", label: "Ofensivo", tone: "ofensivo" },
  ],
  "meio-campistas": [
    { key: "contencao", label: "Contenção", tone: "contencao" },
    { key: "construtor", label: "Construtor", tone: "construtor" },
    { key: "boxtobox", label: "Box-to-box", tone: "boxtobox" },
    { key: "ofensivo", label: "Ofensivo", tone: "ofensivo" },
  ],
  extremos: [
    { key: "criador", label: "Criador", tone: "criador" },
    { key: "meia_ponta", label: "Meia Ponta", tone: "meia-ponta" },
    { key: "vertical", label: "Vertical", tone: "vertical" },
  ],
  "meias-ofensivos": [
    { key: "armador", label: "Armador", tone: "armador" },
    { key: "finalizador", label: "Finalizador", tone: "finalizador" },
  ],
  atacantes: [
    { key: "finalizador", label: "Finalizador", tone: "finalizador" },
    { key: "alvo", label: "Alvo", tone: "alvo" },
    { key: "movel", label: "Móvel", tone: "movel" },
  ],
};

export function profileMetaForFamily(family: PositionFamily): ProfileMetaItem[] {
  return FAMILY_PROFILE_META[family];
}
