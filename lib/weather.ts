import forecastFixture from "../data/fixtures/open-meteo-forecast.json" with { type: "json" };
import { remember, type Loaded } from "./cache";
import { round1 } from "./geo";
import { TOWNS } from "./route";
import type { Town, TownWeather, WeatherHour, WeatherResponse } from "./types";

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const HOURLY = ["precipitation", "wind_speed_10m", "wind_gusts_10m", "temperature_2m"] as const;
const FORECAST_HOURS = 48;
const TIMEOUT_MS = 5000;
const LIVE_TTL_MS = 10 * 60 * 1000;
/** Un respaldo vence rápido para volver a intentar con la fuente real. */
const FALLBACK_TTL_MS = 60 * 1000;

/** Open-Meteo pide atribución (CC BY 4.0). */
export const ATTRIBUTION = "Weather data by Open-Meteo.com (CC BY 4.0)";

/** Una sola llamada trae todos los pueblos, en el mismo orden en que se piden. */
export function buildForecastUrl(towns: Town[] = TOWNS): string {
  const params = new URLSearchParams({
    latitude: towns.map((town) => town.location.lat).join(","),
    longitude: towns.map((town) => town.location.lng).join(","),
    hourly: HOURLY.join(","),
    forecast_hours: String(FORECAST_HOURS),
    timeformat: "unixtime",
    timezone: "GMT",
  });
  return `${ENDPOINT}?${params}`;
}

/** Convierte la respuesta de Open-Meteo al contrato. Falla si no tiene la forma esperada. */
export function parseForecast(raw: unknown, towns: Town[] = TOWNS): TownWeather[] {
  const locations = Array.isArray(raw) ? raw : [raw];
  if (locations.length !== towns.length) {
    throw new Error(
      `Open-Meteo devolvió ${locations.length} ubicaciones y se esperaban ${towns.length}.`,
    );
  }

  return towns.map((town, index) => {
    const hourly = (locations[index] as { hourly?: Record<string, unknown> } | null)?.hourly;
    const time = hourly?.time;
    if (!Array.isArray(time) || time.length === 0) {
      throw new Error(`Open-Meteo no devolvió horas para ${town.name}.`);
    }

    const column = (name: (typeof HOURLY)[number]): Array<number | null> => {
      const values = hourly?.[name];
      if (!Array.isArray(values) || values.length !== time.length) {
        throw new Error(`Open-Meteo no devolvió "${name}" para ${town.name}.`);
      }
      return values;
    };
    const precipitation = column("precipitation");
    const wind = column("wind_speed_10m");
    const gusts = column("wind_gusts_10m");
    const temperature = column("temperature_2m");

    const hours: WeatherHour[] = time.map((seconds, hour) => ({
      time: new Date(Number(seconds) * 1000).toISOString(),
      precipitationMm: precipitation[hour] ?? 0,
      windKmh: wind[hour] ?? 0,
      gustKmh: gusts[hour] ?? 0,
      temperatureC: temperature[hour] ?? 0,
    }));

    // La primera hora de la respuesta es la hora en curso.
    const rain = (count: number) =>
      round1(hours.slice(0, count).reduce((total, hour) => total + hour.precipitationMm, 0));

    return {
      townId: town.id,
      town: town.name,
      location: town.location,
      rainNext6hMm: rain(6),
      rainNext24hMm: rain(24),
      rainNext48hMm: rain(48),
      maxGustNext6hKmh: round1(Math.max(...hours.slice(0, 6).map((hour) => hour.gustKmh))),
      hours,
    };
  });
}

/** Última respuesta real guardada. Sus horas quedaron fijas en el momento en que se guardó. */
export function fixtureWeather(): WeatherResponse {
  return {
    origin: "fixture",
    fetchedAt: forecastFixture.savedAt,
    attribution: ATTRIBUTION,
    towns: parseForecast(forecastFixture.response),
  };
}

/** Pide el pronóstico a Open-Meteo; si falla por cualquier motivo, usa el fixture. */
export async function loadWeather(
  fetchImpl: typeof fetch = fetch,
): Promise<Loaded<WeatherResponse>> {
  try {
    const response = await fetchImpl(buildForecastUrl(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Open-Meteo respondió ${response.status}.`);
    const towns = parseForecast(await response.json());
    return {
      value: {
        origin: "live",
        fetchedAt: new Date().toISOString(),
        attribution: ATTRIBUTION,
        towns,
      },
      ttlMs: LIVE_TTL_MS,
    };
  } catch (error) {
    console.warn(
      "[weather] Open-Meteo no respondió; se usa el fixture.",
      error instanceof Error ? error.message : error,
    );
    return { value: fixtureWeather(), ttlMs: FALLBACK_TTL_MS };
  }
}

/** Pronóstico de todos los pueblos, con caché de 10 minutos. */
export function getWeather(): Promise<WeatherResponse> {
  return remember("weather", () => loadWeather());
}
