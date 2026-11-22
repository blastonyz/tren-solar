import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { buildFirmsUrl, fixtureFires, loadFires, parseFirmsCsv, toHotspots } from "../lib/fires";

const CSV = [
  "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight",
  "-23.577,-65.374,338.2,0.41,0.37,2026-11-21,1806,N,VIIRS,h,2.0NRT,296.4,6.3,D",
  "-23.300,-65.420,331.7,0.39,0.36,2026-11-21,412,N,VIIRS,n,2.0NRT,294.9,2.1,N",
  "-22.000,-64.000,331.7,0.39,0.36,2026-11-21,1806,N,VIIRS,l,2.0NRT,294.9,2.1,D",
].join("\n");

const respondWith = (text: string, status = 200) =>
  (async () => new Response(text, { status })) as unknown as typeof fetch;

test("la URL lleva el rectángulo de la traza y la clave no queda en la búsqueda", () => {
  const url = new URL(buildFirmsUrl("CLAVE DE PRUEBA"));
  const [, , , , key, source, area, days] = url.pathname.split("/");
  assert.equal(key, "CLAVE%20DE%20PRUEBA");
  assert.equal(source, "VIIRS_SNPP_NRT");
  assert.equal(days, "2");
  const [west, south, east, north] = area.split(",").map(Number);
  assert.ok(west < -65.499 && east > -65.348 && south < -23.917 && north > -23.206);
  assert.ok(east - west < 1 && north - south < 1.3, "el rectángulo no debería ser enorme");
});

test("parseFirmsCsv arma una fila por foco", () => {
  const rows = parseFirmsCsv(CSV);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].latitude, "-23.577");
  assert.equal(rows[1].acq_time, "412");
});

test("parseFirmsCsv rechaza lo que no es el CSV de FIRMS", () => {
  assert.throws(() => parseFirmsCsv("Invalid MAP_KEY."), /CSV esperado/);
  assert.throws(() => parseFirmsCsv(""), /CSV esperado/);
});

test("toHotspots calcula distancias, ordena por cercanía y descarta los lejanos", () => {
  const hotspots = toHotspots(parseFirmsCsv(CSV));
  assert.equal(hotspots.length, 2, "el foco a más de 25 km no se devuelve");

  const [first, second] = hotspots;
  assert.equal(first.nearestTownId, "tilcara");
  assert.ok(Math.abs(first.distanceToTownKm - 2) < 0.2, `a ${first.distanceToTownKm} km`);
  assert.equal(first.confidence, "high");
  assert.equal(first.frpMw, 6.3);
  assert.equal(first.acquiredAt, "2026-11-21T18:06:00.000Z");

  assert.equal(second.nearestTownId, "uquia");
  assert.ok(second.distanceToRouteKm > 6 && second.distanceToRouteKm < 7.5);
  assert.equal(second.acquiredAt, "2026-11-21T04:12:00.000Z", "la hora 412 son las 04:12");
});

test("sin clave devuelve el ejemplo y lo marca como tal", async () => {
  const neverCalled = (async () => {
    throw new Error("no debería llamar a FIRMS sin clave");
  }) as unknown as typeof fetch;
  const { value } = await loadFires({ mapKey: undefined, fetchImpl: neverCalled });
  assert.equal(value.origin, "fixture");
  assert.equal(value.example, fixtureFires().example);
  assert.ok(value.hotspots.length > 0);
});

test("con clave y respuesta válida devuelve los focos reales", async () => {
  const { value } = await loadFires({ mapKey: "clave", fetchImpl: respondWith(CSV) });
  assert.equal(value.origin, "live");
  assert.equal(value.example, false);
  assert.equal(value.hotspots.length, 2);
});

test("con clave inválida o sin internet usa el fixture y no filtra la clave", async () => {
  const warn = mock.method(console, "warn", () => {});
  const invalid = await loadFires({
    mapKey: "clave-secreta",
    fetchImpl: respondWith("Invalid MAP_KEY."),
  });
  assert.equal(invalid.value.origin, "fixture");

  const offline = await loadFires({
    mapKey: "clave-secreta",
    fetchImpl: (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch,
  });
  assert.equal(offline.value.origin, "fixture");

  const logged = warn.mock.calls.map((call) => call.arguments.join(" ")).join(" ");
  assert.ok(!logged.includes("clave-secreta"), "la clave no puede aparecer en los logs");
  warn.mock.restore();
});
