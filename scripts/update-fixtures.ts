/**
 * Guarda una respuesta real de cada fuente en data/fixtures/, el plan B si falla internet.
 * Uso: npm run fixtures
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FIRMS_SOURCE, buildFirmsUrl, parseFirmsCsv } from "../lib/fires";
import { buildForecastUrl, parseForecast } from "../lib/weather";

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), "../data/fixtures");

async function save(name: string, data: unknown) {
  await mkdir(fixturesDir, { recursive: true });
  await writeFile(resolve(fixturesDir, name), `${JSON.stringify(data, null, 2)}\n`);
}

async function saveWeather() {
  const response = await fetch(buildForecastUrl(), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Open-Meteo respondió ${response.status}.`);
  const body: unknown = await response.json();
  const towns = parseForecast(body); // valida la forma antes de guardar
  await save("open-meteo-forecast.json", { savedAt: new Date().toISOString(), response: body });
  console.log(`Clima: ${towns.length} pueblos, ${towns[0].hours.length} horas cada uno.`);
}

async function saveFires() {
  const mapKey = process.env.FIRMS_MAP_KEY;
  if (!mapKey) {
    console.log("Focos: falta FIRMS_MAP_KEY, se deja el archivo de ejemplo.");
    return;
  }
  const response = await fetch(buildFirmsUrl(mapKey), { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`FIRMS respondió ${response.status}.`);
  const rows = parseFirmsCsv(await response.text());
  await save("firms-hotspots.json", {
    example: false,
    note: "Respuesta real de NASA FIRMS, guardada como filas del CSV.",
    savedAt: new Date().toISOString(),
    source: FIRMS_SOURCE,
    rows,
  });
  console.log(`Focos: ${rows.length} filas.`);
}

let failed = false;
for (const [name, task] of [
  ["clima", saveWeather],
  ["focos", saveFires],
] as const) {
  try {
    await task();
  } catch (error) {
    failed = true;
    // Solo el mensaje: la URL de FIRMS lleva la clave.
    console.error(`No se pudo guardar ${name}:`, error instanceof Error ? error.message : error);
  }
}
process.exitCode = failed ? 1 : 0;
