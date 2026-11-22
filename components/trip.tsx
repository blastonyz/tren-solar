"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useCatalog } from "./catalog-context";
import type { TripItem } from "@/lib/types";

interface TripApi {
  items: TripItem[];
  count: number;
  totalArs: number;
  /** Plata del viaje que queda en las comunidades, según el porcentaje de cada ítem. */
  communityArs: number;
  has: (listingId: string) => boolean;
  add: (listingId: string) => void;
  setQty: (listingId: string, qty: number) => void;
  remove: (listingId: string) => void;
  clear: () => void;
}

const TripContext = createContext<TripApi | null>(null);

export function TripProvider({ children }: { children: ReactNode }) {
  const { byId } = useCatalog();
  const [items, setItems] = useState<TripItem[]>([]);

  const add = useCallback((listingId: string) => {
    setItems((prev) =>
      prev.some((i) => i.listingId === listingId)
        ? prev.map((i) => (i.listingId === listingId ? { ...i, qty: i.qty + 1 } : i))
        : [...prev, { listingId, qty: 1 }],
    );
  }, []);
  const setQty = useCallback((listingId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.listingId !== listingId)
        : prev.map((i) => (i.listingId === listingId ? { ...i, qty } : i)),
    );
  }, []);
  const remove = useCallback((listingId: string) => setItems((prev) => prev.filter((i) => i.listingId !== listingId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<TripApi>(() => {
    let totalArs = 0;
    let communityArs = 0;
    for (const item of items) {
      const listing = byId.get(item.listingId);
      if (!listing) continue;
      const subtotal = listing.priceArs * item.qty;
      totalArs += subtotal;
      communityArs += subtotal * listing.communityShare;
    }
    return {
      items,
      count: items.reduce((n, i) => n + i.qty, 0),
      totalArs,
      communityArs,
      has: (id) => items.some((i) => i.listingId === id),
      add,
      setQty,
      remove,
      clear,
    };
  }, [items, byId, add, setQty, remove, clear]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripApi {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip debe usarse dentro de TripProvider");
  return ctx;
}
