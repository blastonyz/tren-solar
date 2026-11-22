import { TOWNS } from "./route";
import type {
  Alert,
  FiresResponse,
  Hotspot,
  Severity,
  Telemetry,
  Town,
  WeatherResponse,
} from "./types";

/** Umbrales iniciales de docs/SPEC.md, sección 9.3. Son una propuesta para calibrar. */
export const THRESHOLDS = {
  /** Lluvia acumulada en 6 horas, en mm. */
  floodWarningMm: 10,
  floodCriticalMm: 20,
  /** Distancia del foco a la traza o a un pueblo, en km. */
  fireWarningKm: 10,
  fireCriticalKm: 3,
  /** Ocupación de un pueblo, en porcentaje. */
  crowdingPct: 90,
  /** Un pueblo se sugiere como alternativa si está por debajo de este porcentaje. */
  alternativePct: 70,
} as const;

export interface AlertInputs {
  now: Date;
  telemetry: Telemetry;
  weather: WeatherResponse;
  fires: FiresResponse;
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

const HOUR_MS = 60 * 60 * 1000;

/** Número con coma decimal y a lo sumo un decimal: 14,2. */
const fmt = (value: number) => value.toLocaleString("es-AR", { maximumFractionDigits: 1 });

/** Inicio de la ventana de `hours` horas que contiene a `date`, como "2026-11-22T12". */
const windowStart = (date: Date, hours: number) => {
  const size = hours * HOUR_MS;
  return new Date(Math.floor(date.getTime() / size) * size).toISOString().slice(0, 13);
};

const townById = (id: string): Town | undefined => TOWNS.find((town) => town.id === id);

/**
 * El mismo aviso (tipo, pueblo, severidad y ventana) tiene siempre la misma clave.
 * La severidad forma parte de la clave para que una alerta que empeora se vuelva a avisar.
 */
function withKey(alert: Omit<Alert, "id" | "dedupeKey">, window: string): Alert {
  const dedupeKey = `${alert.kind}:${alert.townId}:${alert.severity}:${window}`;
  return { ...alert, id: dedupeKey, dedupeKey };
}

function floodAlerts({ now, weather }: AlertInputs): Alert[] {
  const alerts: Alert[] = [];
  for (const forecast of weather.towns) {
    if (forecast.rainNext6hMm <= THRESHOLDS.floodWarningMm) continue;
    const severity: Severity =
      forecast.rainNext6hMm > THRESHOLDS.floodCriticalMm ? "critical" : "warning";
    alerts.push(
      withKey(
        {
          kind: "flood",
          severity,
          townId: forecast.townId,
          town: forecast.town,
          message: `Lluvia fuerte en ${forecast.town}: se esperan ${fmt(forecast.rainNext6hMm)} mm en las próximas 6 horas. Riesgo de crecida.`,
          location: forecast.location,
          issuedAt: now.toISOString(),
          source: "open-meteo",
          simulated: weather.origin === "fixture",
        },
        windowStart(now, 6),
      ),
    );
  }
  return alerts;
}

/** Distancia que cuenta para la regla: a la traza o al pueblo, la menor. */
const fireDistanceKm = (hotspot: Hotspot) =>
  Math.min(hotspot.distanceToRouteKm, hotspot.distanceToTownKm);

function fireAlerts({ now, fires }: AlertInputs): Alert[] {
  // Una alerta por pueblo, armada con el foco más cercano.
  const byTown = new Map<string, Hotspot[]>();
  for (const hotspot of fires.hotspots) {
    if (fireDistanceKm(hotspot) >= THRESHOLDS.fireWarningKm) continue;
    byTown.set(hotspot.nearestTownId, [...(byTown.get(hotspot.nearestTownId) ?? []), hotspot]);
  }

  const alerts: Alert[] = [];
  for (const [townId, hotspots] of byTown) {
    const closest = hotspots.reduce((a, b) => (fireDistanceKm(b) < fireDistanceKm(a) ? b : a));
    const distanceKm = fireDistanceKm(closest);
    const severity: Severity = distanceKm < THRESHOLDS.fireCriticalKm ? "critical" : "warning";
    const where =
      closest.distanceToTownKm <= closest.distanceToRouteKm
        ? `a ${fmt(distanceKm)} km de ${closest.nearestTown}`
        : `a ${fmt(distanceKm)} km de las vías, cerca de ${closest.nearestTown}`;
    const others = hotspots.length > 1 ? ` Hay ${hotspots.length} focos en la zona.` : "";

    alerts.push(
      withKey(
        {
          kind: "fire",
          severity,
          townId,
          town: closest.nearestTown,
          message: `Foco de calor detectado por satélite ${where}.${others}`,
          location: closest.location,
          issuedAt: now.toISOString(),
          source: "firms",
          simulated: fires.origin === "fixture",
        },
        // Un aviso por día de detección del foco.
        closest.acquiredAt.slice(0, 10) || windowStart(now, 24).slice(0, 10),
      ),
    );
  }
  return alerts;
}

function crowdingAlerts({ now, telemetry }: AlertInputs): Alert[] {
  const alerts: Alert[] = [];
  for (const crowded of telemetry.towns) {
    if (crowded.occupancyPct < THRESHOLDS.crowdingPct) continue;
    const town = townById(crowded.townId);
    if (!town) continue;

    // Alternativa: el pueblo con lugar más cercano sobre la traza; si ninguno tiene lugar, el menos ocupado.
    const others = telemetry.towns
      .filter((other) => other.townId !== crowded.townId)
      .map((other) => ({ ...other, km: townById(other.townId)?.kmFromStart }))
      .filter((other): other is typeof other & { km: number } => other.km !== undefined)
      .map((other) => ({ ...other, distanceKm: Math.abs(other.km - town.kmFromStart) }));
    const withRoom = others
      .filter((other) => other.occupancyPct < THRESHOLDS.alternativePct)
      .sort((a, b) => a.distanceKm - b.distanceKm);
    const alternative =
      withRoom[0] ?? [...others].sort((a, b) => a.occupancyPct - b.occupancyPct)[0];
    const suggestion = alternative
      ? ` ${alternative.town}, a ${fmt(alternative.distanceKm)} km, está al ${alternative.occupancyPct}%.`
      : "";

    alerts.push(
      withKey(
        {
          kind: "crowding",
          severity: "info",
          townId: town.id,
          town: town.name,
          message: `${town.name} está al ${crowded.occupancyPct}% de ocupación.${suggestion}`,
          location: town.location,
          issuedAt: now.toISOString(),
          source: "telemetry",
          simulated: telemetry.simulated,
        },
        windowStart(now, 1),
      ),
    );
  }
  return alerts;
}

/** Alertas vigentes, ordenadas por severidad y después de sur a norte. */
export function buildAlerts(inputs: AlertInputs): Alert[] {
  const km = (alert: Alert) => townById(alert.townId)?.kmFromStart ?? 0;
  return [...floodAlerts(inputs), ...fireAlerts(inputs), ...crowdingAlerts(inputs)].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      km(a) - km(b) ||
      a.kind.localeCompare(b.kind),
  );
}
