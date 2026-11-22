import { pointAtKm, round1 } from "./geo";
import { ROUTE, ROUTE_LENGTH_KM, TOWNS } from "./route";
import type { Telemetry } from "./types";

/**
 * Telemetría SIMULADA: no hay hardware en el tren. Todo sale de la hora, así que dos
 * llamadas en el mismo instante devuelven lo mismo y el front puede interpolar.
 */

/** Minutos reales que tarda el tren simulado en ir de una punta a la otra. */
export const ONE_WAY_MINUTES = 10;

/** Ocupación base por pueblo, en porcentaje. Los valores coinciden con el panel del front. */
const OCCUPANCY_BASE: Record<string, number> = {
  volcan: 47,
  purmamarca: 92,
  maimara: 38,
  tilcara: 85,
  uquia: 21,
  humahuaca: 64,
};

const wave = (seconds: number, periodSeconds: number, phase: number, amplitude: number) =>
  Math.sin((2 * Math.PI * seconds) / periodSeconds + phase) * amplitude;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function simulateTelemetry(now: Date): Telemetry {
  const seconds = now.getTime() / 1000;

  // Ida y vuelta continua: el avance sube de 0 a 1 y vuelve a bajar.
  const legSeconds = ONE_WAY_MINUTES * 60;
  const cycle = (seconds % (2 * legSeconds)) / legSeconds;
  const northbound = cycle < 1;
  const progress = northbound ? cycle : 2 - cycle;
  const kmFromStart = progress * ROUTE_LENGTH_KM;

  const ahead = northbound
    ? TOWNS.find((town) => town.kmFromStart > kmFromStart)
    : [...TOWNS].reverse().find((town) => town.kmFromStart < kmFromStart);
  const nextTown = ahead ?? (northbound ? TOWNS[TOWNS.length - 1] : TOWNS[0]);

  return {
    generatedAt: now.toISOString(),
    simulated: true,
    train: {
      location: pointAtKm(ROUTE, kmFromStart),
      kmFromStart: round1(kmFromStart),
      progress: Math.round(progress * 1000) / 1000,
      direction: northbound ? "norte" : "sur",
      nextTownId: nextTown.id,
      passengers: Math.round(118 + wave(seconds, 28, 2, 9)),
      solarKw: round1(38 + wave(seconds, 28, 0, 6)),
      batteryPct: Math.round(78 + wave(seconds, 28, 1, 4)),
    },
    // La ocupación cambia despacio (ciclo de 10 minutos) para que las alertas no parpadeen.
    towns: TOWNS.map((town, index) => ({
      townId: town.id,
      town: town.name,
      occupancyPct: Math.round(
        clamp((OCCUPANCY_BASE[town.id] ?? 50) + wave(seconds, 600, index, 4), 5, 100),
      ),
    })),
  };
}
