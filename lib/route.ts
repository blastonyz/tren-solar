import { lineLengthKm, projectOnLine, round1 } from "./geo";
import type { LatLng, Town } from "./types";

/**
 * Traza del tren entre Volcán y Humahuaca, como GeoJSON (coordenadas [lng, lat]).
 * Es APROXIMADA: sigue el valle del río Grande con puntos cargados a mano, con un error
 * de uno o dos kilómetros. Sirve para la demo; hay que reemplazarla por la traza oficial.
 */
export const ROUTE_GEOJSON = {
  type: "Feature",
  properties: { name: "Tren Solar de la Quebrada", approximate: true },
  geometry: {
    type: "LineString",
    coordinates: [
      [-65.465, -23.917], // Volcán
      [-65.468, -23.858], // Tumbaya
      [-65.466, -23.79],
      [-65.468, -23.733], // Cruce a Purmamarca
      [-65.432, -23.658], // Posta de Hornillos
      [-65.408, -23.624], // Maimará
      [-65.394, -23.577], // Tilcara
      [-65.372, -23.497],
      [-65.348, -23.436], // Huacalera
      [-65.352, -23.37],
      [-65.355, -23.304], // Uquía
      [-65.351, -23.206], // Humahuaca
    ],
  },
} as const;

export const ROUTE: LatLng[] = ROUTE_GEOJSON.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));

export const ROUTE_LENGTH_KM = lineLengthKm(ROUTE);

/** Coordenadas aproximadas del centro de cada pueblo. */
const TOWN_LOCATIONS: Array<Omit<Town, "kmFromStart">> = [
  { id: "volcan", name: "Volcán", location: { lat: -23.917, lng: -65.465 } },
  { id: "purmamarca", name: "Purmamarca", location: { lat: -23.746, lng: -65.499 } },
  { id: "maimara", name: "Maimará", location: { lat: -23.624, lng: -65.408 } },
  { id: "tilcara", name: "Tilcara", location: { lat: -23.577, lng: -65.394 } },
  { id: "uquia", name: "Uquía", location: { lat: -23.304, lng: -65.355 } },
  { id: "humahuaca", name: "Humahuaca", location: { lat: -23.206, lng: -65.351 } },
];

/** Estaciones y pueblos, ordenados de sur a norte sobre la traza. */
export const TOWNS: Town[] = TOWN_LOCATIONS.map((town) => ({
  ...town,
  kmFromStart: round1(projectOnLine(town.location, ROUTE).kmAlong),
})).sort((a, b) => a.kmFromStart - b.kmFromStart);

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

/** Busca un pueblo por id o por nombre, sin distinguir mayúsculas ni acentos. */
export function findTown(idOrName: string): Town | undefined {
  const wanted = normalize(idOrName);
  return TOWNS.find((town) => town.id === wanted || normalize(town.name) === wanted);
}
