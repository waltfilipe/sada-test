import { ZagueirosV2Client } from "./ZagueirosV2Client";
import { getFamilyPlayers } from "@/lib/data.server";

export default function ZagueirosV2Page() {
  const players = getFamilyPlayers("zagueiros");
  return <ZagueirosV2Client players={players} />;
}
