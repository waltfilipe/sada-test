import { TimeSombraClient } from "./TimeSombraClient";
import { getSearchRows } from "@/lib/data.server";

export default function TimeSombraPage() {
  const players = getSearchRows();
  return <TimeSombraClient players={players} />;
}
