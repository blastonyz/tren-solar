import assert from "node:assert/strict";
import { test } from "node:test";
import { THRESHOLDS, buildAlerts } from "../lib/alerts";
import { fixtureFires } from "../lib/fires";
import { TOWNS } from "../lib/route";
import { simulateTelemetry } from "../lib/telemetry";
import type { FiresResponse, Telemetry, WeatherResponse } from "../lib/types";

const now = new Date("2026-11-22T15:20:00Z");

/** Clima de ejemplo con la lluvia de 6 horas indicada por pueblo; el resto en cero. */
function weatherWith(rainByTown: Record<string, number>, origin: "live" | "fixture" = "live") {
  const weather: WeatherResponse = {
    origin,
    fetchedAt: now.toISOString(),
    attribution: "prueba",
    towns: TOWNS.map((town) => ({
      townId: town.id,
      town: town.name,
      location: town.location,
      rainNext6hMm: rainByTown[town.id] ?? 0,
      rainNext24hMm: rainByTown[town.id] ?? 0,
      rainNext48hMm: rainByTown[town.id] ?? 0,
      maxGustNext6hKmh: 20,
      hours: [],
    })),
  };
  return weather;
}

/** Telemetría de ejemplo con la ocupación indicada por pueblo. */
function telemetryWith(occupancyByTown: Record<string, number>): Telemetry {
  const telemetry = simulateTelemetry(now);
  return {
    ...telemetry,
    towns: telemetry.towns.map((town) => ({
      ...town,
      occupancyPct: occupancyByTown[town.townId] ?? 30,
    })),
  };
}

const noFires: FiresResponse = {
  origin: "live",
  example: false,
  fetchedAt: now.toISOString(),
  hotspots: [],
};

test("con datos de ejemplo sale al menos una alerta por regla, ordenadas por severidad", () => {
  const alerts = buildAlerts({
    now,
    weather: weatherWith({ tilcara: 14, humahuaca: 25, maimara: 10 }),
    fires: fixtureFires(),
    telemetry: telemetryWith({ purmamarca: 93, maimara: 38, volcan: 47 }),
  });

  assert.deepEqual(
    alerts.map((alert) => `${alert.severity} ${alert.kind} ${alert.townId}`),
    [
      "critical fire tilcara",
      "critical flood humahuaca",
      "warning flood tilcara",
      "warning fire uquia",
      "info crowding purmamarca",
    ],
  );
  assert.deepEqual(new Set(alerts.map((alert) => alert.kind)), new Set(["flood", "fire", "crowding"]));
});

test("crecida: avisa por encima de 10 mm y es crítica por encima del doble", () => {
  const severityFor = (mm: number) =>
    buildAlerts({
      now,
      weather: weatherWith({ tilcara: mm }),
      fires: noFires,
      telemetry: telemetryWith({}),
    })[0]?.severity;

  assert.equal(severityFor(THRESHOLDS.floodWarningMm), undefined, "10 mm justos no alcanzan");
  assert.equal(severityFor(10.1), "warning");
  assert.equal(severityFor(20), "warning");
  assert.equal(severityFor(20.1), "critical");
});

test("crecida: el mensaje nombra el pueblo y los milímetros", () => {
  const [alert] = buildAlerts({
    now,
    weather: weatherWith({ tilcara: 14.2 }),
    fires: noFires,
    telemetry: telemetryWith({}),
  });
  assert.equal(
    alert.message,
    "Lluvia fuerte en Tilcara: se esperan 14,2 mm en las próximas 6 horas. Riesgo de crecida.",
  );
  assert.equal(alert.town, "Tilcara");
  assert.equal(alert.source, "open-meteo");
  assert.equal(alert.simulated, false);
  assert.deepEqual(alert.location, TOWNS.find((town) => town.id === "tilcara")?.location);
});

test("fuego: crítica a menos de 3 km, aviso a menos de 10 km, nada más lejos", () => {
  const alerts = buildAlerts({
    now,
    weather: weatherWith({}),
    fires: fixtureFires(),
    telemetry: telemetryWith({}),
  });
  assert.deepEqual(
    alerts.map((alert) => [alert.townId, alert.severity]),
    [
      ["tilcara", "critical"],
      ["uquia", "warning"],
    ],
  );
  assert.match(alerts[0].message, /^Foco de calor detectado por satélite a 2 km de/);
  assert.equal(alerts[0].source, "firms");
});

test("lo que sale de un fixture o de telemetría simulada queda marcado", () => {
  const alerts = buildAlerts({
    now,
    weather: weatherWith({ tilcara: 30 }, "fixture"),
    fires: fixtureFires(),
    telemetry: telemetryWith({ purmamarca: 95 }),
  });
  assert.ok(alerts.length >= 4);
  for (const alert of alerts) assert.equal(alert.simulated, true, alert.id);
});

test("aglomeración: avisa desde el 90% y sugiere el pueblo con lugar más cercano", () => {
  const crowding = (occupancy: Record<string, number>) =>
    buildAlerts({
      now,
      weather: weatherWith({}),
      fires: noFires,
      telemetry: telemetryWith(occupancy),
    });

  assert.equal(crowding({ purmamarca: 89 }).length, 0);

  const [alert] = crowding({ purmamarca: 90, volcan: 47, maimara: 38 });
  assert.equal(alert.severity, "info");
  assert.equal(alert.message, "Purmamarca está al 90% de ocupación. Maimará, a 15 km, está al 38%.");

  // Si ninguno tiene lugar, sugiere el menos ocupado.
  const [full] = crowding({
    volcan: 80,
    purmamarca: 95,
    maimara: 88,
    tilcara: 85,
    uquia: 75,
    humahuaca: 82,
  });
  assert.match(full.message, /Uquía, a .* km, está al 75%\.$/);
});

test("la clave de duplicado es estable dentro de la ventana y cambia si la alerta empeora", () => {
  const flood = (mm: number, at: Date) =>
    buildAlerts({
      now: at,
      weather: weatherWith({ tilcara: mm }),
      fires: noFires,
      telemetry: telemetryWith({}),
    })[0];

  const first = flood(14, now);
  const sameWindow = flood(15, new Date("2026-11-22T17:59:00Z"));
  const nextWindow = flood(14, new Date("2026-11-22T18:01:00Z"));
  const worse = flood(25, now);

  assert.equal(first.dedupeKey, "flood:tilcara:warning:2026-11-22T12");
  assert.equal(first.id, first.dedupeKey);
  assert.equal(sameWindow.dedupeKey, first.dedupeKey);
  assert.notEqual(nextWindow.dedupeKey, first.dedupeKey);
  assert.notEqual(worse.dedupeKey, first.dedupeKey);
});
