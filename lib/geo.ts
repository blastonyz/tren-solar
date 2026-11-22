import type { LatLng } from "./types";

const EARTH_RADIUS_KM = 6371.0088;

const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/** Distancia sobre la esfera entre dos puntos, en kilómetros. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface LineProjection {
  /** Distancia del punto a la línea. */
  distanceKm: number;
  /** Kilómetros recorridos sobre la línea hasta el punto más cercano. */
  kmAlong: number;
  /** Punto de la línea más cercano. */
  point: LatLng;
}

/**
 * Punto de la línea más cercano a `point`.
 * Cada tramo se proyecta en un plano local; a la escala de la Quebrada (tramos de pocos km)
 * el error frente a la geodésica es de metros.
 */
export function projectOnLine(point: LatLng, line: LatLng[]): LineProjection {
  if (line.length === 0) throw new Error("La línea no tiene puntos.");
  if (line.length === 1) {
    return { distanceKm: haversineKm(point, line[0]), kmAlong: 0, point: line[0] };
  }

  let best: LineProjection | null = null;
  let kmBefore = 0;

  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const segmentKm = haversineKm(a, b);

    // Plano local con origen en `a`: x hacia el este, y hacia el norte.
    const kmPerDegLng = (Math.PI / 180) * EARTH_RADIUS_KM * Math.cos(toRad((a.lat + b.lat) / 2));
    const kmPerDegLat = (Math.PI / 180) * EARTH_RADIUS_KM;
    const bx = (b.lng - a.lng) * kmPerDegLng;
    const by = (b.lat - a.lat) * kmPerDegLat;
    const px = (point.lng - a.lng) * kmPerDegLng;
    const py = (point.lat - a.lat) * kmPerDegLat;

    const lengthSq = bx * bx + by * by;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / lengthSq));
    const closest: LatLng = {
      lat: a.lat + t * (b.lat - a.lat),
      lng: a.lng + t * (b.lng - a.lng),
    };
    const distanceKm = haversineKm(point, closest);

    if (!best || distanceKm < best.distanceKm) {
      best = { distanceKm, kmAlong: kmBefore + t * segmentKm, point: closest };
    }
    kmBefore += segmentKm;
  }

  return best as LineProjection;
}

/** Distancia de un punto a la traza, en kilómetros. */
export function distanceToLineKm(point: LatLng, line: LatLng[]): number {
  return projectOnLine(point, line).distanceKm;
}

export function lineLengthKm(line: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) total += haversineKm(line[i], line[i + 1]);
  return total;
}

/** Punto de la línea a `km` del inicio. Fuera de rango devuelve el extremo. */
export function pointAtKm(line: LatLng[], km: number): LatLng {
  if (line.length === 0) throw new Error("La línea no tiene puntos.");
  if (km <= 0) return line[0];

  let kmBefore = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const segmentKm = haversineKm(a, b);
    if (segmentKm > 0 && km <= kmBefore + segmentKm) {
      const t = (km - kmBefore) / segmentKm;
      return { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) };
    }
    kmBefore += segmentKm;
  }
  return line[line.length - 1];
}

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Rectángulo que contiene los puntos, agrandado `marginKm` hacia cada lado. */
export function boundingBox(points: LatLng[], marginKm = 0): BoundingBox {
  if (points.length === 0) throw new Error("No hay puntos para el rectángulo.");
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const marginLat = marginKm / ((Math.PI / 180) * EARTH_RADIUS_KM);
  const marginLng = marginLat / Math.cos(toRad((south + north) / 2));
  return {
    west: Math.min(...lngs) - marginLng,
    south: south - marginLat,
    east: Math.max(...lngs) + marginLng,
    north: north + marginLat,
  };
}

/** Elemento más cercano a un punto, con su distancia. */
export function nearest<T extends { location: LatLng }>(
  point: LatLng,
  items: T[],
): { item: T; distanceKm: number } {
  if (items.length === 0) throw new Error("No hay elementos para comparar.");
  let best = { item: items[0], distanceKm: haversineKm(point, items[0].location) };
  for (const item of items.slice(1)) {
    const distanceKm = haversineKm(point, item.location);
    if (distanceKm < best.distanceKm) best = { item, distanceKm };
  }
  return best;
}

export const round1 = (value: number) => Math.round(value * 10) / 10;
