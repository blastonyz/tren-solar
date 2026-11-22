import type { Alert, Listing, Suitability } from "@/lib/types";

export interface SuitabilityResult {
  level: Suitability;
  reason: string;
}

/**
 * Aptitud de una excursión al aire libre según las alertas vigentes del pueblo.
 * Es una versión del lado del front; cuando GET /api/catalog devuelva `suitability`, se usa ese valor.
 */
export function suitabilityFor(listing: Listing, alerts: Alert[]): SuitabilityResult | null {
  if (listing.category !== "excursion" || !listing.extra.outdoor) return null;
  const mine = alerts.filter((a) => a.townId === listing.townId && a.kind !== "crowding");
  const critical = mine.find((a) => a.severity === "critical");
  if (critical) return { level: "avoid", reason: critical.message };
  const warning = mine.find((a) => a.severity === "warning");
  if (warning) return { level: "caution", reason: warning.message };
  return { level: "good", reason: "Sin alertas de clima ni de fuego en el pueblo." };
}

export const SUITABILITY_LABEL: Record<Suitability, string> = {
  good: "Buen día",
  caution: "Con precaución",
  avoid: "Mejor evitar",
};

export const SUITABILITY_STYLE: Record<Suitability, string> = {
  good: "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
  caution: "border-amber-300/40 bg-amber-400/15 text-amber-100",
  avoid: "border-red-300/40 bg-red-500/20 text-red-100",
};
