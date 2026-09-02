import { TimeSombraClient } from "./TimeSombraClient";
import { getPlayers } from "@/lib/data.server";

export default function TimeSombraPage() {
  const players = getPlayers();
  return <TimeSombraClient players={players} />;
}
