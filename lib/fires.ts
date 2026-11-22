import hotspotsFixture from "../data/fixtures/firms-hotspots.json" with { type: "json" };
import { remember, type Loaded } from "./cache";
import { boundingBox, distanceToLineKm, nearest, round1 } from "./geo";
import { ROUTE, TOWNS } from "./route";
import type { FiresResponse, Hotspot } from "./types";

const ENDPOINT = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
/** Sensor VIIRS del satélite Suomi NPP, casi en tiempo real (375 m por píxel). */
export const FIRMS_SOURCE = "VIIRS_SNPP_NRT";
const DAY_RANGE = 2;
/** Solo se devuelven focos a esta distancia de la traza o de un pueblo. */
export const NEARBY_KM = 25;
const TIMEOUT_MS = 8000;
const LIVE_TTL_MS = 10 * 60 * 1000;
const FALLBACK_TTL_MS = 60 * 1000;

/** Fila del CSV de FIRMS: nombre de columna y valor, todo como texto. */
export type FirmsRow = Record<string, string>;

/** La clave va en la ruta de la URL, así que esta URL nunca se escribe en logs ni en errores. */
export function buildFirmsUrl(mapKey: string): string {
  const box = boundingBox(ROUTE, NEARBY_KM);
  const area = [box.west, box.south, box.east, box.north].map((value) => value.toFixed(3)).join(",");
  return `${ENDPOINT}/${encodeURIComponent(mapKey)}/${FIRMS_SOURCE}/${area}/${DAY_RANGE}`;
}

export function parseFirmsCsv(text: string): FirmsRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const header = (lines[0] ?? "").split(",").map((cell) => cell.trim());
  // Cuando la clave es inválida o se pasó el límite, FIRMS contesta texto plano, no CSV.
  if (!header.includes("latitude") || !header.includes("longitude")) {
    throw new Error("FIRMS no devolvió el CSV esperado.");
  }
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(header.map((name, index) => [name, (cells[index] ?? "").trim()]));
  });
}

function confidenceOf(value: string): Hotspot["confidence"] {
  // VIIRS usa l, n y h; MODIS usa un porcentaje.
  if (value === "h") return "high";
  if (value === "l") return "low";
  const percent = Number(value);
  if (value !== "" && Number.isFinite(percent)) {
    return percent >= 80 ? "high" : percent < 30 ? "low" : "nominal";
  }
  return "nominal";
}

/** Convierte las filas a focos con sus distancias, y deja solo los cercanos, del más próximo al más lejano. */
export function toHotspots(rows: FirmsRow[]): Hotspot[] {
  const found: Array<{ hotspot: Hotspot; closestKm: number }> = [];

  for (const row of rows) {
    const location = { lat: Number(row.latitude), lng: Number(row.longitude) };
    if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) continue;

    const distanceToRouteKm = distanceToLineKm(location, ROUTE);
    const town = nearest(location, TOWNS);
    const closestKm = Math.min(distanceToRouteKm, town.distanceKm);
    if (closestKm > NEARBY_KM) continue;

    const time = (row.acq_time ?? "").padStart(4, "0");
    const acquiredAt = new Date(`${row.acq_date}T${time.slice(0, 2)}:${time.slice(2)}:00Z`);

    found.push({
      closestKm,
      hotspot: {
        id: `${row.acq_date}-${time}-${row.latitude}-${row.longitude}`,
        location,
        acquiredAt: Number.isNaN(acquiredAt.getTime()) ? "" : acquiredAt.toISOString(),
        confidence: confidenceOf(row.confidence ?? ""),
        frpMw: Number(row.frp) || 0,
        satellite: [row.instrument, row.satellite].filter(Boolean).join(" "),
        distanceToRouteKm: round1(distanceToRouteKm),
        nearestTownId: town.item.id,
        nearestTown: town.item.name,
        distanceToTownKm: round1(town.distanceKm),
      },
    });
  }

  return found.sort((a, b) => a.closestKm - b.closestKm).map((entry) => entry.hotspot);
}

/** Focos guardados en data/fixtures. Mientras no haya clave son un ejemplo inventado. */
export function fixtureFires(): FiresResponse {
  return {
    origin: "fixture",
    example: hotspotsFixture.example,
    fetchedAt: hotspotsFixture.savedAt,
    hotspots: toHotspots(hotspotsFixture.rows as FirmsRow[]),
  };
}

export interface LoadFiresOptions {
  fetchImpl?: typeof fetch;
  /** Por defecto, `FIRMS_MAP_KEY` del entorno. */
  mapKey?: string;
}

/** Pide los focos a FIRMS; sin clave, o si la llamada falla, usa el fixture. */
export async function loadFires(options: LoadFiresOptions = {}): Promise<Loaded<FiresResponse>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const mapKey = "mapKey" in options ? options.mapKey : process.env.FIRMS_MAP_KEY;

  if (!mapKey) return { value: fixtureFires(), ttlMs: LIVE_TTL_MS };

  try {
    const response = await fetchImpl(buildFirmsUrl(mapKey), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`FIRMS respondió ${response.status}.`);
    const hotspots = toHotspots(parseFirmsCsv(await response.text()));
    return {
      value: { origin: "live", example: false, fetchedAt: new Date().toISOString(), hotspots },
      ttlMs: LIVE_TTL_MS,
    };
  } catch (error) {
    // Solo el mensaje: la URL lleva la clave.
    console.warn(
      "[fires] FIRMS no respondió; se usa el fixture.",
      error instanceof Error ? error.message : "error desconocido",
    );
    return { value: fixtureFires(), ttlMs: FALLBACK_TTL_MS };
  }
}

/** Focos de calor cercanos, con caché de 10 minutos. */
export function getFires(): Promise<FiresResponse> {
  return remember("fires", () => loadFires());
}
