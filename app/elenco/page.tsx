import { redirect } from "next/navigation";

export default function LegacyElencoRedirect() {
  redirect("/elencos/serie-a/elenco");
}
