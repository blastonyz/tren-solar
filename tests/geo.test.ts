import assert from "node:assert/strict";
import { test } from "node:test";
import {
  boundingBox,
  distanceToLineKm,
  haversineKm,
  lineLengthKm,
  pointAtKm,
  projectOnLine,
} from "../lib/geo";
import { ROUTE, ROUTE_LENGTH_KM, TOWNS, findTown } from "../lib/route";

const closeTo = (actual: number, expected: number, tolerance: number) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `esperaba ${expected} ± ${tolerance}, obtuve ${actual}`,
  );

test("un grado de latitud mide unos 111,2 km", () => {
  closeTo(haversineKm({ lat: -23, lng: -65 }, { lat: -24, lng: -65 }), 111.2, 0.1);
});

test("distancia de un punto a un tramo norte-sur", () => {
  const line = [
    { lat: -23.6, lng: -65.4 },
    { lat: -23.4, lng: -65.4 },
  ];
  // 0,1° de longitud a 23,5° S son 111,195 km * cos(23,5°) / 10 = 10,2 km.
  closeTo(distanceToLineKm({ lat: -23.5, lng: -65.3 }, line), 10.2, 0.05);
});

test("un punto más allá del extremo se mide contra el extremo", () => {
  const line = [
    { lat: -23.6, lng: -65.4 },
    { lat: -23.4, lng: -65.4 },
  ];
  const projection = projectOnLine({ lat: -23.3, lng: -65.4 }, line);
  closeTo(projection.distanceKm, 11.12, 0.05);
  closeTo(projection.kmAlong, lineLengthKm(line), 0.001);
  assert.deepEqual(projection.point, line[1]);
});

test("un punto sobre la traza está a distancia cero y conserva sus kilómetros", () => {
  const onRoute = pointAtKm(ROUTE, 30);
  const projection = projectOnLine(onRoute, ROUTE);
  closeTo(projection.distanceKm, 0, 0.01);
  closeTo(projection.kmAlong, 30, 0.05);
});

test("pointAtKm devuelve los extremos fuera de rango", () => {
  assert.deepEqual(pointAtKm(ROUTE, -5), ROUTE[0]);
  assert.deepEqual(pointAtKm(ROUTE, ROUTE_LENGTH_KM + 5), ROUTE[ROUTE.length - 1]);
});

test("la traza mide lo esperable entre Volcán y Humahuaca", () => {
  // En línea recta hay unos 80 km; la traza tiene que ser apenas más larga.
  assert.ok(ROUTE_LENGTH_KM > 80 && ROUTE_LENGTH_KM < 95, `mide ${ROUTE_LENGTH_KM} km`);
});

test("los pueblos quedan ordenados de sur a norte y cerca de la traza", () => {
  assert.deepEqual(
    TOWNS.map((town) => town.id),
    ["volcan", "purmamarca", "maimara", "tilcara", "uquia", "humahuaca"],
  );
  for (const town of TOWNS) {
    const distance = distanceToLineKm(town.location, ROUTE);
    assert.ok(distance < 5, `${town.name} quedó a ${distance} km de la traza`);
  }
});

test("findTown ignora mayúsculas y acentos", () => {
  assert.equal(findTown("Maimará")?.id, "maimara");
  assert.equal(findTown("  UQUIA ")?.id, "uquia");
  assert.equal(findTown("salta"), undefined);
});

test("el rectángulo con margen contiene los puntos", () => {
  const box = boundingBox(ROUTE, 25);
  for (const point of ROUTE) {
    assert.ok(point.lng > box.west && point.lng < box.east);
    assert.ok(point.lat > box.south && point.lat < box.north);
  }
  // 25 km son unos 0,22° de latitud.
  closeTo(Math.min(...ROUTE.map((p) => p.lat)) - box.south, 0.2248, 0.001);
});
