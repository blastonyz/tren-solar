/**
 * Contrato compartido entre el front y la API de Next.
 * La descripción funcional está en docs/SPEC.md, sección 9.
 */

export type Severity = "info" | "warning" | "critical";
export type AlertKind = "flood" | "fire" | "crowding";
export type Category = "excursion" | "lodging" | "product" | "food" | "culture" | "transport";
export type Suitability = "good" | "caution" | "avoid";
export type AlertSource = "open-meteo" | "open-meteo-flood" | "firms" | "telemetry";

/** "live" sale de la fuente real; "fixture" es el archivo guardado en data/fixtures. */
export type DataOrigin = "live" | "fixture";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Town {
  id: string;
  name: string;
  location: LatLng;
  /** Kilómetros sobre la traza desde Volcán hasta el punto más cercano al pueblo. */
  kmFromStart: number;
}

export interface Alert {
  id: string;
  kind: AlertKind;
  severity: Severity;
  townId: string;
  /** Nombre del pueblo, listo para mostrar. */
  town: string;
  message: string;
  location: LatLng;
  issuedAt: string; // ISO 8601
  leadTimeHours?: number; // alerta temprana: horas hasta el evento
  /** Tipo, pueblo y ventana de tiempo: el mismo aviso no se manda dos veces. */
  dedupeKey: string;
  source: AlertSource;
  /** true si sale de telemetría simulada o de un fixture, no de un dato real del momento. */
  simulated?: boolean;
}

export interface Listing {
  id: string;
  category: Category;
  townId: string;
  providerId: string;
  title: string;
  summary: string;
  images: string[];
  priceArs: number;
  priceUnit: string;
  communityShare: number; // 0 a 1
  location: LatLng;
  suitability?: Suitability; // solo excursiones al aire libre
  suitabilityReason?: string;
  extra: Record<string, unknown>;
}

export interface TripItem {
  listingId: string;
  qty: number;
  date?: string; // ISO 8601
}

export interface Order {
  id: string;
  tripId: string;
  totalArs: number;
  status: "pending" | "approved" | "rejected" | "refunded";
  initPoint?: string; // link de pago de Mercado Pago
  simulated?: boolean;
}

/* GET /api/telemetry */

export interface TrainState {
  location: LatLng;
  kmFromStart: number;
  /** Avance sobre la traza, de 0 (Volcán) a 1 (Humahuaca). */
  progress: number;
  direction: "norte" | "sur";
  nextTownId: string;
  passengers: number;
  solarKw: number;
  batteryPct: number;
}

export interface TownOccupancy {
  townId: string;
  town: string;
  occupancyPct: number;
}

export interface Telemetry {
  generatedAt: string; // ISO 8601
  simulated: true;
  train: TrainState;
  towns: TownOccupancy[];
}

/* GET /api/weather */

export interface WeatherHour {
  time: string; // ISO 8601
  precipitationMm: number;
  windKmh: number;
  gustKmh: number;
  temperatureC: number;
}

export interface TownWeather {
  townId: string;
  town: string;
  location: LatLng;
  rainNext6hMm: number;
  rainNext24hMm: number;
  rainNext48hMm: number;
  maxGustNext6hKmh: number;
  hours: WeatherHour[];
}

export interface WeatherResponse {
  origin: DataOrigin;
  fetchedAt: string; // ISO 8601
  attribution: string;
  towns: TownWeather[];
}

/* GET /api/fires */

export interface Hotspot {
  id: string;
  location: LatLng;
  acquiredAt: string; // ISO 8601
  confidence: "low" | "nominal" | "high";
  /** Potencia radiativa del fuego, en MW. */
  frpMw: number;
  satellite: string;
  distanceToRouteKm: number;
  nearestTownId: string;
  nearestTown: string;
  distanceToTownKm: number;
}

export interface FiresResponse {
  origin: DataOrigin;
  /** true si los focos son un ejemplo inventado, no una respuesta real de FIRMS. */
  example: boolean;
  fetchedAt: string; // ISO 8601
  hotspots: Hotspot[];
}
