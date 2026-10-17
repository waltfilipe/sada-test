import { Suspense } from "react";
import { FamilyQueryRedirect } from "@/components/FamilyQueryRedirect";

export default function CompararIndexPage() {
  return (
    <Suspense fallback={<div className="scout-root" />}>
      <FamilyQueryRedirect base="comparar" />
    </Suspense>
  );
}
