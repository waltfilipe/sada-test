import { Suspense } from "react";
import { HubSeasonPicker } from "@/components/HubSeasonPicker";

export default function HubPage() {
  return (
    <Suspense fallback={<div className="scout-root home-page hub-page" />}>
      <HubSeasonPicker />
    </Suspense>
  );
}
