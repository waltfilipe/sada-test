"use client";

import { useEffect, useState } from "react";
import { fetchFamily } from "@/lib/api";
import { buildSectionGradeLookup, type SectionGradeLookup } from "@/lib/sectionGrades";
import type { PositionFamily } from "@/lib/types";

const cache = new Map<PositionFamily, SectionGradeLookup>();

export function useFamilyGradeLookup(family: PositionFamily | undefined, enabled: boolean) {
  const [lookup, setLookup] = useState<SectionGradeLookup | null>(
    family && cache.has(family) ? cache.get(family)! : null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !family) {
      setLookup(null);
      return;
    }
    if (cache.has(family)) {
      setLookup(cache.get(family)!);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchFamily(family)
      .then((data) => {
        const built = buildSectionGradeLookup(data.players ?? [], family);
        cache.set(family, built);
        if (!cancelled) setLookup(built);
      })
      .catch(() => {
        if (!cancelled) setLookup(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [family, enabled]);

  return { lookup, loading };
}
