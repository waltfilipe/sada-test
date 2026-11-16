import type { ReportLang } from "@/lib/reportI18n";

/** Encaixe tático do PDF: esquemas e funções indicados a partir do perfil e dos percentis do atleta.
 *
 *  Modelo em duas camadas:
 *  1) funções (roles) com nomes do jargão de scout — pontuadas por afinidade de perfil,
 *     percentis por bloco, percentis de métricas específicas e GPS;
 *  2) cada slot de cada esquema lista as funções que cabem nele — o card mostra a função
 *     em que o atleta renderia melhor NAQUELE desenho (o nome muda por esquema). */

export type Trait = "defensivos" | "aereo" | "passes" | "dribles" | "finais" | "ofensividade" | "finalizacao";
export type XY = [number, number];
type Pair = { pt: string; en: string };
type FormationKey = "4-3-3" | "4-2-3-1" | "4-4-2" | "3-5-2" | "3-4-3" | "4-1-2-1-2" | "3-4-2-1";
type PhysKey = "speed" | "rep" | "vol";
type Weights = Partial<Record<Trait, number>>;
type PhysWeights = Partial<Record<PhysKey, number>>;
/** [padrão do nome da métrica (sem acento, minúsculo), peso] */
type MetricWeight = [string, number];

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
  /** Arquétipo do site que reforça esta função (rótulo PT). */
  profile?: string;
  traits: Weights;
  metrics?: MetricWeight[];
  phys?: PhysWeights;
};

type SchemeDef = {
  formation: FormationKey;
  /** Rótulo do slot dentro do desenho ("Pivô único", "Interior do losango"...). */
  tag: Pair;
  /** Funções que esse slot oferece — o card usa a de maior encaixe do atleta. */
  roles: string[];
  at: XY;
  why: Pair;
  need: Weights;
  phys?: PhysWeights;
};

type FamilyDef = { roles: RoleDef[]; schemes: SchemeDef[]; mirror: boolean };

const p = (pt: string, en: string): Pair => ({ pt, en });

