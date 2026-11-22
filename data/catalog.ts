import { TOWNS } from "@/lib/route";
import type { Category, LatLng, Listing } from "@/lib/types";

/**
 * Catálogo de ejemplo para la demo. Todo es ficticio: los lugares existen, pero los proveedores,
 * precios y porcentajes para la comunidad son inventados. Más adelante lo reemplaza GET /api/catalog.
 */

export interface Provider {
  id: string;
  name: string;
  kind: "comunidad" | "cooperativa" | "emprendedor";
  story: string;
}

export const CATEGORIES: Array<{ id: Category; label: string; hint: string }> = [
  { id: "excursion", label: "Excursiones", hint: "Caminatas y paseos con guía local" },
  { id: "lodging", label: "Hospedajes", hint: "Posadas, hostels y casas de familia" },
  { id: "product", label: "Productos", hint: "Artesanías y alimentos regionales" },
  { id: "food", label: "Gastronomía", hint: "Cocina andina de productores locales" },
  { id: "culture", label: "Cultura", hint: "Comunidades, rituales y museos" },
  { id: "transport", label: "Transporte", hint: "Tren Solar y traslados" },
];

export const PROVIDERS: Provider[] = [
  { id: "tren-solar", name: "Tren Solar de la Quebrada", kind: "cooperativa", story: "Servicio ferroviario alimentado con paneles solares que une los pueblos de la Quebrada." },
  { id: "coop-volcan", name: "Cooperativa Valle Verde", kind: "cooperativa", story: "Productores de Volcán y Tumbaya que venden quinoa y comida regional sin intermediarios." },
  { id: "guias-volcan", name: "Guías de Volcán", kind: "comunidad", story: "Vecinos de Volcán que guían por los cerros y quebradas que conocen desde chicos." },
  { id: "flia-algarrobos", name: "Familia Los Algarrobos", kind: "comunidad", story: "Tres generaciones recibiendo viajeros en su casa de adobe." },
  { id: "guias-colores", name: "Guías Colores del Cerro", kind: "cooperativa", story: "Guías de Purmamarca que cuidan los senderos del Cerro de los Siete Colores." },
  { id: "posada-cerro", name: "Posada del Cerro", kind: "emprendedor", story: "Posada familiar con vista al cerro, atendida por sus dueños." },
  { id: "telar-purma", name: "Telar Comunitario de Purmamarca", kind: "comunidad", story: "Tejedoras que enseñan el telar andino y venden su producción en la feria." },
  { id: "cocina-andina", name: "Cocina Andina de la Quebrada", kind: "emprendedor", story: "Cocineras que usan papa andina, quinoa y carne de llama de productores vecinos." },
  { id: "coop-maimara", name: "Ceramistas de Maimará", kind: "cooperativa", story: "Taller colectivo que trabaja arcilla de la zona con técnicas heredadas." },
  { id: "hostel-paleta", name: "Hostel Paleta", kind: "emprendedor", story: "Hostel de gestión local frente a la Paleta del Pintor." },
  { id: "guias-pucara", name: "Cooperativa de Guías Pucará", kind: "cooperativa", story: "Guías de Tilcara formados en arqueología y cultura de la zona." },
  { id: "posada-pucara", name: "Posada Pucará", kind: "emprendedor", story: "Posada de ocho habitaciones en el centro de Tilcara." },
  { id: "mercado-tilcara", name: "Mercado Artesanal de Tilcara", kind: "cooperativa", story: "Más de treinta artesanos que venden directo, sin comisión." },
  { id: "pena-cardones", name: "Peña Los Cardones", kind: "emprendedor", story: "Peña con música en vivo y cocina de productores de la zona." },
  { id: "flia-pachamama", name: "Familias de la Comunidad de Tilcara", kind: "comunidad", story: "Familias que comparten rituales y saberes con quien llega con respeto." },
  { id: "flia-uquia", name: "Familia Quispe", kind: "comunidad", story: "Familia de Uquía que ofrece alojamiento y almuerzos en su casa." },
  { id: "guias-uquia", name: "Guías de Uquía", kind: "comunidad", story: "Jóvenes del pueblo que guían caminatas por las quebradas cercanas." },
  { id: "mujeres-humahuaca", name: "Cooperativa de Mujeres Tejedoras", kind: "cooperativa", story: "Cooperativa de Humahuaca que vende tejidos y reinvierte en capacitación." },
  { id: "hornocal-guias", name: "Guías del Hornocal", kind: "cooperativa", story: "Guías y choferes locales que llevan a la Serranía del Hornocal." },
  { id: "casa-queb", name: "Casa Quebradeña", kind: "emprendedor", story: "Hospedaje en una casona del casco antiguo de Humahuaca." },
];

