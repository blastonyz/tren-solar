# Spec · Alertas geoespaciales Jujuy (Tren Solar)

Fecha: 2026-11-22 · Versión viva en el doc compartido del equipo.

## Índice

1. [Objetivo y alcance](#1-objetivo-y-alcance)
2. [Arquitectura](#2-arquitectura)
3. [Fuentes de datos](#3-fuentes-de-datos)
4. [Catálogo y flujo de UI](#4-catálogo-y-flujo-de-ui)
5. [Modelo de datos (MongoDB)](#5-modelo-de-datos-mongodb)
6. [Satélite y alertas tempranas](#6-satélite-y-alertas-tempranas)
7. [Pagos con Mercado Pago](#7-pagos-con-mercado-pago)
8. [Configuración y secretos](#8-configuración-y-secretos)
9. [Contratos de API](#9-contratos-de-api)
10. [Tareas](#10-tareas)
11. [Orden de trabajo](#11-orden-de-trabajo)
12. [Riesgos](#12-riesgos)
13. [Preguntas abiertas](#13-preguntas-abiertas)

## 1. Objetivo y alcance

El MVP es una experiencia de turismo y economías regionales sobre el recorrido del Tren Solar: el visitante explora las estaciones en 3D, arma su viaje con servicios de la Quebrada (excursiones, hospedajes, productos regionales y más), paga en sandbox y recibe alertas tempranas por WhatsApp. Esas alertas salen de telemetría geoespacial, clima y satélite, y además deciden si una excursión conviene hoy. La demo cubre el flujo completo: explorar, armar el viaje, pagar y recibir el aviso.

### 1.1 Datos del MVP

| Dato | Fuente | En el MVP |
| --- | --- | --- |
| Posición, pasajeros y energía del tren | Telemetría propia sobre una traza GeoJSON de la Quebrada | Simulado |
| Lluvia y viento por coordenada | Open-Meteo | Real |
| Focos de calor | NASA FIRMS (satélite) | Real con MAP_KEY; sin clave, archivo de ejemplo |
| Ocupación por pueblo | Modelo propio | Simulado |
| Avisos y consultas | Vonage WhatsApp Sandbox | Real |
| Caudal de ríos (crecidas) | Open-Meteo Flood API (GloFAS) | Real; sin clave, archivo de ejemplo |
| Catálogo (excursiones, hospedajes, productos, etc.) | MongoDB; semillas en `data/seed/` | Ficticio pero realista, cargado por nosotros |
| Pagos | Mercado Pago, entorno de prueba | Real en sandbox, sin dinero real |
| Bot de WhatsApp para turistas y oferentes | DeepSeek (API de chat) sobre el Sandbox de Vonage | Real; ver [Canal de WhatsApp](#43-canal-de-whatsapp-turistas-y-oferentes) |

### 1.2 Fuera de alcance

- Cobros reales y reparto automático del pago a cada comunidad (Mercado Pago split requiere vendedores vinculados por OAuth). El porcentaje que queda en la comunidad se muestra, pero la plata del sandbox entra a una sola cuenta.
- Procesamiento propio de imágenes satelitales (NDVI, nieve): queda como extra.
- Un número de WhatsApp Business propio.
- Inventario, disponibilidad por fecha y reservas con cupo real: el catálogo solo guarda un cupo de referencia.

## 2. Arquitectura

```text
 Usuarios en WhatsApp <--mensajes--> Vonage WhatsApp Sandbox
                                            ^
                                            | webhook y avisos
                                            v
 Front 3D <------ JSON ------> API de Next ----> Open-Meteo  (lluvia y viento)
 escena 3D y panel                    /api/telemetry          ----> NASA FIRMS  (focos de calor)
 de alertas                           /api/weather            ----> Telemetría  (tren simulado)
                                      /api/fires
                                      /api/alerts
                                      /api/subscribe
                                      /api/notify
                                      /api/whatsapp
                                      Motor de reglas de alerta
```

El front y WhatsApp solo hablan con la API de Next. Ella consulta clima, satélite y telemetría, lee y escribe en MongoDB, crea los cobros en Mercado Pago y decide cuándo avisar. Las rutas del catálogo y del pago se detallan en [Contratos de API](#9-contratos-de-api).

```text
 Front 3D ---> /api/catalog, /api/trips, /api/checkout ---> MongoDB (catálogo, viajes, órdenes, alertas)
                                    |
                                    +--> Mercado Pago (preferencia de pago) --webhook--> /api/mp/webhook
```

## 3. Fuentes de datos

El satélite entra por NASA FIRMS (focos de calor) y por el modelo de caudales GloFAS a través de Open-Meteo; el clima también viene de Open-Meteo. Todos tienen acceso gratuito. Las imágenes satelitales propias (vegetación, nieve, inundación con Sentinel-2) quedan como extra y no se verificaron en esta investigación. El detalle de cómo se usan está en [Satélite y alertas tempranas](#6-satélite-y-alertas-tempranas).

| Fuente | Qué aporta a la alerta | Acceso | Límites |
| --- | --- | --- | --- |
| [Open-Meteo](https://open-meteo.com/) | Lluvia horaria, viento y temperatura por coordenada: riesgo de crecida y ráfagas | `https://api.open-meteo.com/v1/forecast`, sin clave | Gratis para uso no comercial hasta 10.000 llamadas diarias; pide atribución (CC BY 4.0) |
| [Open-Meteo Flood API](https://open-meteo.com/en/docs/flood-api) | Caudal diario simulado de ríos (GloFAS) para adelantar crecidas | `https://flood-api.open-meteo.com/v1/flood?latitude=&longitude=&daily=river_discharge`, sin clave | Resolución de 5 km, así que es una señal orientativa para quebradas chicas; mismas condiciones de uso que Open-Meteo |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/area/csv) | Focos de calor satelitales dentro de un rectángulo (VIIRS a 375 m, MODIS a 1 km) | `/api/area/csv/[MAP_KEY]/[SOURCE]/[AREA]/[DAY_RANGE]` con MAP_KEY gratis | Registro previo; límite de 5.000 transacciones cada 10 minutos por clave |
| [Vonage Messages API Sandbox](https://developer.vonage.com/en/messages/concepts/messages-api-sandbox) | Canal de entrada y salida por WhatsApp | Cuenta Vonage con `MASTER_KEY` y `VONAGE_API_KEY`; cada teléfono manda `PASS_PHRASE` al número del Sandbox para quedar autorizado | Número compartido; solo teléfonos autorizados; fuera de la ventana de 24 horas solo plantillas |
| [Mercado Pago](https://www.mercadopago.com.ar/developers) | Cobro del viaje en entorno de prueba | Cuenta de desarrollador, credenciales de prueba y usuarios de prueba; el MCP oficial ayuda a crear usuarios y webhooks | Sin plata real; ver [Pagos](#7-pagos-con-mercado-pago) |
| Telemetría del tren | Posición, pasajeros, kW solares | Simulada en `lib/telemetry.ts` | Sin hardware real |

Plan B por conectividad: guardar una respuesta real de cada API en `data/fixtures/` y que la API de Next use ese archivo si la llamada falla. Open-Meteo gratis es para uso no comercial: sirve para la demo, y si el producto sigue hay que pasar a su plan pago.

## 4. Catálogo y flujo de UI

### 4.1 Categorías

Todo el catálogo vive en una sola colección con un campo `category`, así una pantalla puede listar todo o filtrar por categoría.

| Categoría (`category`) | Qué incluye | Campos propios (`extra`) |
| --- | --- | --- |
| `excursion` | Cerro de los Siete Colores, Salinas Grandes, Pucará de Tilcara, caminatas y cabalgatas con guía local | `durationMin`, `difficulty`, `elevationM`, `requiresGuide`, `outdoor` |
| `lodging` | Posadas, hostels, casas de familia y cabañas | `beds`, `amenities`, `checkIn`, `checkOut` |
| `product` | Textiles, cerámica, quinoa, papas andinas, sal, dulces, con el artesano visible | `artisan`, `material`, `stock`, `shipping` |
| `food` | Comedores locales, humita, empanadas, llama, quinoa | `cuisine`, `dietary`, `openHours` |
| `culture` | Carnaval, Pachamama, visitas a comunidades, talleres de tejido y música | `eventDate`, `language`, `communityLed` |
| `transport` | Tramos del Tren Solar, traslados entre pueblos, alquiler de bicicletas | `from`, `to`, `departures` |

Cada ítem muestra siempre tres cosas: quién lo ofrece, qué porcentaje del precio queda en la comunidad (`communityShare`) y, si es al aire libre, el estado de aptitud del día (ver [Satélite y alertas tempranas](#6-satélite-y-alertas-tempranas)).

### 4.2 Flujo de pantallas

El 3D siempre queda de fondo; las pantallas son paneles que se deslizan encima.

| Paso | Pantalla | Qué pasa en la escena |
| --- | --- | --- |
| 1 | Inicio con botón "Empezar viaje" | El tren avanza en cámara lenta |
| 2 | Mapa de estaciones (Purmamarca, Maimará, Tilcara, Uquía, Humahuaca) | Cada estación es clickeable; la cámara vuela hasta la elegida y el tren frena ahí |
| 3 | Panel de estación con pestañas por categoría | Chips de alertas y de aptitud del día en la cabecera |
| 4 | Detalle de un ítem | Fotos, precio, proveedor, `communityShare` y "Sumar a mi viaje" |
| 5 | Mi viaje | Itinerario por estación y total; el tren recorre las paradas elegidas |
| 6 | Pago | Redirección a Mercado Pago de prueba y vuelta con el estado |
| 7 | Confirmación | Aviso por WhatsApp con el resumen y las alertas de los pueblos del viaje |

Animaciones previstas: vuelo de cámara a cada estación, tren que avanza y frena entre paradas, cambio de escena HDRI según la hora del viaje y ocupación del HUD que se mueve.

### 4.3 Canal de WhatsApp: turistas y oferentes

La idea es centralizar las ofertas regionales en un solo canal de WhatsApp. El bot pregunta primero si la persona es turista o local y sigue por uno de dos caminos. Un modelo de lenguaje (DeepSeek) entiende los mensajes libres, pero **nunca ejecuta acciones**: el servidor valida lo que devuelve y es el único que escribe en la base.

| Paso | Turista | Local (oferente) |
| --- | --- | --- |
| 1 | "¿Sos turista o local?" (se interpreta texto libre) | Igual |
| 2 | Pregunta pueblo, fechas e intereses | "¿Qué servicios o productos ofrecés?" |
| 3 | Elige hasta tres ítems del catálogo según filtros y aptitud del día, y los redacta | Extrae un borrador (categoría, título, resumen, precio, unidad, pueblo, productor) |
| 4 | Suma las alertas vigentes del pueblo | Pregunta de a uno los datos que faltan (máximo tres vueltas) |
| 5 | Ofrece sumar al viaje o pagar | Muestra el resumen y pide confirmación ("¿Publico? sí o no") |
| 6 | | Si confirma, publica solo y responde con el código de la oferta |

Reglas del canal:

- Al turista el bot solo le muestra ítems que existen en el catálogo. El modelo redacta la respuesta pero no inventa lugares ni precios.
- La publicación es automática una vez que el oferente confirma, sin revisión humana previa. A cambio, el servidor valida el borrador con un esquema (categoría permitida, precio dentro de un rango, largo del texto, pueblo conocido), filtra términos prohibidos, limita a 3 publicaciones por teléfono y por día, y marca la oferta con `source: "whatsapp"`.
- El oferente gestiona lo suyo por mensaje: `mis ofertas`, `pausar <código>` y `borrar <código>`. Cualquier usuario puede escribir `reportar <código>` y la oferta queda oculta hasta que alguien la revise.
- Una oferta publicada por WhatsApp se vincula a un productor (`providers`) creado a partir del teléfono, así los productos de una misma persona o cooperativa quedan agrupados.
- Los mensajes de los usuarios son datos, no instrucciones: el prompt del sistema los trata como texto a analizar y el servidor ignora cualquier orden que el modelo devuelva fuera del esquema.
- Los comandos fijos (`alertas`, `suscribir`, `baja`) siguen funcionando sin pasar por el modelo.

Detalles de la API de DeepSeek, según su documentación: se usa `POST https://api.deepseek.com/chat/completions` con `Authorization: Bearer <DEEPSEEK_API_KEY>`. Para el borrador se activa la salida JSON con `response_format: { "type": "json_object" }`; el prompt debe pedir JSON de forma explícita y dar un ejemplo, hay que fijar `max_tokens` para que no se corte, y la API puede devolver contenido vacío, así que el servidor reintenta una vez y, si falla, pide el dato de nuevo al usuario. El nombre del modelo cambia con el tiempo: va en `DEEPSEEK_MODEL` y se confirma en la documentación vigente antes de implementar.

## 5. Modelo de datos (MongoDB)

Se elige MongoDB porque el catálogo cambia de forma por categoría y los documentos se cargan fácil como JSON; las consultas geográficas se resuelven con índices `2dsphere`.

### 5.1 Conectividad

Atlas necesita internet y la Quebrada no la garantiza. Por eso la API accede a los datos a través de una capa de repositorio con dos implementaciones, elegidas con `DATA_SOURCE`:

- `mongo`: MongoDB Atlas, con la conexión de `MONGO_DB_URI`. La base se llama `jujuy` y va en la propia URI, así que no hace falta otra variable para el nombre.
- `seed`: lee `data/seed/*.json`, con la misma forma que los documentos, y guarda lo escrito en memoria.

El front nunca sabe cuál se usa. Las semillas son la fuente única del catálogo: se cargan a Mongo con un script (`npm run seed`). La dependencia del driver (`mongodb`) va con versión exacta y se revisa con `npm audit`.

### 5.2 Colecciones

Todas las colecciones viven en la base `jujuy`.

| Colección | Para qué | Campos principales |
| --- | --- | --- |
| `towns` | Estaciones y pueblos | `_id` (slug), `name`, `location` (GeoJSON Point), `capacity`, `kmFromStart` |
| `providers` | Quién ofrece el servicio | `_id`, `name`, `kind` (`comunidad`, `cooperativa`, `emprendedor`), `townId`, `story`, `whatsapp` |
| `listings` | Catálogo de todas las categorías | `_id`, `category`, `townId`, `providerId`, `title`, `summary`, `images[]`, `priceArs`, `priceUnit`, `communityShare` (0 a 1), `location`, `tags[]`, `active`, `status` (`published`, `paused`, `hidden`), `source` (`seed`, `whatsapp`), `ownerHash`, `createdAt`, `extra{}` |
| `trips` | "Mi viaje" antes de pagar | `_id`, `sessionId`, `items[{listingId, qty, date, priceArsAtAdd}]`, `status` (`draft`, `ordered`) |
| `orders` | Cobro de un viaje | `_id`, `tripId`, `items[]` (copia de precios), `totalArs`, `status` (`pending`, `approved`, `rejected`, `refunded`), `mp{preferenceId, paymentId, status}`, `createdAt` |
| `subscriptions` | Avisos por WhatsApp | `_id`, `phone` (E.164), `townId`, `optedIn`, `createdAt` |
| `alerts` | Alertas emitidas y su historial | `_id`, `kind`, `severity`, `townId`, `message`, `location`, `leadTimeHours`, `issuedAt`, `expiresAt`, `source`, `dedupeKey` |
| `conversations` | Estado del bot por teléfono | `_id` (hash del teléfono), `role` (`tourist`, `local`), `step`, `draft`, `turns`, `updatedAt` (con TTL) |
| `reports` | Reportes de ofertas | `_id`, `listingId`, `reason`, `createdAt` |
| `signals_cache` | Respuestas de Open-Meteo, Flood y FIRMS | `_id` (clave), `payload`, `fetchedAt`, `expireAt` |

### 5.3 Índices

| Colección | Índice | Motivo |
| --- | --- | --- |
| `listings` | `2dsphere` en `location` | Cercanía a focos de calor y a la traza |
| `listings` | `{ category: 1, townId: 1, active: 1 }` | Pestañas por categoría en cada estación |
| `towns` | `2dsphere` en `location` | Pueblo más cercano a un punto |
| `alerts` | único en `dedupeKey` y TTL en `expireAt` | No repetir avisos y limpiar las vencidas |
| `signals_cache` | TTL en `expireAt` | Caché que se vence sola |
| `orders` | único (parcial) en `mp.paymentId` | Un pago no se procesa dos veces |

### 5.4 Ejemplo de ítem

```json
{
  "_id": "exc-tilcara-pucara",
  "category": "excursion",
  "townId": "tilcara",
  "providerId": "coop-tilcara",
  "title": "Pucará de Tilcara con guía local",
  "priceArs": 18000,
  "priceUnit": "persona",
  "communityShare": 0.7,
  "location": { "type": "Point", "coordinates": [-65.4, -23.58] },
  "active": true,
  "extra": { "durationMin": 120, "difficulty": "baja", "outdoor": true, "requiresGuide": true }
}
```

Los datos de personas se limitan a lo necesario para la demo: `subscriptions.phone` y el `sessionId` anónimo. No se guardan datos de tarjeta; los maneja Mercado Pago.

## 6. Satélite y alertas tempranas

El satélite aporta dos cosas: avisar antes y decir si una excursión conviene hoy.

| Señal | Fuente | Qué anticipa |
| --- | --- | --- |
| Focos de calor | NASA FIRMS | Incendios cerca de la traza, de un pueblo o de una excursión |
| Lluvia a 24 y 48 horas | Open-Meteo | Aluviones y cortes de ruta en temporada de lluvias |
| Caudal pronosticado del río | Open-Meteo Flood API (GloFAS) | Crecidas con días de anticipación, más allá de la lluvia puntual |
| Ocupación | Telemetría simulada | Aglomeración en una estación |

### 6.1 Alertas tempranas

Se extienden las reglas de la [sección 9.3](#93-reglas-de-alerta): una alerta puede salir con anticipación (`leadTimeHours`), por ejemplo "lluvia fuerte en Tilcara en 18 horas". Cada alerta tiene un `dedupeKey` (tipo, pueblo y ventana de tiempo) para que el mismo aviso no se mande dos veces por WhatsApp.

### 6.2 Aptitud de excursión

Para cada ítem de `excursion` con `outdoor: true`, la API calcula `suitability` con tres estados:

| Estado | Cuándo | Qué muestra la UI |
| --- | --- | --- |
| `good` | Sin lluvia fuerte, viento moderado, sin focos ni crecida cerca | Etiqueta verde |
| `caution` | Lluvia moderada, viento fuerte o caudal en aumento | Etiqueta amarilla con el motivo |
| `avoid` | Alerta `critical` activa en el pueblo o foco de calor a menos de 3 km | Etiqueta roja; el pago pide confirmar |

Los umbrales son una propuesta para calibrar con los datos reales. La imagen satelital propia (por ejemplo nieve o vegetación con Sentinel-2) queda como extra y no se verificó acá.

## 7. Pagos con Mercado Pago

### 7.1 Flujo

1. El front manda "Mi viaje" a `POST /api/checkout`.
2. La API guarda una `order` en estado `pending` y crea una preferencia de Checkout Pro con las credenciales de prueba. La orden viaja en `external_reference` y la URL del webhook en `notification_url`.
3. La API devuelve el link de pago (`init_point`) y el front redirige a él.
4. El comprador paga con un usuario de prueba y vuelve por las `back_urls`.
5. Mercado Pago avisa a `POST /api/mp/webhook`. La API consulta el pago, actualiza la orden y manda la confirmación por WhatsApp.

El link lo genera siempre la API a partir de la preferencia. El MCP oficial de Mercado Pago no crea links de pago: sirve para buscar documentación, crear usuarios de prueba y cargarles saldo, configurar webhooks y consultar el historial de notificaciones. Obtener las credenciales por MCP requiere OAuth.

### 7.2 Qué se hace con el MCP

| Paso | Cómo |
| --- | --- |
| Crear la aplicación y obtener las credenciales de prueba | Panel de desarrolladores (las credenciales por MCP requieren OAuth) |
| Crear un usuario de prueba vendedor y otro comprador con saldo | MCP (`create_test_user` y `add_money_test_user`) o panel |
| Configurar el webhook (URL del túnel) | MCP (`save_webhook`) o panel |

### 7.3 Reglas

- El token de acceso (`MP_ACCESS_TOKEN`) se usa solo en el servidor. La clave pública puede ir en el front.
- La orden se marca como aprobada solo después de consultar el pago en la API de Mercado Pago, nunca por lo que diga la URL de vuelta.
- El webhook es idempotente: si llega dos veces el mismo `paymentId`, la segunda no hace nada.
- El porcentaje `communityShare` se muestra en la UI y en la confirmación, pero no se reparte automáticamente (ver [Fuera de alcance](#12-fuera-de-alcance)).
- Plan B: si falla la conectividad, el botón "simular pago" marca la orden como aprobada con una marca `simulated: true` y deja correr el resto del flujo.

## 8. Configuración y secretos

Las variables viven en `.env`, en la raíz del proyecto. Git ya ignora ese archivo (`.env*` en `.gitignore`) y los valores nunca se commitean.

### 8.1 Variables

| Variable | Qué es | Quién la usa | Estado |
| --- | --- | --- | --- |
| `MASTER_KEY` | Credencial de la cuenta Vonage. Con `VONAGE_API_KEY` forma el par de la autenticación Basic | `POST /api/notify` y las respuestas de `POST /api/whatsapp` | Cargada |
| `VONAGE_API_KEY` | Credencial de la cuenta Vonage. Es la otra mitad del par de la autenticación Basic | `POST /api/notify` y las respuestas de `POST /api/whatsapp` | Cargada |
| `PASS_PHRASE` | Frase que cada teléfono manda al número del Sandbox para autorizarse | Panel de suscripción (tarea 12) y pitch | Cargada |
| `FIRMS_MAP_KEY` | Clave de NASA FIRMS | `GET /api/fires` | Pendiente (tarea 3); sin ella se usa el fixture |
| `DATA_SOURCE` | `mongo` o `seed`: de dónde lee la API el catálogo y las órdenes | Capa de repositorio | A definir (ver [Conectividad](#51-conectividad)) |
| `MONGO_DB_URI` | Conexión a MongoDB Atlas. Incluye usuario, clave y la base `jujuy` | Capa de repositorio | Cargada |
| `MP_ACCESS_TOKEN` | Token de acceso de prueba de Mercado Pago | `POST /api/checkout` y `POST /api/mp/webhook` | Pendiente (tarea 16) |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Clave pública de prueba de Mercado Pago (puede ir al navegador) | Front | Pendiente (tarea 16) |
| `APP_BASE_URL` | URL pública de la app (túnel o deploy), para `back_urls` y `notification_url` | `POST /api/checkout` | Pendiente |
| `VONAGE_SIGNATURE_SECRET` | Secreto de firma de la cuenta Vonage (Settings del panel), distinto del secreto de API. Valida el JWT de los webhooks | `POST /api/whatsapp` | Pendiente; sin él la firma no se valida en desarrollo y en producción el webhook responde 503 |
| `VONAGE_WHATSAPP_NUMBER` | Número del Sandbox que envía los avisos | `POST /api/notify` | Opcional; por defecto `14157386102` |
| `DEEPSEEK_API_KEY` | Clave de la API de DeepSeek | Bot de WhatsApp (solo servidor) | Pendiente |
| `DEEPSEEK_MODEL` | Nombre del modelo a usar (cambia con el tiempo) | Bot de WhatsApp | Pendiente |
| `NOTIFY_TOKEN` | Si está, `POST /api/notify` pide `Authorization: Bearer <NOTIFY_TOKEN>` | `POST /api/notify` | Opcional |

Por el largo de los valores cargados (8 y 16 caracteres, el formato de la clave y el secreto de Vonage), `MASTER_KEY` es la clave de API de la cuenta (el usuario de Basic) y `VONAGE_API_KEY` su secreto (la contraseña). Así lo usa `lib/vonage.ts`. Sin las dos, los envíos se simulan y solo se escriben en el log del servidor.

### 8.2 Plantilla

```dotenv
MASTER_KEY=
VONAGE_API_KEY=
PASS_PHRASE=
FIRMS_MAP_KEY=
DATA_SOURCE=seed
MONGO_DB_URI=
MP_ACCESS_TOKEN=
NEXT_PUBLIC_MP_PUBLIC_KEY=
APP_BASE_URL=
VONAGE_SIGNATURE_SECRET=
VONAGE_WHATSAPP_NUMBER=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=
NOTIFY_TOKEN=
```

### 8.3 Reglas de uso

- `MASTER_KEY` y `VONAGE_API_KEY` se leen solo en el servidor (rutas de `app/api`). Nunca llevan el prefijo `NEXT_PUBLIC_` ni llegan al navegador.
- `MONGO_DB_URI` y `MP_ACCESS_TOKEN` se leen solo en el servidor. Lo único con prefijo `NEXT_PUBLIC_` es la clave pública de Mercado Pago.
- `PASS_PHRASE` es el único valor secreto que se muestra en pantalla, junto al QR del Sandbox.
- El número del Sandbox y las URLs de los webhooks entrante y de estado se cargan en el panel de Vonage, no en `.env`.

## 9. Contratos de API

Todas las rutas viven en el App Router de Next y devuelven JSON, salvo el webhook de Vonage, que solo devuelve 200.

### 9.1 Modelo compartido

Este es el modelo de alerta que comparten front y API. Se congela en `lib/types.ts`.

```ts
type Severity = "info" | "warning" | "critical";
type AlertKind = "flood" | "fire" | "crowding";
type Category = "excursion" | "lodging" | "product" | "food" | "culture" | "transport";
type Suitability = "good" | "caution" | "avoid";

interface Alert {
  id: string;
  kind: AlertKind;
  severity: Severity;
  town: string;
  message: string;
  location: { lat: number; lng: number };
  issuedAt: string; // ISO 8601
  leadTimeHours?: number; // alerta temprana: horas hasta el evento
  dedupeKey: string;
  source: "open-meteo" | "open-meteo-flood" | "firms" | "telemetry";
}

interface Listing {
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
  location: { lat: number; lng: number };
  suitability?: Suitability; // solo excursiones al aire libre
  suitabilityReason?: string;
  extra: Record<string, unknown>;
}

interface TripItem {
  listingId: string;
  qty: number;
  date?: string; // ISO 8601
}

interface Order {
  id: string;
  tripId: string;
  totalArs: number;
  status: "pending" | "approved" | "rejected" | "refunded";
  initPoint?: string; // link de pago de Mercado Pago
  simulated?: boolean;
}
```

### 9.2 Rutas

| Método y ruta | Devuelve |
| --- | --- |
| `GET /api/telemetry` | Posición del tren, pasajeros, kW solares y ocupación por pueblo |
| `GET /api/weather?town=` | Lluvia y viento de las próximas horas para un pueblo |
| `GET /api/fires` | Focos de calor cercanos a la traza o a los pueblos |
| `GET /api/alerts` | Lista de `Alert` vigentes, ordenadas por severidad |
| `POST /api/subscribe` | Registra número de WhatsApp y pueblo |
| `POST /api/notify` | Envía una alerta a los suscriptos del pueblo por Vonage |
| `POST /api/whatsapp` | Webhook de Vonage: lee el comando recibido y responde con la API de mensajes |
| `GET /api/providers` y `GET /api/providers/[id]` | Productores y comunidades con sus ofertas publicadas |
| `GET /api/conditions?town=` | Condiciones del día por pueblo (lluvia, ráfagas, focos de calor, caudal) con su origen (`live` o `fixture`) |
| `GET /api/towns` | Estaciones con ocupación y alertas vigentes |
| `GET /api/catalog?town=&category=` | `Listing[]` con `suitability` calculada para las excursiones al aire libre |
| `GET /api/catalog/[id]` | Un ítem con su proveedor |
| `PUT /api/trips/[id]` | Guarda "Mi viaje" (`TripItem[]`) |
| `POST /api/checkout` | Crea la orden y la preferencia de Mercado Pago; devuelve `Order` con `initPoint` |
| `POST /api/mp/webhook` | Notificación de Mercado Pago: consulta el pago, actualiza la orden y avisa por WhatsApp |
| `POST /api/checkout/simulate` | Marca la orden como aprobada con `simulated: true` (solo demo) |

### 9.3 Reglas de alerta

Los umbrales son una propuesta para calibrar.

| Tipo | Se dispara cuando | Severidad |
| --- | --- | --- |
| `flood` | La lluvia acumulada de las próximas 6 horas en un pueblo supera 10 mm | `warning`; `critical` si supera el doble |
| `fire` | Hay un foco de FIRMS a menos de 10 km de la traza o de un pueblo | `warning`; `critical` si está a menos de 3 km |
| `crowding` | La ocupación de un pueblo llega al 90% | `info`, con sugerencia de pueblo alternativo |
| `flood` (temprana) | El caudal pronosticado del río cercano o la lluvia a 24 y 48 horas supera el umbral | `warning` con `leadTimeHours`; `critical` si ambos coinciden |

### 9.4 WhatsApp con Vonage

| Paso | Cómo funciona |
| --- | --- |
| Autorización | Cada teléfono manda `PASS_PHRASE` al número del Sandbox. Solo los teléfonos autorizados reciben avisos |
| Entrante | Vonage llama a `POST /api/whatsapp`. La ruta lee el comando y devuelve 200; la respuesta sale por una llamada aparte |
| Saliente | `POST https://messages-sandbox.nexmo.com/v1/messages` con autenticación Basic (`MASTER_KEY` y `VONAGE_API_KEY`) y `channel: "whatsapp"` |
| Validación | Vonage firma cada webhook con un JWT HS256 en `Authorization: Bearer`, usando el secreto de firma de la cuenta (`VONAGE_SIGNATURE_SECRET`). Se verifica la firma, la antigüedad (`iat`, 5 minutos), el `api_key` y que `payload_hash` sea el SHA-256 del cuerpo |
| Límites | El Sandbox acepta 1 mensaje por segundo y 100 por mes: `POST /api/notify` espacia los envíos y no repite un `dedupeKey` al mismo teléfono |
| Webhooks en el panel | Inbound y Status apuntan a `https://<túnel>/api/whatsapp`; los estados se ignoran con 200 |

Comandos que entiende el webhook:

| Comando | Respuesta |
| --- | --- |
| `alertas` | Lista de alertas vigentes |
| `alertas <pueblo>` | Alertas vigentes de ese pueblo |
| `suscribir <pueblo>` | Alta de avisos para ese pueblo |
| `baja` | Baja de los avisos |

## 10. Tareas

Ya no hay reparto por persona: es un solo listado y cualquiera (o cualquier agente) toma la tarea libre que siga en el [orden de trabajo](#11-orden-de-trabajo). Lo primero es congelar los tipos compartidos en `lib/types.ts`, así la API y el front avanzan en paralelo sin esperarse. La escena base (tren, estación Volcán, ambientes y panel de telemetría simulada) ya está hecha; el front arranca por los datos y las pantallas.

### 10.1 Cuentas, datos y coordinación

| # | Tarea | Listo cuando | Estado |
| --- | --- | --- | --- |
| 1 | Congelar alcance, tipos compartidos y contrato de rutas (este doc) | El equipo aprobó los tipos | Pendiente |
| 2 | Activar el Sandbox de Vonage, autorizar los teléfonos del equipo con `PASS_PHRASE` y armar el QR/enlace de WhatsApp al número del Sandbox | Un teléfono de prueba recibe respuesta | Pendiente |
| 3 | Pedir la MAP_KEY de FIRMS | La clave responde un `area` de prueba | Pendiente |
| 15 | Conectar la API a la base `jujuy` de Atlas con `MONGO_DB_URI` | La API conecta y `npm run seed` carga el catálogo | En curso: la URI ya está en `.env`; falta probar la conexión y cargar el catálogo |
| 16 | Crear la aplicación de Mercado Pago y los usuarios de prueba (vendedor y comprador con saldo), con el MCP o el panel | Un pago de prueba se aprueba con el usuario comprador | Pendiente |
| 17 | Cargar el catálogo ficticio realista (unos 6 ítems por pueblo y categoría) en `data/seed/` | Cada estación tiene ítems en las 6 categorías | Pendiente |
| 4 | Guion del pitch y demo de 3 minutos, con el mensaje de impacto en turismo y economías regionales | Ensayo cronometrado | Pendiente |
| 14 | Integración, PR y prueba final de punta a punta | Flujo completo de dato a aviso en el celular | Pendiente |

### 10.2 API de Next

| # | Tarea | Listo cuando | Estado |
| --- | --- | --- | --- |
| 5 | Traza GeoJSON del tren, pueblos y helpers geoespaciales (`lib/geo.ts`) | Función de distancia punto a traza probada | Hecha (`lib/geo.ts`, `lib/route.ts`, con tests) |
| 6 | `GET /api/telemetry` con datos simulados | Devuelve el JSON del contrato | Hecha |
| 7 | `GET /api/weather` (proxy de Open-Meteo con caché) y `GET /api/fires` (FIRMS con respaldo en fixture) | Ambos responden sin internet usando fixtures | Hecha; los focos salen del fixture de ejemplo hasta tener `FIRMS_MAP_KEY` (tarea 3) |
| 8 | `GET /api/alerts`: motor de reglas de crecida, fuego y aglomeración | Genera al menos una alerta por regla con datos de ejemplo | Hecha; faltan las alertas tempranas (tarea 20) |
| 9 | `POST /api/whatsapp` (webhook entrante de Vonage con validación de firma) y `POST /api/notify` | Un mensaje "alertas" devuelve la lista actual | Hecha (`lib/vonage.ts`, `lib/whatsapp.ts`, `lib/notify.ts`, con tests). También `POST /api/subscribe`. Las suscripciones viven en memoria hasta la tarea 18. Falta probarlo con un teléfono real (tarea 2) y cargar `VONAGE_SIGNATURE_SECRET` |
| 26 | Máquina de estados del bot (`conversations`): turista o local, turnos y comandos fijos sin modelo | Una conversación de prueba recorre los dos caminos | Pendiente |
| 27 | Cliente de DeepSeek con salida JSON, validación con esquema, reintento y respaldo si falla | Un texto libre devuelve un borrador válido o una pregunta de repuesto | Pendiente |
| 28 | Publicación automática con límites, filtro de términos, `mis ofertas`, `pausar`, `borrar` y `reportar` | Una oferta confirmada por WhatsApp aparece en `GET /api/catalog` | Pendiente |
| 29 | `GET /api/providers` y `GET /api/conditions` | El front muestra productores y condiciones del día con datos reales o de ejemplo | Pendiente |
| 18 | Capa de repositorio con `mongo` y `seed`, esquemas, índices y script `npm run seed` | La API funciona igual con `DATA_SOURCE=seed` y con `mongo` | Pendiente |
| 19 | `GET /api/towns`, `GET /api/catalog` y `PUT /api/trips/[id]` | El front lista ítems por estación y categoría | Pendiente |
| 20 | Caudal (Open-Meteo Flood), alertas tempranas con `dedupeKey` y cálculo de `suitability` | Una excursión cambia de verde a rojo con un fixture de lluvia o de foco de calor | Pendiente |
| 21 | `POST /api/checkout`, `POST /api/mp/webhook` idempotente y `POST /api/checkout/simulate` | Un pago de prueba deja la orden en `approved` y manda el WhatsApp | Pendiente |

### 10.3 Front 3D

| # | Tarea | Listo cuando | Estado |
| --- | --- | --- | --- |
| 10 | Consumir `/api/telemetry` y `/api/alerts` con mocks hasta que la API esté lista | El front corre con datos mock y con la API real cambiando una variable | Pendiente: el panel usa valores propios, no el contrato |
| 11 | Mover el tren sobre la traza y mostrar marcadores de alertas por pueblo | Una alerta nueva aparece en la escena | Pendiente: la escena está lista, falta el movimiento y los marcadores |
| 12 | Panel de alertas con severidad y suscripción (número de WhatsApp y pueblo) con el QR del Sandbox y la frase de acceso a la vista | Alguien se suscribe desde la pantalla | Pendiente |
| 13 | Botón "simular mensaje" para la demo si falla la conectividad | La demo corre sin WhatsApp real | Pendiente |
| 22 | Mapa de estaciones clickeable con vuelo de cámara y tren que frena en cada parada | Clic en una estación mueve la cámara y el tren | Pendiente |
| 23 | Panel de estación con pestañas por categoría, chips de alerta y de aptitud, y detalle de ítem | Se ven las 6 categorías con datos del catálogo | Pendiente |
| 24 | "Mi viaje", pantalla de pago y confirmación (con botón "simular pago") | De sumar un ítem a ver la orden aprobada sin salir de la app | Pendiente |
| 25 | Animación de recorrido con las paradas elegidas y cambio de escena HDRI según la hora | El tren recorre el itinerario armado | Pendiente |
| 30 | Catálogo con tarjetas por categoría debajo del canvas, filtros por pueblo y productor, y productores vinculados a sus productos | Se navega todo el catálogo sin abrir el panel 3D | En curso |
| 31 | Indicadores de condiciones del día por pueblo (clima y satélite) con su origen visible | Cada pueblo muestra lluvia, ráfagas y focos de calor cercanos | En curso |
| 32 | Chat de prueba del bot que publica una oferta en el catálogo (simulado) | Una oferta "publicada por WhatsApp" aparece en el catálogo | En curso |

### 10.4 Reglas de repo

- Dependencias con versión exacta y sin vulnerabilidades conocidas. El proyecto ya trae `save-exact=true` en `.npmrc`.
- Las claves van en `.env`, nunca en el repo (ver [Configuración y secretos](#8-configuración-y-secretos)).

## 11. Orden de trabajo

El camino crítico es contrato, API con fixtures, front sobre la API y recién después WhatsApp real. Cada paso deja algo demostrable.

1. Contrato y tipos compartidos aprobados (tarea 1). Mientras tanto se resuelven el Sandbox de Vonage y la cuenta de FIRMS (2 y 3).
2. API con datos simulados y fixtures (5 a 8) y front sobre mocks (10 y 11), en paralelo. La escena 3D ya está, así que el front arranca directo por los datos.
3. Front apuntando a la API real y panel de alertas (12).
4. Webhook y avisos por WhatsApp (9), con el botón de simulación como respaldo (13).
5. Catálogo en semillas y repositorio (17 y 18), en paralelo al front de estaciones y categorías (22 y 23), todo con `DATA_SOURCE=seed`.
6. Aptitud de excursiones y alertas tempranas (20), y "Mi viaje" (24).
7. Pago de prueba (16 y 21) y MongoDB real (15) solo cuando lo anterior ya corre.
8. Integración, ensayo del pitch y PR (4 y 14).

## 12. Riesgos

| Riesgo | Qué hacemos |
| --- | --- |
| Internet inestable en la Quebrada | Fixtures guardados de cada API y caché en las rutas; el front corre con mocks |
| Vonage no puede llamar a `localhost` | Exponer el webhook con un túnel (ngrok o cloudflared) o usar el botón "simular mensaje" |
| Cada tester debe autorizarse en el Sandbox | QR y `PASS_PHRASE` en pantalla y en el pitch; probar antes con los tres teléfonos del equipo |
| La MAP_KEY de FIRMS tarda o falla | Usar el fixture de focos de calor y avisar en la demo que es un ejemplo |
| Un usuario manipula al modelo (prompt injection) o publica contenido abusivo | El modelo solo propone un borrador; el servidor valida el esquema, filtra términos, limita publicaciones por teléfono y permite `reportar` |
| Costo y límites de la API de DeepSeek | `max_tokens` acotado, máximo de turnos por conversación y comandos fijos sin modelo |
| Publicación automática sin revisión previa | Confirmación explícita del oferente, oferta visible con su origen (`source`) y reporte que la oculta |
| Atlas sin internet durante la demo | `DATA_SOURCE=seed` como valor por defecto; Mongo solo cuando todo lo demás ya funciona |
| El webhook de Mercado Pago no llega (sin túnel) | Botón "simular pago" y consulta manual del estado de la orden |
| Open-Meteo gratis no permite uso comercial | Aceptable para la demo; si el producto sigue, plan pago o proveedor alternativo |
| El caudal GloFAS (5 km) no refleja quebradas chicas | Tratarlo como señal orientativa y combinarlo con la lluvia pronosticada |
| El alcance crece | Imágenes satelitales propias, reparto del pago por comunidad y reservas con cupo quedan fuera hasta que el flujo completo funcione |

## 13. Preguntas abiertas

- Confirmar en el panel de Vonage que `MASTER_KEY` es la clave y `VONAGE_API_KEY` el secreto (ver [Variables](#81-variables)).
- Política de publicación: si las ofertas de WhatsApp salen solas o pasan por revisión humana en la demo.
- De quién es la cuenta de Mercado Pago de prueba y quién la administra.
- Si mostramos `communityShare` como dato real (acuerdo con comunidades) o como ejemplo en la demo.
- Quién es el dueño del repo `jujuy-pay` para aprobar el PR.
- Si la demo incluye teléfonos reales del jurado.