const FAMILIES: Record<string, FamilyDef> = {
  zagueiros: {
    mirror: true,
    roles: [
      {
        key: "construtor",
        profile: "Construtor",
        name: p("Zagueiro construtor", "Ball-playing centre-back"),
        blurb: p("Inicia a saída, quebra linhas com o passe e conduz", "Starts moves, breaks lines with the pass and carries"),
        traits: { passes: 0.5, defensivos: 0.2, dribles: 0.3 },
        metrics: [["passes progressivos", 0.4], ["passes para terço final", 0.3], ["conduções", 0.3]],
      },
      {
        key: "anticipador",
        profile: "Combativo",
        name: p("Zagueiro de antecipação", "Front-foot centre-back"),
        blurb: p("Sai para o duelo, antecipa e pressiona o portador", "Steps out to duel, anticipates and presses the carrier"),
        traits: { defensivos: 0.7, aereo: 0.3 },
        metrics: [["duelos defensivos", 0.45], ["ações defensivas", 0.35], ["duelos aéreos", 0.2]],
      },
      {
        key: "area",
        profile: "Defensor de Área",
        name: p("Zagueiro de área", "Penalty-box defender"),
        blurb: p("Posicionado na grande área: protege e domina o jogo aéreo", "Positioned in the box: protects it and dominates in the air"),
        traits: { aereo: 0.5, defensivos: 0.5 },
        metrics: [["duelos aéreos", 0.45], ["eficiência defensiva", 0.3], ["ações defensivas", 0.25]],
      },
      {
        key: "libero",
        profile: "Construtor",
        name: p("Líbero", "Sweeper"),
        blurb: p("Homem central do trio: cobre, sai com bola e organiza", "Central man of the three: covers, carries out and organises"),
        traits: { passes: 0.4, defensivos: 0.35, dribles: 0.25 },
        metrics: [["passes longos", 0.4], ["conduções", 0.3], ["ações defensivas", 0.3]],
      },
      {
        key: "lado",
        profile: "Combativo",
        name: p("Zagueiro de lado", "Wide centre-back"),
        blurb: p("Lateral do trio de zaga: cobre o corredor e sai em condução", "Wide man of the back three: covers the channel and carries out"),
        traits: { defensivos: 0.45, dribles: 0.25, passes: 0.3 },
        metrics: [["duelos defensivos", 0.4], ["conduções", 0.3], ["ações defensivas", 0.3]],
        phys: { speed: 0.3, rep: 0.2 },
      },
    ],
    schemes: [
      {
        formation: "4-3-3",
        tag: p("Lado da zaga", "Side of the back four"),
        roles: ["construtor", "anticipador", "area"],
        at: [63, 78],
        why: p("Linha alta e saída curta: pede passe vertical e cobertura", "High line and short build-up: needs vertical passing and cover"),
        need: { passes: 0.45, defensivos: 0.35, dribles: 0.2 },
      },
      {
        formation: "4-2-3-1",
        tag: p("Zaga atrás do duplo pivô", "Back line behind the double pivot"),
        roles: ["area", "anticipador", "construtor"],
        at: [63, 78],
        why: p("Bloco médio compacto: protege a área e vence no alto", "Compact mid-block: protects the box and wins in the air"),
        need: { defensivos: 0.5, aereo: 0.5 },
      },
      {
        formation: "4-4-2",
        tag: p("Dupla de zaga", "Centre-back pair"),
        roles: ["anticipador", "area"],
        at: [62, 78],
        why: p("Duas linhas de quatro: antecipa e duela perto da área", "Two banks of four: anticipates and duels near the box"),
        need: { defensivos: 0.6, aereo: 0.4 },
      },
      {
        formation: "3-5-2",
        tag: p("Homem central do trio", "Central man of the back three"),
        roles: ["libero", "construtor", "area"],
        at: [50, 80],
        why: p("Central dos três: organiza a saída e cobre os companheiros", "Middle of three: organises build-up and covers team-mates"),
        need: { passes: 0.45, defensivos: 0.35, dribles: 0.2 },
      },
      {
        formation: "3-5-2",
        tag: p("Zagueiro de lado do trio", "Wide centre-back of the three"),
        roles: ["lado", "anticipador"],
        at: [75, 77],
        why: p("Cobre o corredor, sai para o duelo e apoia o ala", "Covers the channel, steps out to duel and supports the wing-back"),
        need: { defensivos: 0.5, dribles: 0.2, passes: 0.3 },
        phys: { speed: 0.2, rep: 0.2 },
      },
      {
        formation: "3-4-3",
        tag: p("Zagueiro de lado do trio", "Wide centre-back of the three"),
        roles: ["lado", "anticipador"],
        at: [75, 77],
        why: p("Sai para duelar e acompanha o extremo adversário", "Steps out to duel and tracks the opposing wide man"),
        need: { defensivos: 0.5, dribles: 0.2, passes: 0.3 },
        phys: { speed: 0.2, rep: 0.2 },
      },
      {
        formation: "3-4-2-1",
        tag: p("Zagueiro de lado do trio", "Wide centre-back of the three"),
        roles: ["lado", "anticipador"],
        at: [75, 77],
        why: p("Cobre o corredor e inicia a saída pelo lado", "Covers the channel and starts the build-up wide"),
        need: { defensivos: 0.45, dribles: 0.2, passes: 0.35 },
        phys: { speed: 0.2, rep: 0.2 },
      },
      {
        formation: "4-1-2-1-2",
        tag: p("Zaga do losango", "Back line in the diamond"),
        roles: ["area", "anticipador"],
        at: [63, 78],
        why: p("Sem amplitude própria: a zaga precisa vencer 1v1 e o jogo aéreo", "With no natural width the back line must win duels and aerials"),
        need: { defensivos: 0.5, aereo: 0.5 },
      },
    ],
  },
  laterais: {
    mirror: true,
    roles: [
      {
        key: "ala",
        profile: "Ofensivo",
        name: p("Ala", "Wing-back"),
        blurb: p("Dono do corredor inteiro: defende como lateral e ataca como ponta", "Owns the whole flank: defends like a full-back, attacks like a winger"),
        traits: { finais: 0.3, defensivos: 0.25, ofensividade: 0.25, dribles: 0.2 },
        metrics: [["cruzamentos", 0.4], ["ações defensivas", 0.3], ["progressão", 0.3]],
        phys: { rep: 0.4, vol: 0.3 },
      },
      {
        key: "apoio",
        profile: "Híbrido",
        name: p("Lateral de apoio", "Support full-back"),
        blurb: p("Sobe em ultrapassagem com critério e equilibra as duas fases", "Overlaps with judgement and balances both phases"),
        traits: { defensivos: 0.35, finais: 0.25, passes: 0.2, ofensividade: 0.2 },
        metrics: [["cruzamentos", 0.3], ["ações defensivas", 0.4], ["passes progressivos", 0.3]],
      },
      {
        key: "marcacao",
        profile: "Defensivo",
        name: p("Lateral de marcação", "Defensive full-back"),
        blurb: p("Fecha o corredor, marca por fora e arrisca pouco", "Shuts the flank, marks wide and takes few risks"),
        traits: { defensivos: 0.65, passes: 0.2, dribles: 0.15 },
        metrics: [["duelos defensivos", 0.4], ["ações defensivas", 0.4], ["eficiência defensiva", 0.2]],
      },
      {
        key: "invertido",
        profile: "Construtor",
        name: p("Lateral-meia", "Inverted full-back"),
        blurb: p("Fecha por dentro na saída e vira opção de passe no meio", "Steps inside in build-up and becomes a midfield passing option"),
        traits: { passes: 0.55, dribles: 0.2, defensivos: 0.25 },
        metrics: [["passes progressivos", 0.35], ["distribuição", 0.35], ["disputas com bola", 0.3]],
      },
    ],
    schemes: [
      {
        formation: "4-3-3",
        tag: p("Lateral do corredor", "Flank full-back"),
        roles: ["apoio", "invertido", "ala"],
        at: [87, 73],
        why: p("Sobe em ultrapassagem com o trio de meio cobrindo atrás", "Overlaps while the midfield three cover behind"),
        need: { ofensividade: 0.3, finais: 0.3, dribles: 0.2, defensivos: 0.2 },
      },
      {
        formation: "4-2-3-1",
        tag: p("Lateral do corredor", "Flank full-back"),
        roles: ["invertido", "apoio", "marcacao"],
        at: [87, 73],
        why: p("Com o duplo pivô, pode virar meia na saída e liberar o ponta", "With the double pivot he can become a midfielder in build-up and free the winger"),
        need: { passes: 0.45, defensivos: 0.3, dribles: 0.25 },
      },
      {
        formation: "4-4-2",
        tag: p("Lateral de linha de quatro", "Full-back in a flat four"),
        roles: ["marcacao", "apoio"],
        at: [87, 73],
        why: p("Cobre o corredor e fecha o meia aberto adversário", "Covers the flank and shuts down the opposing wide midfielder"),
        need: { defensivos: 0.6, passes: 0.2, ofensividade: 0.2 },
      },
      {
        formation: "3-5-2",
        tag: p("Ala", "Wing-back"),
        roles: ["ala", "apoio"],
        at: [90, 50],
        why: p("Defende como lateral e ataca como ponta: pede motor e cruzamento", "Defends like a full-back, attacks like a winger: needs engine and crossing"),
        need: { finais: 0.3, ofensividade: 0.25, defensivos: 0.3, dribles: 0.15 },
        phys: { rep: 0.35, vol: 0.3 },
      },
      {
        formation: "3-4-3",
        tag: p("Ala", "Wing-back"),
        roles: ["ala", "apoio"],
        at: [90, 52],
        why: p("Único dono do corredor com três zagueiros atrás", "Sole owner of the flank with three centre-backs behind"),
        need: { finais: 0.3, ofensividade: 0.25, defensivos: 0.3, dribles: 0.15 },
        phys: { rep: 0.35, vol: 0.3 },
      },
      {
        formation: "3-4-2-1",
        tag: p("Ala", "Wing-back"),
        roles: ["ala"],
        at: [90, 53],
        why: p("Amplitude do time: corre o corredor para alimentar os dois meias", "The team's width: runs the flank to feed the two playmakers"),
        need: { finais: 0.35, ofensividade: 0.25, defensivos: 0.25, dribles: 0.15 },
        phys: { rep: 0.4, vol: 0.3 },
      },
      {
        formation: "4-1-2-1-2",
        tag: p("Único corredor do time", "The team's only width"),
        roles: ["ala", "apoio"],
        at: [87, 73],
        why: p("Sem pontas, o lateral é a amplitude: pede motor e cruzamento", "With no wingers the full-back is the width: needs engine and crossing"),
        need: { finais: 0.3, ofensividade: 0.25, defensivos: 0.25, dribles: 0.2 },
        phys: { vol: 0.4, rep: 0.3 },
      },
    ],
  },
  "meio-campistas": {
    mirror: false,
    roles: [
      {
        key: "contencao",
        profile: "Contenção",
        name: p("Primeiro volante", "Holding midfielder"),
        blurb: p("Fixa-se à frente da zaga: corta linhas de passe e equilibra", "Sits in front of the defence: cuts passing lanes and balances"),
        traits: { defensivos: 0.65, passes: 0.35 },
        metrics: [["ações defensivas", 0.45], ["eficiência defensiva", 0.3], ["passes longos", 0.25]],
      },
      {
        key: "pressao",
        profile: "Contenção",
        name: p("Volante de pressão", "Ball-winning midfielder"),
        blurb: p("Caçador de bola: duelo, desarme e intensidade na marcação", "Ball-hunter: duels, tackles and pressing intensity"),
        traits: { defensivos: 0.75, dribles: 0.15, passes: 0.1 },
        metrics: [["duelos defensivos", 0.5], ["ações defensivas", 0.35], ["duelos aéreos", 0.15]],
        phys: { rep: 0.3 },
      },
      {
        key: "regista",
        profile: "Construtor",
        name: p("Regista", "Deep-lying playmaker"),
        blurb: p("Recebe da zaga, dita o ritmo e muda o corredor com o lançamento", "Receives from the back line, sets the tempo and switches play"),
        traits: { passes: 0.65, finais: 0.15, defensivos: 0.2 },
        metrics: [["passes longos", 0.4], ["distribuição", 0.35], ["passes progressivos", 0.25]],
      },
      {
        key: "segundo",
        profile: "Híbrido",
        name: p("Segundo volante", "Second pivot"),
        blurb: p("Sai da base com bola e chega à frente sem perder a cobertura", "Steps out of the double pivot and arrives without losing cover"),
        traits: { defensivos: 0.35, passes: 0.25, dribles: 0.2, ofensividade: 0.2 },
        metrics: [["conduções", 0.35], ["ações defensivas", 0.35], ["disputas com bola", 0.3]],
      },
      {
        key: "b2b",
        profile: "Box-to-box",
        name: p("Box-to-box", "Box-to-box midfielder"),
        blurb: p("Duas áreas: chega ao ataque e volta para compor", "Both boxes: arrives in attack and recovers to hold shape"),
        traits: { defensivos: 0.3, ofensividade: 0.25, dribles: 0.2, passes: 0.15, finais: 0.1 },
        metrics: [["finalizações", 0.3], ["ações defensivas", 0.35], ["conduções", 0.35]],
        phys: { vol: 0.4, rep: 0.3 },
      },
      {
        key: "mezzala",
        profile: "Híbrido",
        name: p("Interior (mezzala)", "Inside-half (mezzala)"),
        blurb: p("Joga no half-space: conduz, associa e ataca o espaço", "Plays the half-space: carries, combines and attacks the gap"),
        traits: { dribles: 0.3, finais: 0.3, passes: 0.25, ofensividade: 0.15 },
        metrics: [["1v1 - ofensivo", 0.35], ["passes chave", 0.35], ["conduções", 0.3]],
      },
      {
        key: "armador",
        profile: "Construtor",
        name: p("Meia-armador", "Playmaker (10)"),
        blurb: p("Entre linhas: último passe, visão e criação", "Between the lines: final pass, vision and creation"),
        traits: { finais: 0.5, passes: 0.35, dribles: 0.15 },
        metrics: [["passes chave", 0.4], ["pré assistências", 0.35], ["passes criativos", 0.25]],
      },
      {
        key: "meia_ataque",
        profile: "Híbrido",
        name: p("Meia-atacante", "Attacking midfielder"),
        blurb: p("Infiltra e finaliza: joga como segundo atacante", "Makes runs and finishes: plays like a second striker"),
        traits: { ofensividade: 0.4, finais: 0.25, dribles: 0.2, passes: 0.15 },
        metrics: [["finalizações", 0.45], ["ofensividade", 0.3], ["1v1 - ofensivo", 0.25]],
      },
    ],
    schemes: [
      {
        formation: "4-3-3",
        tag: p("Pivô único", "Single pivot"),
        roles: ["contencao", "regista", "pressao"],
        at: [50, 60],
        why: p("Protege a zaga sozinho: recupera, cobre e dá o primeiro passe", "Shields the back line alone: recovers, covers and plays the first pass"),
        need: { defensivos: 0.55, passes: 0.45 },
      },
      {
        formation: "4-3-3",
        tag: p("Interior", "Inside midfielder"),
        roles: ["mezzala", "b2b", "segundo"],
        at: [70, 47],
        why: p("Pisa na área e fecha o meio nas duas fases", "Gets into the box and shuts the middle in both phases"),
        need: { dribles: 0.25, ofensividade: 0.3, defensivos: 0.25, finais: 0.2 },
        phys: { vol: 0.4, rep: 0.2 },
      },
      {
        formation: "4-2-3-1",
        tag: p("Duplo pivô", "Double pivot"),
        roles: ["segundo", "contencao", "regista", "pressao"],
        at: [63, 60],
        why: p("Dupla à frente da zaga: um segura, o outro distribui", "Pair in front of the defence: one holds, the other distributes"),
        need: { defensivos: 0.5, passes: 0.5 },
      },
      {
        formation: "4-2-3-1",
        tag: p("Meia entre linhas (10)", "Number 10 between the lines"),
        roles: ["armador", "meia_ataque", "mezzala"],
        at: [50, 38],
        why: p("Atrás do 9: cria, associa e finaliza", "Behind the 9: creates, combines and finishes"),
        need: { finais: 0.45, passes: 0.25, dribles: 0.3 },
      },
      {
        formation: "4-4-2",
        tag: p("Dupla de meio", "Central pair"),
        roles: ["b2b", "segundo", "pressao"],
        at: [62, 55],
        why: p("Só dois no meio: precisa chegar à área e voltar", "Only two in the middle: must arrive in the box and get back"),
        need: { defensivos: 0.35, passes: 0.25, ofensividade: 0.2, dribles: 0.2 },
        phys: { vol: 0.4 },
      },
      {
        formation: "4-1-2-1-2",
        tag: p("Pivô do losango", "Anchor of the diamond"),
        roles: ["contencao", "regista"],
        at: [50, 62],
        why: p("Âncora do losango: equilibra quatro jogadores à frente", "Anchor of the diamond: balances four players ahead"),
        need: { defensivos: 0.55, passes: 0.45 },
      },
      {
        formation: "4-1-2-1-2",
        tag: p("Interior do losango", "Diamond interior"),
        roles: ["b2b", "mezzala", "segundo"],
        at: [72, 49],
        why: p("Cobre o corredor sem pontas: pede fôlego e passe", "Covers the flank with no wingers: needs stamina and passing"),
        need: { defensivos: 0.3, passes: 0.3, ofensividade: 0.2, dribles: 0.2 },
        phys: { vol: 0.45 },
      },
      {
        formation: "3-5-2",
        tag: p("Base do trio", "Base of the midfield three"),
        roles: ["regista", "contencao"],
        at: [50, 60],
        why: p("Dita o ritmo com três zagueiros atrás e alas abertos", "Sets the tempo with three centre-backs behind and wing-backs wide"),
        need: { passes: 0.55, finais: 0.2, defensivos: 0.25 },
      },
      {
        formation: "3-5-2",
        tag: p("Interior do trio", "Inside man of the three"),
        roles: ["mezzala", "b2b", "segundo"],
        at: [68, 46],
        why: p("Ataca o half-space e fecha o meio na perda", "Attacks the half-space and shuts the middle on the turnover"),
        need: { dribles: 0.3, finais: 0.2, ofensividade: 0.25, defensivos: 0.25 },
        phys: { vol: 0.35 },
      },
      {
        formation: "3-4-2-1",
        tag: p("Meia-atacante da dupla", "One of two behind the striker"),
        roles: ["armador", "meia_ataque"],
        at: [70, 33],
        why: p("Um dos dois meias atrás do centroavante: cria e infiltra", "One of two behind the striker: creates and makes runs"),
        need: { finais: 0.4, ofensividade: 0.3, passes: 0.3 },
      },
      {
        formation: "3-4-2-1",
        tag: p("Duplo pivô", "Double pivot"),
        roles: ["segundo", "b2b", "contencao"],
        at: [62, 56],
        why: p("Dois no meio sustentam três zagueiros e dois meias", "Two in the middle support three centre-backs and two playmakers"),
        need: { defensivos: 0.45, passes: 0.35, ofensividade: 0.2 },
        phys: { vol: 0.4 },
      },
      {
        formation: "3-4-3",
        tag: p("Duplo pivô", "Double pivot"),
        roles: ["segundo", "b2b", "contencao"],
        at: [62, 54],
        why: p("Dois no meio protegem o trio de zaga e alimentam o ataque", "Two in the middle protect the back three and feed the attack"),
        need: { defensivos: 0.45, passes: 0.35, ofensividade: 0.2 },
        phys: { vol: 0.4 },
      },
    ],
  },
  extremos: {
    mirror: true,
    roles: [
      {
        key: "driblador",
        profile: "Driblador",
        name: p("Ponta de 1v1", "Touchline winger"),
        blurb: p("Aberto na linha: desequilibra no drible e chega ao fundo", "Hugs the line: unbalances in 1v1 and reaches the byline"),
        traits: { dribles: 0.5, finais: 0.3, passes: 0.1, ofensividade: 0.1 },
        metrics: [["1v1 - ofensivo", 0.45], ["cruzamentos", 0.3], ["disputas com bola", 0.25]],
      },
      {
        key: "ruptura",
        profile: "Ruptura",
        name: p("Extremo de ruptura", "Inside forward"),
        blurb: p("Ataca a profundidade, corta por dentro e finaliza", "Attacks depth, cuts inside and finishes"),
        traits: { finalizacao: 0.35, dribles: 0.25, ofensividade: 0.25, finais: 0.15 },
        metrics: [["gols e xg", 0.4], ["verticalidade", 0.35], ["1v1 - ofensivo", 0.25]],
        phys: { speed: 0.35, rep: 0.25 },
      },
      {
        key: "meia_ponta",
        profile: "Meia Ponta",
        name: p("Meia-ponta", "Inside playmaker"),
        blurb: p("Fecha por dentro e joga entre linhas: último passe e finalização", "Drifts inside between the lines: final pass and finishing"),
        traits: { finais: 0.4, passes: 0.25, dribles: 0.2, finalizacao: 0.15 },
        metrics: [["passes chave", 0.4], ["pré assistências", 0.35], ["passes criativos", 0.25]],
      },
      {
        key: "segundo_atq",
        profile: "Ruptura",
        name: p("Segundo atacante", "Second striker"),
        blurb: p("Joga colado no 9: associa e ataca a segunda bola", "Plays off the 9: links up and attacks the second ball"),
        traits: { finalizacao: 0.35, finais: 0.3, dribles: 0.2, ofensividade: 0.15 },
        metrics: [["gols e xg", 0.4], ["passes chave", 0.3], ["disputas com bola", 0.3]],
      },
      {
        key: "operario",
        profile: "Híbrido",
        name: p("Extremo de cobertura", "Wide worker"),
        blurb: p("Ataca e volta: compõe a linha de meio sem perder a saída de bola", "Attacks and tracks back: joins the midfield line without losing attacking output"),
        traits: { defensivos: 0.35, finais: 0.25, dribles: 0.25, ofensividade: 0.15 },
        metrics: [["recuperações", 0.4], ["ações defensivas", 0.35], ["cruzamentos", 0.25]],
        phys: { vol: 0.35, rep: 0.3 },
      },
    ],
    schemes: [
      {
        formation: "4-3-3",
        tag: p("Ponta do trio de ataque", "Winger of the front three"),
        roles: ["ruptura", "driblador", "meia_ponta"],
        at: [85, 22],
        why: p("Abre o campo ou corta por dentro; o lateral ultrapassa por fora", "Stretches play or cuts inside while the full-back overlaps"),
        need: { dribles: 0.3, finalizacao: 0.25, ofensividade: 0.25, finais: 0.2 },
        phys: { speed: 0.3 },
      },
      {
        formation: "4-2-3-1",
        tag: p("Extremo do trio de meias", "Wide man of the three"),
        roles: ["meia_ponta", "driblador", "ruptura"],
        at: [85, 36],
        why: p("Parte de fora e decide por dentro; volta para compor o bloco", "Starts wide, decides inside; tracks back into the block"),
        need: { dribles: 0.3, finais: 0.3, defensivos: 0.15, ofensividade: 0.25 },
      },
      {
        formation: "4-2-3-1",
        tag: p("Camisa 10", "Number 10"),
        roles: ["meia_ponta", "segundo_atq"],
        at: [50, 38],
        why: p("Entre linhas, atrás do 9: cria, associa e finaliza", "Between the lines behind the 9: creates, combines and finishes"),
        need: { finais: 0.4, passes: 0.25, finalizacao: 0.2, dribles: 0.15 },
      },
      {
        formation: "3-4-3",
        tag: p("Ponta aberto", "Wide winger"),
        roles: ["driblador", "ruptura"],
        at: [83, 22],
        why: p("Com alas atrás, joga na linha e decide no 1v1", "With wing-backs behind, hugs the line and decides in 1v1"),
        need: { dribles: 0.5, finais: 0.3, ofensividade: 0.2 },
        phys: { speed: 0.3 },
      },
      {
        formation: "3-4-2-1",
        tag: p("Meia-atacante", "Attacking midfielder"),
        roles: ["meia_ponta", "segundo_atq"],
        at: [70, 33],
        why: p("Um dos dois meias atrás do centroavante: cria e infiltra", "One of two behind the striker: creates and makes runs"),
        need: { finais: 0.35, finalizacao: 0.25, passes: 0.2, dribles: 0.2 },
      },
      {
        formation: "4-4-2",
        tag: p("Meia aberto", "Wide midfielder"),
        roles: ["operario", "driblador"],
        at: [87, 52],
        why: p("Abre o campo, dribla e cruza; volta para compor a linha de quatro", "Stretches play, dribbles and crosses; tracks back into the line of four"),
        need: { dribles: 0.35, finais: 0.3, defensivos: 0.2, ofensividade: 0.15 },
        phys: { rep: 0.2, vol: 0.3 },
      },
      {
        formation: "3-5-2",
        tag: p("Segundo atacante da dupla", "Second striker of the pair"),
        roles: ["segundo_atq", "ruptura"],
        at: [62, 17],
        why: p("Dupla à frente: associa com o 9 e acelera nas costas da linha", "Front pair: links with the 9 and accelerates in behind"),
        need: { finalizacao: 0.3, ofensividade: 0.3, dribles: 0.25, finais: 0.15 },
        phys: { speed: 0.35 },
      },
      {
        formation: "4-1-2-1-2",
        tag: p("Atacante do losango", "Striker in the diamond"),
        roles: ["segundo_atq", "meia_ponta"],
        at: [38, 15],
        why: p("Sem pontas, parte de dentro e ataca o corredor", "With no wingers, starts inside and attacks the channel"),
        need: { finalizacao: 0.3, dribles: 0.3, finais: 0.25, ofensividade: 0.15 },
      },
    ],
  },
  atacantes: {
    mirror: false,
    roles: [
      {
        key: "area",
        profile: "Finalizador",
        name: p("Centroavante de área", "Penalty-box striker"),
        blurb: p("Finalizador: posicionamento, primeiro toque e definição", "Finisher: positioning, first touch and end product"),
        traits: { finalizacao: 0.75, aereo: 0.15, dribles: 0.1 },
        metrics: [["gols e xg", 0.5], ["finalizações", 0.35], ["efetividade", 0.15]],
      },
      {
        key: "referencia",
        profile: "Alvo",
        name: p("Homem de referência", "Target man"),
        blurb: p("Pivô e jogo aéreo: segura a bola e faz o time subir", "Hold-up and aerial play: pins the centre-back and brings the team up"),
        traits: { aereo: 0.5, finalizacao: 0.35, finais: 0.15 },
        metrics: [["duelos aéreos", 0.55], ["gols e xg", 0.3], ["passes chave", 0.15]],
      },
      {
        key: "falso9",
        profile: "Móvel",
        name: p("Falso 9", "False nine"),
        blurb: p("Sai da referência, atrai o zagueiro e associa por dentro", "Drops off the line, drags the centre-back out and links inside"),
        traits: { finais: 0.4, dribles: 0.35, finalizacao: 0.25 },
        metrics: [["passes chave", 0.35], ["disputas com bola", 0.35], ["gols e xg", 0.3]],
      },
      {
        key: "profundidade",
        profile: "Móvel",
        name: p("Atacante de profundidade", "Running striker"),
        blurb: p("Joga no ombro do zagueiro: ataca as costas da linha", "Plays on the shoulder: runs in behind the line"),
        traits: { finalizacao: 0.4, dribles: 0.35, finais: 0.15, aereo: 0.1 },
        metrics: [["gols e xg", 0.4], ["1v1 - ofensivo", 0.35], ["disputas com bola", 0.25]],
        phys: { speed: 0.4, rep: 0.2 },
      },
      {
        key: "pressao",
        profile: "Híbrido",
        name: p("Atacante de pressão", "Pressing striker"),
        blurb: p("Primeiro defensor: persegue a saída adversária e força o erro", "First defender: chases the build-up and forces mistakes"),
        traits: { dribles: 0.4, finalizacao: 0.3, finais: 0.15, aereo: 0.15 },
        metrics: [["disputas com bola", 0.5], ["1v1 - ofensivo", 0.3], ["gols e xg", 0.2]],
        phys: { rep: 0.45, vol: 0.25 },
      },
    ],
    schemes: [
      {
        formation: "4-3-3",
        tag: p("Centroavante do trio", "Centre-forward of the three"),
        roles: ["area", "profundidade", "pressao"],
        at: [50, 14],
        why: p("Fixa a área e finaliza o que os pontas criam", "Pins the box and finishes what the wingers create"),
        need: { finalizacao: 0.55, aereo: 0.15, dribles: 0.15, finais: 0.15 },
      },
      {
        formation: "4-2-3-1",
        tag: p("Camisa 9 solitário", "Lone number 9"),
        roles: ["referencia", "area", "pressao"],
        at: [50, 15],
        why: p("Sozinho na frente: segura a bola, ganha no alto e pressiona a saída", "Alone up front: holds the ball up, wins in the air and presses the build-up"),
        need: { aereo: 0.35, finalizacao: 0.35, finais: 0.15, dribles: 0.15 },
      },
      {
        formation: "4-4-2",
        tag: p("Dupla de ataque", "Strike pair"),
        roles: ["area", "profundidade", "falso9"],
        at: [62, 17],
        why: p("Dupla: um fixa a zaga, o outro circula — vive da finalização", "A pair: one pins the defence, the other roams — lives on finishing"),
        need: { finalizacao: 0.55, aereo: 0.2, dribles: 0.15, finais: 0.1 },
      },
      {
        formation: "4-1-2-1-2",
        tag: p("Atacante do losango", "Striker in the diamond"),
        roles: ["falso9", "profundidade"],
        at: [38, 15],
        why: p("Com o 10 atrás, recua, associa e ataca o espaço", "With a 10 behind, drops, links up and attacks space"),
        need: { finais: 0.3, dribles: 0.35, finalizacao: 0.35 },
      },
      {
        formation: "3-5-2",
        tag: p("Dupla de ataque", "Strike pair"),
        roles: ["falso9", "referencia", "area"],
        at: [62, 17],
        why: p("Com alas dando amplitude: dois na frente dividem área e ligação", "With wing-backs providing width the pair split box presence and link-up"),
        need: { finalizacao: 0.45, aereo: 0.2, finais: 0.2, dribles: 0.15 },
      },
      {
        formation: "3-4-2-1",
        tag: p("Referência dos meias", "Reference for the playmakers"),
        roles: ["referencia", "area", "pressao"],
        at: [50, 14],
        why: p("Pivô para os meias atacarem o espaço", "A pivot for the playmakers to run off"),
        need: { aereo: 0.35, finalizacao: 0.35, finais: 0.2, dribles: 0.1 },
      },
      {
        formation: "3-4-3",
        tag: p("Centroavante com dois pontas", "Centre-forward with two wingers"),
        roles: ["area", "profundidade"],
        at: [50, 14],
        why: p("Referência central com dois pontas abertos cruzando", "Central reference with two wide wingers delivering crosses"),
        need: { finalizacao: 0.55, aereo: 0.2, finais: 0.1, dribles: 0.15 },
      },
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
  /** Métricas individuais com percentil médio — usadas para separar funções parecidas. */
  metrics?: { name: string; percentile: number }[];
  physical: { key: string; pct: number | null }[] | null;
  side: "left" | "right" | null;
};

export type FitEvidence = { label: string; pct: number };

export type FitScheme = {
  formation: string;
  /** Função em que o atleta renderia melhor nesse slot. */
  slot: string;
  /** Rótulo do slot no desenho ("Pivô único", "Ala"...). */
  tag: string;
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

const norm = (s: string) =>
  s
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");


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

/** Percentil de uma métrica pelo padrão do nome; prefere a linha de volume ("/90"). */
function metricPct(pattern: string, metrics: { name: string; percentile: number }[]): number | null {
  const hits = metrics.filter((m) => norm(m.name).includes(pattern));
  if (!hits.length) return null;
  const volume = hits.find((m) => m.name.includes("/90"));
  return (volume ?? hits[0]).percentile;
}

/** Pontuação da função: blocos por tom + métricas específicas, ponderadas juntas. */
function roleStatScore(role: RoleDef, byTrait: Map<string, number>, metrics: { name: string; percentile: number }[]): number | null {
  let sum = 0;
  let total = 0;
  for (const [trait, weight] of Object.entries(role.traits) as [Trait, number][]) {
    const pct = byTrait.get(trait);
    if (pct == null) continue;
    sum += pct * weight;
    total += weight;
  }
  for (const [pattern, weight] of role.metrics ?? []) {
    const pct = metricPct(pattern, metrics);
    if (pct == null) continue;
    sum += pct * weight;
    total += weight;
  }
  return total ? sum / total : null;
}

function physLevels(physical: FitInput["physical"]): PhysWeights {
  if (!physical?.length) return {};
  const get = (key: string) => physical.find((m) => m.key === key)?.pct ?? null;
  const avg = (keys: string[]) => {
    const values = keys.map(get).filter((v): v is number => v != null);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const levels: PhysWeights = {};
  const speed = get("top_speed");
  const rep = avg(["sprints_p90", "sprinting_km_p90"]);
  const vol = avg(["kilometers_p90", "running_km_p90"]);
  if (speed != null) levels.speed = speed;
  if (rep != null) levels.rep = rep;
  if (vol != null) levels.vol = vol;
  return levels;
}

function physBonus(weights: PhysWeights | undefined, phys: PhysWeights): number {
  if (!weights) return 0;
  return (Object.entries(weights) as [PhysKey, number][]).reduce(
    (sum, [key, weight]) => (phys[key] != null ? sum + weight * ((phys[key] as number) - 50) * 0.3 : sum),
    0,
  );
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
  const metrics = input.metrics ?? [];
  const phys = physLevels(input.physical);
  const roleByKey = new Map(def.roles.map((role) => [role.key, role]));

  /** Evidências da função: blocos/métricas mais fortes dentre os que ela pede. */
  const evidenceFor = (role: RoleDef, extra?: Weights): FitEvidence[] => {
    const rows: { label: string; score: number; pct: number }[] = [];
    for (const [trait, weight] of Object.entries(extra ?? role.traits) as [Trait, number][]) {
      const pct = byTrait.get(trait);
      if (pct != null) rows.push({ label: titles.get(trait) ?? trait, score: pct * weight, pct });
    }
    if (!extra) {
      for (const [pattern, weight] of role.metrics ?? []) {
        const pct = metricPct(pattern, metrics);
        if (pct != null) {
          const hit = metrics.filter((m) => norm(m.name).includes(pattern));
          const label = (hit.find((m) => m.name.includes("/90")) ?? hit[0]).name;
          rows.push({ label, score: pct * weight, pct });
        }
      }
    }
    return rows
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((row) => ({ label: row.label, pct: Math.round(row.pct) }));
  };

  const roleScores = new Map<string, number>();
  const roles = def.roles
    .map((role) => {
      const share = role.profile ? input.profiles.find((item) => item.label === role.profile)?.share ?? 0 : null;
      const profileScore = share != null && input.profiles.length ? clamp(share * 1.3) : null;
      const stats = roleStatScore(role, byTrait, metrics);
      const parts = [profileScore, stats].filter((v): v is number => v != null);
      let score = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
      score += physBonus(role.phys, phys);
      score = clamp(score);
      roleScores.set(role.key, score);
      return { role, score };
    })
    .sort((a, b) => b.score - a.score);

  const side = input.side;
  const mirrorX = (xy: XY): XY => (def.mirror && side === "left" ? [100 - xy[0], xy[1]] : xy);

  /** Por slot, a função disponível em que o atleta rende melhor. */
  const schemes = def.schemes
    .map((scheme) => {
      let bestKey = scheme.roles[0];
      let bestRoleScore = -1;
      for (const key of scheme.roles) {
        const score = roleScores.get(key) ?? 0;
        if (score > bestRoleScore) {
          bestRoleScore = score;
          bestKey = key;
        }
      }
      const need = traitScore(scheme.need, byTrait);
      let score = need == null ? bestRoleScore : bestRoleScore * 0.55 + need * 0.45;
      score += physBonus(scheme.phys, phys);
      return { scheme, roleKey: bestKey, score: clamp(score) };
    })
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const top = schemes
    .filter(({ scheme, roleKey }) => {
      const key = `${scheme.formation}|${roleKey}`;
      return seen.has(key) ? false : (seen.add(key), true);
    })
    .slice(0, 3);

  const fitSchemes: FitScheme[] = top.map(({ scheme, roleKey, score }) => {
    const dots = FORMATIONS[scheme.formation].map(mirrorX);
    const role = roleByKey.get(roleKey);
    return {
      formation: scheme.formation,
      slot: role ? lc(role.name) : lc(scheme.tag),
      tag: lc(scheme.tag),
      why: lc(scheme.why),
      score: Math.round(score),
      level: level(score, input.lang),
      dots,
      at: snap(dots, mirrorX(scheme.at)),
      evidence: role ? evidenceFor(role) : [],
    };
  });

  const fitRoles: FitRole[] = roles.slice(0, 3).map(({ role, score }, index) => ({
    name: lc(role.name),
    blurb: lc(role.blurb),
    score: Math.round(score),
    level: index === 0 ? (en ? "Main" : "Principal") : en ? "Alternative" : "Alternativa",
    main: index === 0,
    evidence: evidenceFor(role),
  }));

  const bestRole = roles[0].role;
  const formations = fitSchemes.slice(0, 2).map((s) => `**${s.formation}**`);
  const roleName = `**${lc(bestRole.name).toLowerCase()}**`;
  const verdict = en
    ? `By profile and data, the strongest read is a ${roleName} — best placed in ${formations.join(" or ")}.`
    : `Pelo perfil e pelos dados, a leitura mais forte é de ${roleName} — rende melhor em ${formations.join(" ou ")}.`;

  return { schemes: fitSchemes, roles: fitRoles, verdict };
}
