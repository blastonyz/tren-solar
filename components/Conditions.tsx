"use client";

import { THRESHOLDS } from "@/lib/alerts";
import { TOWNS } from "@/lib/route";
import type { FiresResponse, Suitability, WeatherResponse } from "@/lib/types";
import { SUITABILITY_LABEL, SUITABILITY_STYLE } from "./suitability";
import { useFires, useWeather } from "./live";

const GUST_CAUTION_KMH = 60;

interface TownConditions {
  townId: string;
  name: string;
  rain6h: number | null;
  rain24h: number | null;
  gust: number | null;
  fireKm: number | null;
  level: Suitability | null;
  reasons: string[];
}

function evaluate(weather: WeatherResponse | null, fires: FiresResponse | null): TownConditions[] {
  return TOWNS.map((town) => {
    const w = weather?.towns.find((t) => t.townId === town.id);
    const near = fires?.hotspots.filter((h) => h.nearestTownId === town.id) ?? [];
    const fireKm = near.length ? Math.min(...near.map((h) => h.distanceToTownKm)) : null;
    const reasons: string[] = [];
    let level: Suitability | null = w || fires ? "good" : null;
    const raise = (to: Suitability, reason: string) => {
      reasons.push(reason);
      if (level === "good" || (level === "caution" && to === "avoid")) level = to;
    };
    if (w) {
      if (w.rainNext6hMm >= THRESHOLDS.floodCriticalMm) raise("avoid", `lluvia fuerte (${w.rainNext6hMm} mm en 6 h)`);
      else if (w.rainNext6hMm >= THRESHOLDS.floodWarningMm) raise("caution", `lluvia moderada (${w.rainNext6hMm} mm en 6 h)`);
      if (w.maxGustNext6hKmh >= GUST_CAUTION_KMH) raise("caution", `ráfagas de ${Math.round(w.maxGustNext6hKmh)} km/h`);
    }
    if (fireKm !== null) {
      if (fireKm < THRESHOLDS.fireCriticalKm) raise("avoid", `foco de calor a ${fireKm.toFixed(1)} km`);
      else if (fireKm < THRESHOLDS.fireWarningKm) raise("caution", `foco de calor a ${fireKm.toFixed(1)} km`);
    }
    return {
      townId: town.id,
      name: town.name,
      rain6h: w?.rainNext6hMm ?? null,
      rain24h: w?.rainNext24hMm ?? null,
      gust: w?.maxGustNext6hKmh ?? null,
      fireKm,
      level,
      reasons,
    };
  });
}

/** Condiciones del día por pueblo, con las señales de clima y satélite y de dónde sale cada una. */
export function Conditions() {
  const weather = useWeather();
  const fires = useFires();
  const rows = evaluate(weather, fires);
  const weatherSource = weather ? (weather.origin === "live" ? "pronóstico en vivo" : "pronóstico guardado") : "sin datos de clima";
  const fireSource = fires ? (fires.example ? "focos de ejemplo" : fires.origin === "live" ? "focos satelitales en vivo" : "focos guardados") : "sin datos de satélite";

  return (
    <div>
      <ul className="flex gap-3 overflow-x-auto pb-2 [scrollbar-color:rgba(255,255,255,0.25)_transparent] [scrollbar-width:thin]">
        {rows.map((row) => (
          <li key={row.townId} className="w-56 shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">{row.name}</h3>
              {row.level && (
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${SUITABILITY_STYLE[row.level]}`}>{SUITABILITY_LABEL[row.level]}</span>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Metric label="Lluvia 6 h" value={row.rain6h === null ? "–" : `${row.rain6h} mm`} />
              <Metric label="Ráfagas" value={row.gust === null ? "–" : `${Math.round(row.gust)} km/h`} />
              <Metric label="Foco" value={row.fireKm === null ? "ninguno" : `${row.fireKm.toFixed(1)} km`} />
            </dl>
            <p className="mt-3 text-xs text-white/60">
              {row.level === "good" && "Sin lluvia fuerte, viento moderado y sin focos de calor cerca."}
              {row.level && row.level !== "good" && `Atención: ${row.reasons.join(", ")}.`}
              {!row.level && "Todavía no hay datos para este pueblo."}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-white/45">
        Fuentes: Open-Meteo ({weatherSource}) y NASA FIRMS ({fireSource}). Son señales de pronóstico y satélite: orientan, no garantizan el clima.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/25 px-1 py-1.5">
      <dt className="text-[9px] tracking-wider text-white/45 uppercase">{label}</dt>
      <dd className="mt-0.5 text-xs font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
