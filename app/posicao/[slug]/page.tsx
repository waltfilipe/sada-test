import { notFound } from "next/navigation";
import { PosicaoClient } from "./PosicaoClient";
import { getFamilyPlayers } from "@/lib/data.server";
import { familyBySlug } from "@/lib/positions";
import type { PositionFamily } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export default async function PosicaoPage({ params }: Props) {
  const { slug } = await params;
  const family = familyBySlug(slug);
  if (!family) notFound();
  const players = getFamilyPlayers(family.key as PositionFamily);
  return <PosicaoClient family={family.key as PositionFamily} players={players} />;
}
