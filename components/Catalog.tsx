"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, formatArs } from "@/data/catalog";
import { TOWNS } from "@/lib/route";
import type { Alert, Category, Listing } from "@/lib/types";
import { CardArt } from "./CardArt";
import { useCatalog } from "./catalog-context";
import { Conditions } from "./Conditions";
import { SUITABILITY_LABEL, SUITABILITY_STYLE, suitabilityFor } from "./suitability";
import { useTrip } from "./trip";

const KIND_LABEL = { comunidad: "Comunidad", cooperativa: "Cooperativa", emprendedor: "Emprendedor" } as const;

/** Catálogo regional debajo de la escena 3D: buscador, categorías y resultados. Lo demás va plegado. */
export function Catalog({ alerts, townId: stationId, onTownChange }: { alerts: Alert[]; townId: string | null; onTownChange: (id: string | null) => void }) {
  const { listings, providers, providerFilter, showProvider } = useCatalog();
  const [category, setCategory] = useState<Category | "all">("all");
  const townId = stationId ?? "all";
  const setTownId = (id: string) => onTownChange(id === "all" ? null : id);
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const matchesQuery = (l: Listing) => {
    if (!needle) return true;
    const provider = providers.find((p) => p.id === l.providerId)?.name ?? "";
    const town = TOWNS.find((t) => t.id === l.townId)?.name ?? "";
    return `${l.title} ${l.summary} ${provider} ${town}`.toLowerCase().includes(needle);
  };

  const scoped = useMemo(
    () => listings.filter((l) => (townId === "all" || l.townId === townId) && (!providerFilter || l.providerId === providerFilter) && matchesQuery(l)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listings, townId, providerFilter, needle, providers],
  );
  const filtered = useMemo(() => scoped.filter((l) => category === "all" || l.category === category), [scoped, category]);
  const countFor = (id: Category) => scoped.filter((l) => l.category === id).length;
  const activeProvider = providers.find((p) => p.id === providerFilter);
  const filtering = category !== "all" || townId !== "all" || needle !== "" || providerFilter !== null;
  const clear = () => {
    setCategory("all");
    setTownId("all");
    setQuery("");
    showProvider(null);
  };

  return (
    <section id="catalogo" className="relative z-10 bg-neutral-950 px-4 py-14 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <p className="text-[11px] tracking-[0.35em] text-arena/70 uppercase">Ofertas de la Quebrada</p>
          <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Todo lo regional en un solo lugar</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/65">Buscá por nombre, pueblo o productor, o elegí una categoría.</p>
        </header>

        <div>
          <p className="mb-2 text-[11px] tracking-[0.3em] text-white/50 uppercase">Tu recorrido · explorá por estación</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            <StationChip active={townId === "all"} onClick={() => setTownId("all")} name="Todo el recorrido" sub={`${listings.length} ofertas`} />
            {TOWNS.map((t) => (
              <StationChip
                key={t.id}
                active={townId === t.id}
                onClick={() => setTownId(t.id)}
                name={t.name}
                sub={`${listings.filter((l) => l.townId === t.id).length} ofertas`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar: quinoa, posada, Tilcara…"
              aria-label="Buscar ofertas"
              className="w-full rounded-full border border-white/20 bg-black/40 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-solar/70 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={category === "all"} onClick={() => setCategory("all")}>Todas · {scoped.length}</FilterChip>
            {CATEGORIES.map((c) => (
              <FilterChip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                {c.label} · {countFor(c.id)}
              </FilterChip>
            ))}
            {filtering && (
              <button onClick={clear} className="ml-1 text-xs text-solar underline-offset-2 hover:underline">Limpiar</button>
            )}
          </div>
          {activeProvider && (
            <p className="text-xs text-white/70">
              Solo lo de <span className="text-white">{activeProvider.name}</span>
            </p>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-white/10 p-6 text-sm text-white/60">No hay ofertas con esos filtros.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((listing) => (
              <OfferCard key={listing.id} listing={listing} alerts={alerts} />
            ))}
          </ul>
        )}

        <details className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <summary className="cursor-pointer text-sm font-medium text-white/85">Condiciones del día por satélite</summary>
          <div className="mt-4">
            <Conditions />
          </div>
        </details>

        <details className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <summary className="cursor-pointer text-sm font-medium text-white/85">Productores y comunidades</summary>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers
              .map((provider) => ({ provider, own: listings.filter((l) => l.providerId === provider.id) }))
              .filter(({ own }) => own.length > 0)
              .map(({ provider, own }) => (
                <li key={provider.id}>
                  <button
                    onClick={() => showProvider(providerFilter === provider.id ? null : provider.id)}
                    aria-pressed={providerFilter === provider.id}
                    className={`h-full w-full rounded-2xl border p-4 text-left transition ${
                      providerFilter === provider.id ? "border-solar/70 bg-solar/10" : "border-white/10 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium">{provider.name}</h4>
                      <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">{KIND_LABEL[provider.kind]}</span>
                    </div>
                    <p className="mt-1 text-xs text-white/55">{provider.story}</p>
                    <p className="mt-2 text-[11px] text-arena/80">{own.length} {own.length === 1 ? "oferta" : "ofertas"}</p>
                  </button>
                </li>
              ))}
          </ul>
        </details>

        <p className="text-[11px] text-white/40">Catálogo de ejemplo: los lugares son reales, los proveedores y precios son ficticios. Los oferentes pueden sumar lo suyo por WhatsApp.</p>
      </div>
    </section>
  );
}

function OfferCard({ listing, alerts }: { listing: Listing; alerts: Alert[] }) {
  const trip = useTrip();
  const { providers, showProvider } = useCatalog();
  const provider = providers.find((p) => p.id === listing.providerId);
  const town = TOWNS.find((t) => t.id === listing.townId);
  const suitability = suitabilityFor(listing, alerts);
  const category = CATEGORIES.find((c) => c.id === listing.category);
  const viaWhatsApp = listing.extra.source === "whatsapp";
  const added = trip.has(listing.id);

  return (
    <li className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition duration-300 hover:-translate-y-0.5 hover:border-solar/40 hover:shadow-lg hover:shadow-black/40">
      <div className="relative h-36 overflow-hidden">
        <CardArt id={listing.id} category={listing.category} image={listing.images[0]} />
        <span className="absolute bottom-2.5 left-3 rounded-full bg-black/55 px-2.5 py-0.5 text-[11px] text-white/90 backdrop-blur">{category?.label} · {town?.name}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm leading-snug font-medium">{listing.title}</h4>
          <span className="shrink-0 text-sm font-semibold tabular-nums">{formatArs(listing.priceArs)}</span>
        </div>
        <p className="text-[11px] text-white/45">por {listing.priceUnit}</p>
        <p className="mt-2 text-xs text-white/65">{listing.summary}</p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-full bg-impact/15 px-2 py-0.5 text-impact">{Math.round(listing.communityShare * 100)}% queda en la comunidad</span>
          {suitability && <span className={`rounded-full border px-2 py-0.5 ${SUITABILITY_STYLE[suitability.level]}`}>{SUITABILITY_LABEL[suitability.level]}</span>}
          {viaWhatsApp && <span className="rounded-full border border-impact/30 px-2 py-0.5 text-impact">Publicado por WhatsApp</span>}
        </div>
        {provider && (
          <button onClick={() => showProvider(provider.id)} className="mt-3 text-left text-xs text-arena/80 underline-offset-2 hover:underline">
            {provider.name}
          </button>
        )}
        <button
          onClick={() => trip.add(listing.id)}
          className={`mt-auto w-full rounded-lg px-3 py-1.5 text-xs font-medium transition ${added ? "border border-solar/60 bg-solar/15 text-amber-50" : "bg-solar text-black hover:bg-solar"}`}
          style={{ marginTop: "1rem" }}
        >
          {added ? "En tu viaje · sumar otro" : "Sumar a mi viaje"}
        </button>
      </div>
    </li>
  );
}

function StationChip({ active, onClick, name, sub }: { active: boolean; onClick: () => void; name: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-xl border px-4 py-2 text-left transition ${active ? "border-solar/80 bg-solar/15" : "border-white/15 hover:border-white/40"}`}
    >
      <span className="block text-sm font-medium">{name}</span>
      <span className="text-[11px] text-white/55">{sub}</span>
    </button>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-xs transition ${active ? "border-solar/80 bg-solar/20 text-amber-50" : "border-white/20 text-white/70 hover:border-white/50"}`}
    >
      {children}
    </button>
  );
}
