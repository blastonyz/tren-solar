"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LISTINGS, PROVIDERS, type Provider } from "@/data/catalog";
import type { Listing } from "@/lib/types";

interface CatalogApi {
  listings: Listing[];
  providers: Provider[];
  byId: Map<string, Listing>;
  /** Productor elegido para filtrar el catálogo. */
  providerFilter: string | null;
  showProvider: (providerId: string | null) => void;
  /** Agrega una oferta publicada (simulación del bot de WhatsApp). */
  publish: (listing: Listing, provider?: Provider) => void;
}

const CatalogContext = createContext<CatalogApi | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [published, setPublished] = useState<Listing[]>([]);
  const [extraProviders, setExtraProviders] = useState<Provider[]>([]);
  const [providerFilter, setProviderFilter] = useState<string | null>(null);

  const publish = useCallback((listing: Listing, provider?: Provider) => {
    setPublished((prev) => [listing, ...prev]);
    if (provider) setExtraProviders((prev) => (prev.some((p) => p.id === provider.id) ? prev : [provider, ...prev]));
  }, []);

  const showProvider = useCallback((providerId: string | null) => {
    setProviderFilter(providerId);
    if (providerId) document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const value = useMemo<CatalogApi>(() => {
    const listings = [...published, ...LISTINGS];
    return {
      listings,
      providers: [...extraProviders, ...PROVIDERS],
      byId: new Map(listings.map((l) => [l.id, l])),
      providerFilter,
      showProvider,
      publish,
    };
  }, [published, extraProviders, providerFilter, showProvider, publish]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogApi {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog debe usarse dentro de CatalogProvider");
  return ctx;
}
