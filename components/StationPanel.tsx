"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, categoriesWithItems, formatArs, listingsFor, providerOf } from "@/data/catalog";
import { TOWNS } from "@/lib/route";
import type { Alert, Category, Listing, Telemetry } from "@/lib/types";
import { SUITABILITY_LABEL, SUITABILITY_STYLE, suitabilityFor } from "./suitability";
import { useTrip } from "./trip";

const EXTRA_LABELS: Record<string, string> = {
  durationMin: "Duración",
  difficulty: "Dificultad",
  elevationM: "Altitud",
  requiresGuide: "Con guía",
  beds: "Camas",
  checkIn: "Ingreso",
  amenities: "Incluye",
  artisan: "Hecho por",
  material: "Material",
  shipping: "Entrega",
  cuisine: "Cocina",
  openHours: "Horario",
  eventDate: "Cuándo",
  language: "Idioma",
  communityLed: "Lo conduce la comunidad",
  departures: "Salidas",
};

function formatExtra(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (key === "durationMin") return `${value} min`;
  if (key === "elevationM") return `${value} m`;
  return String(value);
}

const ALERT_STYLE = {
  info: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  warning: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  critical: "border-red-300/40 bg-red-500/15 text-red-100",
} as const;

interface Props {
  townId: string;
  alerts: Alert[];
  telemetry: Telemetry | null;
  onClose: () => void;
}

export function StationPanel({ townId, alerts, telemetry, onClose }: Props) {
  const town = TOWNS.find((t) => t.id === townId);
  const categories = useMemo(() => categoriesWithItems(townId), [townId]);
  const [chosen, setChosen] = useState<Category | null>(null);
  // Si la categoría elegida no existe en este pueblo, se muestra la primera disponible.
  const category = chosen && categories.includes(chosen) ? chosen : categories[0];
  const [openId, setOpenId] = useState<string | null>(null);

  if (!town) return null;
  const townAlerts = alerts.filter((a) => a.townId === townId);
  const occupancy = telemetry?.towns.find((t) => t.townId === townId)?.occupancyPct;
  const listings = category ? listingsFor(townId, category) : [];

  return (
    <aside className="pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/55 backdrop-blur-md">
      <header className="flex items-start justify-between gap-3 p-4 pb-2">
        <div>
          <p className="text-[10px] tracking-[0.3em] text-amber-100/70 uppercase">Estación</p>
          <h2 className="text-2xl font-semibold">{town.name}</h2>
          {occupancy !== undefined && (
            <p className="mt-0.5 text-xs text-white/60">Ocupación ahora: {occupancy}% (simulada)</p>
          )}
        </div>
        <button onClick={onClose} aria-label="Cerrar panel" className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:border-white/50">
          Cerrar
        </button>
      </header>

      {townAlerts.length > 0 && (
        <ul className="space-y-1.5 px-4 pb-2">
          {townAlerts.slice(0, 3).map((alert) => (
            <li key={alert.id} className={`rounded-lg border px-3 py-1.5 text-xs ${ALERT_STYLE[alert.severity]}`}>
              {alert.message}
              {alert.simulated && <span className="ml-1 opacity-60">(ejemplo)</span>}
            </li>
          ))}
        </ul>
      )}

      <nav className="flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Categorías">
        {CATEGORIES.filter((c) => categories.includes(c.id)).map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setChosen(c.id);
              setOpenId(null);
            }}
            aria-pressed={c.id === category}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${
              c.id === category ? "border-amber-200/80 bg-amber-200/20 text-amber-50" : "border-white/20 text-white/70 hover:border-white/50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </nav>
      {category && <p className="px-4 pb-1 text-[11px] text-white/45">{CATEGORIES.find((c) => c.id === category)?.hint}</p>}

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 pt-2">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            alerts={alerts}
            open={openId === listing.id}
            onToggle={() => setOpenId(openId === listing.id ? null : listing.id)}
          />
        ))}
      </ul>
      <p className="border-t border-white/10 px-4 py-2 text-[10px] text-white/40">
        Catálogo de ejemplo: los lugares son reales, los proveedores y precios son ficticios.
      </p>
    </aside>
  );
}

function ListingCard({ listing, alerts, open, onToggle }: { listing: Listing; alerts: Alert[]; open: boolean; onToggle: () => void }) {
  const trip = useTrip();
  const suitability = suitabilityFor(listing, alerts);
  const provider = providerOf(listing.providerId);
  const added = trip.has(listing.id);
  const extras = Object.entries(listing.extra).filter(([key]) => key in EXTRA_LABELS);

  return (
    <li className="rounded-xl border border-white/10 bg-white/5 p-3">
      <button onClick={onToggle} aria-expanded={open} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm leading-snug font-medium">{listing.title}</h3>
          <span className="shrink-0 text-sm font-semibold tabular-nums">{formatArs(listing.priceArs)}</span>
        </div>
        <p className="text-[11px] text-white/50">por {listing.priceUnit}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-emerald-100">
            {Math.round(listing.communityShare * 100)}% queda en la comunidad
          </span>
          {suitability && (
            <span className={`rounded-full border px-2 py-0.5 ${SUITABILITY_STYLE[suitability.level]}`}>
              {SUITABILITY_LABEL[suitability.level]}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-3 text-xs text-white/75">
          <p>{listing.summary}</p>
          {suitability && <p className="text-white/55">Hoy: {suitability.reason}</p>}
          {provider && (
            <p>
              <span className="text-white/90">{provider.name}</span> · {provider.kind}. {provider.story}
            </p>
          )}
          {extras.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              {extras.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-white/45">{EXTRA_LABELS[key]}</dt>
                  <dd>{formatExtra(key, value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      <button
        onClick={() => trip.add(listing.id)}
        className={`mt-3 w-full rounded-lg px-3 py-1.5 text-xs font-medium transition ${
          added ? "border border-amber-200/60 bg-amber-200/15 text-amber-50" : "bg-amber-300 text-black hover:bg-amber-200"
        }`}
      >
        {added ? "En tu viaje · sumar otro" : "Sumar a mi viaje"}
      </button>
    </li>
  );
}
