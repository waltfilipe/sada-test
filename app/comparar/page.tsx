import { CompararClient } from "./CompararClient";
import { getFamilyPlayers } from "@/lib/data.server";
import { familyBySlug } from "@/lib/positions";
import type { PositionFamily } from "@/lib/types";

type Props = {
  searchParams: Promise<{ posicao?: string; a?: string; b?: string }>;
};

export default async function CompararPage({ searchParams }: Props) {
  const { posicao, a, b } = await searchParams;
  const family = familyBySlug(posicao ?? "zagueiros");
  const players = getFamilyPlayers(family.key as PositionFamily);

  return (
    <CompararClient
      key={family.key}
      family={family.key as PositionFamily}
      players={players}
      initialA={a}
      initialB={b}
    />
  );
}
