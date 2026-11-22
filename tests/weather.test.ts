import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { TOWNS } from "../lib/route";
import { buildForecastUrl, fixtureWeather, loadWeather, parseForecast } from "../lib/weather";

/** Respuesta con la forma de Open-Meteo: una ubicación por pueblo y 48 horas. */
const fakeForecast = (rainPerHour: number[]) =>
  TOWNS.map((_, index) => ({
    hourly: {
      time: Array.from({ length: 48 }, (_, hour) => 1795359600 + hour * 3600),
      precipitation: Array(48).fill(rainPerHour[index] ?? 0),
      wind_speed_10m: Array(48).fill(12),
      wind_gusts_10m: Array.from({ length: 48 }, (_, hour) => 20 + hour),
      temperature_2m: Array(48).fill(18),
    },
  }));

const respondWith = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

test("la URL pide todos los pueblos en una sola llamada", () => {
  const url = new URL(buildForecastUrl());
  assert.equal(url.origin + url.pathname, "https://api.open-meteo.com/v1/forecast");
  assert.equal(url.searchParams.get("latitude")?.split(",").length, TOWNS.length);
  assert.equal(url.searchParams.get("longitude")?.split(",").length, TOWNS.length);
  assert.equal(url.searchParams.get("forecast_hours"), "48");
});

test("parseForecast suma la lluvia de 6, 24 y 48 horas", () => {
  const towns = parseForecast(fakeForecast([0, 0.5, 2]));
  assert.equal(towns.length, TOWNS.length);
  assert.equal(towns[1].rainNext6hMm, 3);
  assert.equal(towns[1].rainNext24hMm, 12);
  assert.equal(towns[1].rainNext48hMm, 24);
  assert.equal(towns[2].rainNext6hMm, 12);
  assert.equal(towns[0].maxGustNext6hKmh, 25);
  assert.equal(towns[0].hours.length, 48);
  assert.equal(towns[0].hours[0].time, new Date(1795359600 * 1000).toISOString());
  assert.equal(towns[0].townId, TOWNS[0].id);
});

test("parseForecast rechaza una respuesta con otra forma", () => {
  assert.throws(() => parseForecast({ error: true, reason: "x" }), /ubicaciones/);
  const missing = fakeForecast([]);
  delete (missing[0].hourly as Partial<(typeof missing)[0]["hourly"]>).precipitation;
  assert.throws(() => parseForecast(missing), /precipitation/);
});

test("el fixture guardado es una respuesta válida para todos los pueblos", () => {
  const weather = fixtureWeather();
  assert.equal(weather.origin, "fixture");
  assert.ok(!Number.isNaN(Date.parse(weather.fetchedAt)));
  assert.deepEqual(
    weather.towns.map((town) => town.townId),
    TOWNS.map((town) => town.id),
  );
  for (const town of weather.towns) assert.equal(town.hours.length, 48);
});

test("con la fuente disponible devuelve datos reales", async () => {
  const { value } = await loadWeather(respondWith(fakeForecast([1])));
  assert.equal(value.origin, "live");
  assert.equal(value.towns[0].rainNext6hMm, 6);
});

test("sin internet responde con el fixture", async () => {
  const warn = mock.method(console, "warn", () => {});
  const offline = (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
  const { value, ttlMs } = await loadWeather(offline);
  assert.equal(value.origin, "fixture");
  assert.equal(value.towns.length, TOWNS.length);
  assert.ok(ttlMs <= 60_000, "el respaldo tiene que vencer rápido");
  assert.equal(warn.mock.callCount(), 1);
  warn.mock.restore();
});

test("si la fuente responde con error también usa el fixture", async () => {
  const warn = mock.method(console, "warn", () => {});
  const { value } = await loadWeather(respondWith({ error: true }, 500));
  assert.equal(value.origin, "fixture");
  warn.mock.restore();
});
