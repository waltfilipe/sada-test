import { Suspense } from "react";
import { FamilyQueryRedirect } from "@/components/FamilyQueryRedirect";

export default function ScatterIndexPage() {
  return (
    <Suspense fallback={<div className="scout-root" />}>
      <FamilyQueryRedirect base="scatter" />
    </Suspense>
  );
}
