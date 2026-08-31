"use client";

import { useMemo } from "react";
import type { AspectItem, PlayerProfile } from "@/lib/types";
import { ConstructionProfileBars } from "../ConstructionProfileBars";

type TendencyEntry = {
  item: AspectItem;
  displayLabel: string;
  infoTip: string;
};

const CONSTRUCTION_TIPS: Record<string, string> = {
  pass_tendency:
    "Proporção de passes longos em relação ao total de passes do atleta, posicionando-o entre construção curta e longa.",
  progressive_share:
    "Participação de passes progressivos no volume total de passes, indicando tendência de conduzir o jogo para frente (baixo → alto).",
};

const DEFENSIVE_TIPS: Record<string, string> = {
  def_contact_style:
    "Equilíbrio entre ações de cobertura de espaço e intervenções agressivas (duelos, contatos) na defesa.",
  def_foul_style:
    "Relação entre faltas cometidas e volume defensivo — indica quão disciplinado o jogador é nas ações defensivas.",
};

function mapConstructionItems(items: AspectItem[]): TendencyEntry[] {
  const progressive = items.find(
    (item) => item.bar_key === "progressive_share" || item.label === "Passes Progressivos",
  );
  const passStyle = items.find(
    (item) => item.bar_key === "pass_tendency" || item.label === "Tendência de Passe",
  );

  const mapped: TendencyEntry[] = [];

  if (progressive) {
    mapped.push({
      item: progressive,
      displayLabel: "Tendência de Passe",
      infoTip:
        CONSTRUCTION_TIPS.progressive_share ??
        "Tendência de passes progressivos por 90 minutos comparada ao pool da posição.",
    });
  }

  if (passStyle) {
    mapped.push({
      item: passStyle,
      displayLabel: "Tipo de Construção",
      infoTip:
        CONSTRUCTION_TIPS.pass_tendency ??
        "Preferência entre passes curtos e longos no perfil de construção do atleta.",
    });
  }

  if (!mapped.length) {
    return items.map((item) => ({
      item,
      displayLabel: item.label,
      infoTip: "",
    }));
  }

  return mapped;
}

function mapDefensiveItems(items: AspectItem[]): TendencyEntry[] {
  return items.map((item) => ({
    item,
    displayLabel: item.label,
    infoTip: (item.bar_key && DEFENSIVE_TIPS[item.bar_key]) || "",
  }));
}

export function ProfilePillarBars({ player }: { player: PlayerProfile }) {
  const constr = player.aspects.perfil_construcao ?? [];
  const def = player.aspects.perfil_defensivo ?? [];

  const constructionEntries = useMemo(() => mapConstructionItems(constr), [constr]);
  const defensiveEntries = useMemo(() => mapDefensiveItems(def), [def]);

  return (
    <details className="player-card xp-profile-panel-card tendencies-accordion">
      <summary className="tendencies-accordion-trigger">
        <span className="tendencies-accordion-left">
          <span className="report-pass-accordion-chevron" aria-hidden="true">
            ›
          </span>
          <span className="section-label tendencies-accordion-title">Tendências de jogo</span>
        </span>
      </summary>
      <div className="tendencies-accordion-panel">
        <div className="xp-profile-pillar-stack">
          {constructionEntries.length ? (
            <article className="xp-profile-pillar-card xp-profile-pillar-productivity">
              <div className="xp-profile-pillar-body">
                <ConstructionProfileBars entries={constructionEntries} embedded />
              </div>
            </article>
          ) : null}

          {defensiveEntries.length ? (
            <article className="xp-profile-pillar-card xp-profile-pillar-precision">
              <header className="xp-profile-pillar-head">
                <span className="xp-profile-pillar-icon" aria-hidden="true">
                  <i className="fa-solid fa-shield-halved" />
                </span>
                <div className="xp-profile-pillar-title-wrap">
                  <h4 className="xp-profile-pillar-title">Perfil defensivo</h4>
                </div>
              </header>
              <div className="xp-profile-pillar-body">
                <ConstructionProfileBars entries={defensiveEntries} embedded />
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </details>
  );
}
