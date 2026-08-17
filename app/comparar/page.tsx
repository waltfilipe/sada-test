import { CompararClient } from "./CompararClient";
import { getFamilyPlayers } from "@/lib/data.server";

export default function CompararPage() {
  const players = getFamilyPlayers("zagueiros");
  return <CompararClient family="zagueiros" players={players} />;
}
