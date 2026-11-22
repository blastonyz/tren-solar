import assert from "node:assert/strict";
import { test } from "node:test";
import { distanceToLineKm } from "../lib/geo";
import { ROUTE, ROUTE_LENGTH_KM, TOWNS } from "../lib/route";
import { ONE_WAY_MINUTES, simulateTelemetry } from "../lib/telemetry";

const start = new Date("2026-11-22T15:00:00Z");
const afterMinutes = (minutes: number) => new Date(start.getTime() + minutes * 60_000);

test("la misma hora da siempre la misma telemetría", () => {
  assert.deepEqual(simulateTelemetry(start), simulateTelemetry(new Date(start.getTime())));
});

test("el tren siempre está sobre la traza", () => {
  for (let minute = 0; minute < 2 * ONE_WAY_MINUTES; minute += 0.7) {
    const { train } = simulateTelemetry(afterMinutes(minute));
    assert.ok(train.progress >= 0 && train.progress <= 1);
    assert.ok(train.kmFromStart >= 0 && train.kmFromStart <= ROUTE_LENGTH_KM + 0.1);
    assert.ok(distanceToLineKm(train.location, ROUTE) < 0.01);
  }
});

test("el tren va y vuelve, y la próxima parada queda adelante", () => {
  const seen = new Set<string>();
  for (let minute = 0; minute < 2 * ONE_WAY_MINUTES; minute += 0.25) {
    const { train } = simulateTelemetry(afterMinutes(minute));
    seen.add(train.direction);
    const next = TOWNS.find((town) => town.id === train.nextTownId);
    assert.ok(next, `no existe el pueblo ${train.nextTownId}`);
    if (train.direction === "norte") assert.ok(next.kmFromStart >= train.kmFromStart - 0.1);
    else assert.ok(next.kmFromStart <= train.kmFromStart + 0.1);
  }
  assert.deepEqual([...seen].sort(), ["norte", "sur"]);
});

test("hay ocupación para cada pueblo, entre 5 y 100", () => {
  const { towns, simulated } = simulateTelemetry(start);
  assert.equal(simulated, true);
  assert.deepEqual(
    towns.map((town) => town.townId),
    TOWNS.map((town) => town.id),
  );
  for (const town of towns) {
    assert.ok(Number.isInteger(town.occupancyPct));
    assert.ok(town.occupancyPct >= 5 && town.occupancyPct <= 100);
  }
});
