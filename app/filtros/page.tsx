import { FiltrosClient } from "./FiltrosClient";
import { getMeta, getPlayers } from "@/lib/data.server";

export default function FiltrosPage() {
  const meta = getMeta();
  const players = getPlayers();
  return <FiltrosClient meta={meta} initialPlayers={players} />;
}
