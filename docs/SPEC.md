# Spec · Alertas geoespaciales Jujuy (Tren Solar)

Fecha: 2026-11-22 · Versión viva en el doc compartido del equipo.

## Índice

1. [Objetivo y alcance](#1-objetivo-y-alcance)
2. [Arquitectura](#2-arquitectura)
3. [Fuentes de datos](#3-fuentes-de-datos)
4. [Configuración y secretos](#4-configuración-y-secretos)
5. [Contratos de API](#5-contratos-de-api)
6. [Reparto de tareas](#6-reparto-de-tareas)
7. [Orden de trabajo](#7-orden-de-trabajo)
8. [Riesgos](#8-riesgos)
9. [Preguntas abiertas](#9-preguntas-abiertas)

## 1. Objetivo y alcance

El MVP convierte telemetría geoespacial del tren, clima y satélite en alertas que llegan por WhatsApp y se ven en el front 3D. La demo cubre el flujo completo: dato, regla, aviso.

### 1.1 Datos del MVP

| Dato | Fuente | En el MVP |
| --- | --- | --- |
| Posición, pasajeros y energía del tren | Telemetría propia sobre una traza GeoJSON de la Quebrada | Simulado |
| Lluvia y viento por coordenada | Open-Meteo | Real |
| Focos de calor | NASA FIRMS (satélite) | Real con MAP_KEY; sin clave, archivo de ejemplo |
| Ocupación por pueblo | Modelo propio | Simulado |
| Avisos y consultas | Vonage WhatsApp Sandbox | Real |

### 1.2 Fuera de alcance

- Base de datos persistente.
- Pagos.
- Procesamiento de imágenes satelitales (queda como extra).
- Un número de WhatsApp Business propio.

## 2. Arquitectura

```text
 Usuarios en WhatsApp <--mensajes--> Vonage WhatsApp Sandbox
                                            ^
                                            | webhook y avisos
                                            v
 Front 3D (Blas) <------ JSON ------> API de Next (Agustín) ----> Open-Meteo  (lluvia y viento)
 escena 3D y panel                    /api/telemetry          ----> NASA FIRMS  (focos de calor)
 de alertas                           /api/weather            ----> Telemetría  (tren simulado)
                                      /api/fires
                                      /api/alerts
                                      /api/subscribe
                                      /api/notify
                                      /api/whatsapp
                                      Motor de reglas de alerta
```

El front y WhatsApp solo hablan con la API de Next; ella consulta clima, satélite y telemetría, y decide cuándo avisar.

## 3. Fuentes de datos

El satélite entra por NASA FIRMS (focos de calor) y el clima por Open-Meteo; ambos tienen acceso gratuito. Las imágenes satelitales (por ejemplo vegetación o inundación con Sentinel-2) quedan como extra y no se verificaron en esta investigación.

| Fuente | Qué aporta a la alerta | Acceso | Límites |
| --- | --- | --- | --- |
| [Open-Meteo](https://open-meteo.com/) | Lluvia horaria, viento y temperatura por coordenada: riesgo de crecida y ráfagas | `https://api.open-meteo.com/v1/forecast`, sin clave | Gratis para uso no comercial hasta 10.000 llamadas diarias; pide atribución (CC BY 4.0) |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/area/csv) | Focos de calor satelitales dentro de un rectángulo (VIIRS a 375 m, MODIS a 1 km) | `/api/area/csv/[MAP_KEY]/[SOURCE]/[AREA]/[DAY_RANGE]` con MAP_KEY gratis | Registro previo; límite de 5.000 transacciones cada 10 minutos por clave |
| [Vonage Messages API Sandbox](https://developer.vonage.com/en/messages/concepts/messages-api-sandbox) | Canal de entrada y salida por WhatsApp | Cuenta Vonage con `MASTER_KEY` y `VONAGE_API_KEY`; cada teléfono manda `PASS_PHRASE` al número del Sandbox para quedar autorizado | Número compartido; solo teléfonos autorizados; fuera de la ventana de 24 horas solo plantillas |
| Telemetría del tren | Posición, pasajeros, kW solares | Simulada en `lib/telemetry.ts` | Sin hardware real |

Plan B por conectividad: guardar una respuesta real de cada API en `data/fixtures/` y que la API de Next use ese archivo si la llamada falla.

## 4. Configuración y secretos

Las variables viven en `.env`, en la raíz del proyecto. Git ya ignora ese archivo (`.env*` en `.gitignore`) y los valores nunca se commitean.

### 4.1 Variables

| Variable | Qué es | Quién la usa | Estado |
| --- | --- | --- | --- |
| `MASTER_KEY` | Credencial de la cuenta Vonage. Con `VONAGE_API_KEY` forma el par de la autenticación Basic | `POST /api/notify` y las respuestas de `POST /api/whatsapp` | Cargada |
| `VONAGE_API_KEY` | Credencial de la cuenta Vonage. Es la otra mitad del par de la autenticación Basic | `POST /api/notify` y las respuestas de `POST /api/whatsapp` | Cargada |
| `PASS_PHRASE` | Frase que cada teléfono manda al número del Sandbox para autorizarse | Panel de suscripción (tarea 12) y pitch | Cargada |
| `FIRMS_MAP_KEY` | Clave de NASA FIRMS | `GET /api/fires` | Pendiente (tarea 3); sin ella se usa el fixture |

Por el formato de los valores cargados, `MASTER_KEY` parece ser la clave de API de la cuenta (el usuario de Basic) y `VONAGE_API_KEY` su secreto (la contraseña). Falta confirmarlo contra el panel de Vonage antes de implementar el envío.

### 4.2 Plantilla

```dotenv
MASTER_KEY=
VONAGE_API_KEY=
PASS_PHRASE=
FIRMS_MAP_KEY=
```

### 4.3 Reglas de uso

- `MASTER_KEY` y `VONAGE_API_KEY` se leen solo en el servidor (rutas de `app/api`). Nunca llevan el prefijo `NEXT_PUBLIC_` ni llegan al navegador.
- `PASS_PHRASE` es el único valor que se muestra en pantalla, junto al QR del Sandbox.
- El número del Sandbox y las URLs de los webhooks entrante y de estado se cargan en el panel de Vonage, no en `.env`.

## 5. Contratos de API

Todas las rutas viven en el App Router de Next y devuelven JSON, salvo el webhook de Vonage, que solo devuelve 200.

### 5.1 Modelo compartido

Este es el modelo de alerta que comparten front y API. Se congela en `lib/types.ts`.

```ts
type Severity = "info" | "warning" | "critical";
type AlertKind = "flood" | "fire" | "crowding";

interface Alert {
  id: string;
  kind: AlertKind;
  severity: Severity;
  town: string;
  message: string;
  location: { lat: number; lng: number };
  issuedAt: string; // ISO 8601
  source: "open-meteo" | "firms" | "telemetry";
}
```

### 5.2 Rutas

| Método y ruta | Devuelve | Dueño |
| --- | --- | --- |
| `GET /api/telemetry` | Posición del tren, pasajeros, kW solares y ocupación por pueblo | Agustín |
| `GET /api/weather?town=` | Lluvia y viento de las próximas horas para un pueblo | Agustín |
| `GET /api/fires` | Focos de calor cercanos a la traza o a los pueblos | Agustín |
| `GET /api/alerts` | Lista de `Alert` vigentes, ordenadas por severidad | Agustín |
| `POST /api/subscribe` | Registra número de WhatsApp y pueblo | Agustín |
| `POST /api/notify` | Envía una alerta a los suscriptos del pueblo por Vonage | Agustín |
| `POST /api/whatsapp` | Webhook de Vonage: lee el comando recibido y responde con la API de mensajes | Agustín |

### 5.3 Reglas de alerta

Los umbrales son una propuesta para calibrar.

| Tipo | Se dispara cuando | Severidad |
| --- | --- | --- |
| `flood` | La lluvia acumulada de las próximas 6 horas en un pueblo supera 10 mm | `warning`; `critical` si supera el doble |
| `fire` | Hay un foco de FIRMS a menos de 10 km de la traza o de un pueblo | `warning`; `critical` si está a menos de 3 km |
| `crowding` | La ocupación de un pueblo llega al 90% | `info`, con sugerencia de pueblo alternativo |

### 5.4 WhatsApp con Vonage

| Paso | Cómo funciona |
| --- | --- |
| Autorización | Cada teléfono manda `PASS_PHRASE` al número del Sandbox. Solo los teléfonos autorizados reciben avisos |
| Entrante | Vonage llama a `POST /api/whatsapp`. La ruta lee el comando y devuelve 200; la respuesta sale por una llamada aparte |
| Saliente | `POST https://messages-sandbox.nexmo.com/v1/messages` con autenticación Basic (`MASTER_KEY` y `VONAGE_API_KEY`) y `channel: "whatsapp"` |
| Validación | Se verifica el JWT firmado del encabezado `Authorization`. Revisar la documentación vigente de webhooks firmados antes de implementarlo |

Comandos que entiende el webhook:

| Comando | Respuesta |
| --- | --- |
| `alertas` | Lista de alertas vigentes |
| `alertas <pueblo>` | Alertas vigentes de ese pueblo |
| `suscribir <pueblo>` | Alta de avisos para ese pueblo |
| `baja` | Baja de los avisos |

## 6. Reparto de tareas

Blas hace el front, Agustín la API de Next y Leo coordina y cuenta con las cuentas externas. Lo primero es congelar los tipos compartidos en `lib/types.ts`, así Blas y Agustín trabajan en paralelo sin esperarse.

### 6.1 Leo · coordinación y cuentas

| # | Tarea | Listo cuando |
| --- | --- | --- |
| 1 | Congelar alcance, tipos compartidos y contrato de rutas (este doc) | Los tres aprobaron los tipos |
| 2 | Activar el Sandbox de Vonage, autorizar los teléfonos del equipo con `PASS_PHRASE` y armar el QR/enlace de WhatsApp al número del Sandbox | Un teléfono de prueba recibe respuesta |
| 3 | Pedir la MAP_KEY de FIRMS | La clave responde un `area` de prueba |
| 4 | Guion del pitch y demo de 3 minutos, con el mensaje de impacto en turismo y economías regionales | Ensayo cronometrado |
| 14 | Integración, PR y prueba final de punta a punta | Flujo completo de dato a aviso en el celular |

### 6.2 Agustín · API de Next

| # | Tarea | Listo cuando |
| --- | --- | --- |
| 5 | Traza GeoJSON del tren, pueblos y helpers geoespaciales (`lib/geo.ts`) | Función de distancia punto a traza probada |
| 6 | `GET /api/telemetry` con datos simulados | Devuelve el JSON del contrato |
| 7 | `GET /api/weather` (proxy de Open-Meteo con caché) y `GET /api/fires` (FIRMS con respaldo en fixture) | Ambos responden sin internet usando fixtures |
| 8 | `GET /api/alerts`: motor de reglas de crecida, fuego y aglomeración | Genera al menos una alerta por regla con datos de ejemplo |
| 9 | `POST /api/whatsapp` (webhook entrante de Vonage con validación de firma) y `POST /api/notify` | Un mensaje "alertas" devuelve la lista actual |

### 6.3 Blas · front 3D

| # | Tarea | Listo cuando |
| --- | --- | --- |
| 10 | Consumir `/api/telemetry` y `/api/alerts` con mocks hasta que la API esté lista | El front corre con datos mock y con la API real cambiando una variable |
| 11 | Tren sobre la traza en la escena 3D y marcadores de alertas por pueblo | Una alerta nueva aparece en la escena |
| 12 | Panel de alertas con severidad y suscripción (número de WhatsApp y pueblo) con el QR del Sandbox y la frase de acceso a la vista | Alguien se suscribe desde la pantalla |
| 13 | Botón "simular mensaje" para la demo si falla la conectividad | La demo corre sin WhatsApp real |

### 6.4 Reglas de repo

- Dependencias con versión exacta y sin vulnerabilidades conocidas. El proyecto ya trae `save-exact=true` en `.npmrc`.
- Las claves van en `.env`, nunca en el repo (ver [Configuración y secretos](#4-configuración-y-secretos)).

## 7. Orden de trabajo

El camino crítico es contrato, API con fixtures, front sobre la API y recién después WhatsApp real. Cada paso deja algo demostrable.

1. Contrato y tipos compartidos aprobados (tarea 1). Mientras tanto, Leo resuelve el Sandbox de Vonage y la cuenta de FIRMS (2 y 3).
2. API con datos simulados y fixtures (5 a 8) y front sobre mocks (10 y 11), en paralelo.
3. Front apuntando a la API real y panel de alertas (12).
4. Webhook y avisos por WhatsApp (9), con el botón de simulación como respaldo (13).
5. Integración, ensayo del pitch y PR (4 y 14).

## 8. Riesgos

| Riesgo | Qué hacemos |
| --- | --- |
| Internet inestable en la Quebrada | Fixtures guardados de cada API y caché en las rutas; el front corre con mocks |
| Vonage no puede llamar a `localhost` | Exponer el webhook con un túnel (ngrok o cloudflared) o usar el botón "simular mensaje" |
| Cada tester debe autorizarse en el Sandbox | QR y `PASS_PHRASE` en pantalla y en el pitch; probar antes con los tres teléfonos del equipo |
| La MAP_KEY de FIRMS tarda o falla | Usar el fixture de focos de calor y avisar en la demo que es un ejemplo |
| El alcance crece | Imágenes satelitales y base de datos quedan fuera hasta que el flujo completo funcione |

## 9. Preguntas abiertas

- Cuál de `MASTER_KEY` y `VONAGE_API_KEY` es la clave de API y cuál el secreto (ver [Variables](#41-variables)).
- Con qué secreto se valida la firma del webhook. Si Vonage usa un secreto de firma distinto de las credenciales de la cuenta, hace falta una variable más.
- Quién es el dueño del repo `jujuy-pay` para aprobar el PR.
- Si la demo incluye teléfonos reales del jurado.
