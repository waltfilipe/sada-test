import { FiltrosClient } from "./FiltrosClient";
import { getMeta, getSearchRows } from "@/lib/data.server";

export default function FiltrosPage() {
  const meta = getMeta();
  const players = getSearchRows();
  return <FiltrosClient meta={meta} players={players} />;
}