const PROVIDER_BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));
export const providerOf = (id: string): Provider | undefined => PROVIDER_BY_ID.get(id);

const townLocation = (townId: string): LatLng =>
  TOWNS.find((t) => t.id === townId)?.location ?? { lat: -23.5, lng: -65.4 };

function item(
  id: string,
  category: Category,
  townId: string,
  providerId: string,
  title: string,
  summary: string,
  priceArs: number,
  priceUnit: string,
  communityShare: number,
  extra: Record<string, unknown> = {},
): Listing {
  return {
    id, category, townId, providerId, title, summary,
    images: [], priceArs, priceUnit, communityShare,
    location: townLocation(townId), extra,
  };
}

export const LISTINGS: Listing[] = [
  // Volcán
  item("tr-volcan-tilcara", "transport", "volcan", "tren-solar", "Tren Solar: Volcán a Tilcara", "Tramo de ida con paradas en Purmamarca y Maimará.", 9500, "persona", 0.4, { from: "Volcán", to: "Tilcara", departures: "9:00, 13:00 y 17:00" }),
  item("fd-volcan-locro", "food", "volcan", "coop-volcan", "Locro y humita de la cooperativa", "Plato regional con maíz y zapallo de huertas de Volcán.", 7500, "plato", 0.6, { cuisine: "Andina", openHours: "11 a 16 h" }),
  item("pr-volcan-quinoa", "product", "volcan", "coop-volcan", "Quinoa real en origen", "Bolsa de un kilo de productores de Volcán y Tumbaya.", 6000, "kilo", 0.8, { artisan: "Cooperativa Valle Verde", shipping: "Retiro en la estación" }),
  item("lo-volcan-algarrobos", "lodging", "volcan", "flia-algarrobos", "Casa de familia Los Algarrobos", "Habitación doble con desayuno de la huerta.", 38000, "noche", 0.9, { beds: 2, checkIn: "14 h", amenities: "Desayuno, agua caliente" }),

  item("ex-volcan-quebrada", "excursion", "volcan", "guias-volcan", "Caminata a la Quebrada de Volcán", "Sendero por la quebrada con guía local y vista al valle.", 11000, "persona", 0.9, { durationMin: 150, difficulty: "Baja", outdoor: true, requiresGuide: true }),
  item("ex-volcan-mirador", "excursion", "volcan", "guias-volcan", "Mirador de los cerros al atardecer", "Subida corta para ver el valle teñirse de colores.", 7000, "persona", 0.9, { durationMin: 90, difficulty: "Baja", outdoor: true, requiresGuide: false }),
  item("cu-volcan-huerta", "culture", "volcan", "coop-volcan", "Huerta comunitaria y feria de productores", "Recorrido por las huertas con quienes cultivan y venden en la feria.", 5000, "persona", 0.9, { eventDate: "Sábados", language: "Español", communityLed: true }),

  // Purmamarca
  item("ex-purma-siete", "excursion", "purmamarca", "guias-colores", "Cerro de los Siete Colores al amanecer", "Caminata corta con guía local por el sendero del cerro.", 12000, "persona", 0.9, { durationMin: 90, difficulty: "Baja", outdoor: true, requiresGuide: true }),
  item("ex-purma-colorados", "excursion", "purmamarca", "guias-colores", "Paseo de los Colorados", "Circuito de tres kilómetros entre quebradas rojas.", 15000, "persona", 0.9, { durationMin: 150, difficulty: "Media", outdoor: true, requiresGuide: true }),
  item("lo-purma-posada", "lodging", "purmamarca", "posada-cerro", "Posada del Cerro", "Habitación con vista al cerro y desayuno regional.", 62000, "noche", 0.7, { beds: 2, checkIn: "14 h", amenities: "Desayuno, calefacción" }),
  item("pr-purma-tejidos", "product", "purmamarca", "telar-purma", "Tejidos en lana de llama", "Ponchos, mantas y gorros hechos en telar por mujeres de la comunidad.", 28000, "pieza", 0.85, { artisan: "Telar Comunitario", material: "Lana de llama", shipping: "Envío a todo el país" }),
  item("fd-purma-empanadas", "food", "purmamarca", "cocina-andina", "Empanadas jujeñas y cordero", "Almuerzo en la plaza con productos de la zona.", 9000, "persona", 0.6, { cuisine: "Andina", openHours: "11 a 17 h" }),
  item("cu-purma-telar", "culture", "purmamarca", "telar-purma", "Taller de telar con la comunidad", "Aprendé a hilar y tejer con las tejedoras de Purmamarca.", 14000, "persona", 0.9, { eventDate: "Todos los días", language: "Español", communityLed: true }),
  item("tr-purma-maimara", "transport", "purmamarca", "tren-solar", "Tren Solar: Purmamarca a Maimará", "Tramo corto, ideal para combinar con una excursión.", 4500, "persona", 0.4, { from: "Purmamarca", to: "Maimará", departures: "10:00 y 15:00" }),

  // Maimará
  item("ex-maimara-paleta", "excursion", "maimara", "hostel-paleta", "Paleta del Pintor al atardecer", "Mirador con guía y merienda regional.", 8000, "persona", 0.7, { durationMin: 90, difficulty: "Baja", outdoor: true, requiresGuide: false }),
  item("pr-maimara-ceramica", "product", "maimara", "coop-maimara", "Cerámica de Maimará", "Piezas de arcilla local hechas y cocidas en el taller.", 22000, "pieza", 0.85, { artisan: "Ceramistas de Maimará", material: "Arcilla", shipping: "Envío con embalaje" }),
  item("fd-maimara-dulces", "food", "maimara", "cocina-andina", "Dulces y conservas de huerta", "Frascos de cayote, higo y tomate de productores vecinos.", 5500, "frasco", 0.8, { cuisine: "Dulces regionales", openHours: "10 a 18 h" }),
  item("lo-maimara-hostel", "lodging", "maimara", "hostel-paleta", "Hostel Paleta", "Cama en cuarto compartido o privado frente a la Paleta del Pintor.", 30000, "noche", 0.7, { beds: 4, checkIn: "13 h", amenities: "Cocina compartida, wifi" }),
  item("cu-maimara-memoria", "culture", "maimara", "flia-pachamama", "Relatos de Maimará y su cementerio", "Visita guiada con historias de familias del pueblo.", 5000, "persona", 0.8, { eventDate: "Todos los días", language: "Español", communityLed: true }),

  // Tilcara
  item("ex-tilcara-pucara", "excursion", "tilcara", "guias-pucara", "Pucará de Tilcara con guía", "Recorrido por la fortaleza prehispánica con explicación arqueológica.", 18000, "persona", 0.8, { durationMin: 120, difficulty: "Baja", outdoor: true, requiresGuide: true }),
  item("ex-tilcara-garganta", "excursion", "tilcara", "guias-pucara", "Garganta del Diablo: trekking suave", "Caminata junto al arroyo hasta la cascada.", 16000, "persona", 0.8, { durationMin: 240, difficulty: "Media", outdoor: true, requiresGuide: true }),
  item("lo-tilcara-posada", "lodging", "tilcara", "posada-pucara", "Posada Pucará", "Habitación doble con desayuno en el centro del pueblo.", 70000, "noche", 0.7, { beds: 2, checkIn: "14 h", amenities: "Desayuno, patio" }),
  item("pr-tilcara-instrumentos", "product", "tilcara", "mercado-tilcara", "Instrumentos andinos del mercado", "Charangos, quenas y sikus hechos por artesanos de Tilcara.", 35000, "pieza", 0.9, { artisan: "Mercado Artesanal", material: "Madera y caña", shipping: "Envío con estuche" }),
  item("pr-tilcara-quesos", "product", "tilcara", "mercado-tilcara", "Quesos y charqui de productores", "Tabla para llevar de productores de la quebrada.", 9000, "tabla", 0.85, { artisan: "Productores de la zona", shipping: "Retiro en el mercado" }),
  item("fd-tilcara-pena", "food", "tilcara", "pena-cardones", "Peña con música en vivo", "Cena con quinoa, llama y música de la zona.", 18000, "persona", 0.6, { cuisine: "Andina", openHours: "20 a 1 h" }),
  item("cu-tilcara-pachamama", "culture", "tilcara", "flia-pachamama", "Ofrenda a la Pachamama con familias", "Ceremonia explicada por familias de la comunidad; se participa con respeto.", 12000, "persona", 0.95, { eventDate: "Agosto, con salidas especiales", language: "Español", communityLed: true }),
  item("tr-tilcara-bicis", "transport", "tilcara", "guias-pucara", "Bicicletas por el valle", "Alquiler por el día con mapa de caminos rurales.", 12000, "día", 0.7, { from: "Tilcara", to: "Maimará", departures: "Retiro 9 a 17 h" }),

  // Uquía
  item("cu-uquia-iglesia", "culture", "uquia", "flia-uquia", "Iglesia de Uquía y los Ángeles Arcabuceros", "Visita guiada a la iglesia del siglo XVII y su colección de pinturas.", 4000, "persona", 0.8, { eventDate: "Todos los días", language: "Español", communityLed: true }),
  item("lo-uquia-adobe", "lodging", "uquia", "flia-uquia", "Casa de adobe en Uquía", "Habitación con baño privado y desayuno casero.", 45000, "noche", 0.9, { beds: 2, checkIn: "15 h", amenities: "Desayuno, patio con huerta" }),
  item("fd-uquia-almuerzo", "food", "uquia", "flia-uquia", "Almuerzo en casa de familia", "Menú de tres pasos con productos de la huerta.", 11000, "persona", 0.9, { cuisine: "Casera andina", openHours: "12 a 15 h" }),
  item("ex-uquia-senoritas", "excursion", "uquia", "guias-uquia", "Quebrada de las Señoritas", "Caminata por formaciones rojizas con guía joven del pueblo.", 13000, "persona", 0.9, { durationMin: 180, difficulty: "Media", outdoor: true, requiresGuide: true }),
  item("pr-uquia-hierbas", "product", "uquia", "flia-uquia", "Hierbas aromáticas de altura", "Mezclas para infusión secadas al sol.", 4500, "bolsa", 0.9, { artisan: "Familia Quispe", shipping: "Retiro en el pueblo" }),

  // Humahuaca
  item("ex-huma-hornocal", "excursion", "humahuaca", "hornocal-guias", "Serranía del Hornocal", "Traslado y mirador a más de 4.000 metros con guía local.", 25000, "persona", 0.8, { durationMin: 240, difficulty: "Media (altura)", elevationM: 4350, outdoor: true, requiresGuide: true }),
  item("cu-huma-cabildo", "culture", "humahuaca", "flia-pachamama", "Cabildo y Monumento a la Independencia", "Recorrido del casco histórico con relatos locales.", 6000, "persona", 0.7, { eventDate: "Todos los días", language: "Español", communityLed: false }),
  item("lo-huma-casa", "lodging", "humahuaca", "casa-queb", "Casa Quebradeña", "Hospedaje en casona del casco antiguo.", 55000, "noche", 0.7, { beds: 2, checkIn: "14 h", amenities: "Desayuno, calefacción" }),
  item("fd-huma-mercado", "food", "humahuaca", "cocina-andina", "Mercado Municipal: comida regional", "Menú del día en los puestos del mercado.", 8000, "persona", 0.7, { cuisine: "Regional", openHours: "11 a 16 h" }),
  item("pr-huma-tejidos", "product", "humahuaca", "mujeres-humahuaca", "Tejidos de la cooperativa de mujeres", "Chalinas y mantas hechas con lana de oveja y llama.", 30000, "pieza", 0.9, { artisan: "Cooperativa de Mujeres Tejedoras", material: "Lana", shipping: "Envío a todo el país" }),
  item("tr-huma-volcan", "transport", "humahuaca", "tren-solar", "Tren Solar: Humahuaca a Volcán", "Tramo de regreso con vistas de la quebrada.", 9500, "persona", 0.4, { from: "Humahuaca", to: "Volcán", departures: "11:00, 15:00 y 19:00" }),
];

/** Ofertas que, en el modelo final, llegaron por el bot de WhatsApp (ejemplos para la demo). */
const FROM_WHATSAPP = new Set(["pr-uquia-hierbas", "fd-maimara-dulces", "pr-volcan-quinoa"]);
for (const listing of LISTINGS) if (FROM_WHATSAPP.has(listing.id)) listing.extra.source = "whatsapp";

export const LISTINGS_BY_ID = new Map(LISTINGS.map((l) => [l.id, l]));

export const listingsFor = (townId: string, category: Category): Listing[] =>
  LISTINGS.filter((l) => l.townId === townId && l.category === category);

export const categoriesWithItems = (townId: string): Category[] =>
  CATEGORIES.filter((c) => listingsFor(townId, c.id).length > 0).map((c) => c.id);

export const formatArs = (value: number): string =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
