import assert from "node:assert/strict";
import { test } from "node:test";
import { createSubscriptionStore } from "../lib/subscriptions";
import type { Alert } from "../lib/types";
import { HELP_TEXT, handleCommand, parseCommand } from "../lib/whatsapp";

const alert = (townId: string, town: string, severity: Alert["severity"] = "warning"): Alert => ({
  id: `flood:${townId}`,
  dedupeKey: `flood:${townId}:${severity}:2026-11-22T12`,
  kind: "flood",
  severity,
  townId,
  town,
  message: `Lluvia fuerte en ${town}.`,
  location: { lat: 0, lng: 0 },
  issuedAt: "2026-11-22T15:00:00Z",
  source: "open-meteo",
});

const ALERTS = [alert("humahuaca", "Humahuaca", "critical"), alert("tilcara", "Tilcara")];

const context = (store = createSubscriptionStore()) => ({
  phone: "5493884123456",
  store,
  getAlerts: async () => ALERTS,
});

test("parseCommand entiende mayúsculas, acentos y espacios de más", () => {
  assert.deepEqual(parseCommand("  ALERTAS "), { kind: "alerts", townQuery: undefined });
  assert.deepEqual(parseCommand("Alertas   Maimará"), { kind: "alerts", townQuery: "maimara" });
  assert.deepEqual(parseCommand("suscribir Tilcara"), { kind: "subscribe", townQuery: "tilcara" });
  assert.deepEqual(parseCommand("Baja"), { kind: "unsubscribe" });
  assert.deepEqual(parseCommand("hola"), { kind: "help" });
});

test('"alertas" devuelve la lista actual', async () => {
  const reply = await handleCommand("alertas", context());
  assert.match(reply, /^Alertas vigentes \(2\):/);
  assert.match(reply, /CRÍTICA · Humahuaca/);
  assert.match(reply, /Atención · Tilcara/);
});

test('"alertas <pueblo>" filtra y avisa si no hay o si el pueblo no existe', async () => {
  assert.match(await handleCommand("alertas tilcara", context()), /en Tilcara \(1\)/);
  assert.equal(await handleCommand("alertas uquia", context()), "No hay alertas vigentes en Uquía.");
  assert.match(await handleCommand("alertas salta", context()), /No conozco "salta"/);
});

test('"suscribir" y "baja" cambian las suscripciones', async () => {
  const store = createSubscriptionStore();
  const ctx = context(store);

  assert.match(await handleCommand("suscribir", ctx), /De qué pueblo/);
  assert.match(await handleCommand("suscribir tilcara", ctx), /^Listo, te aviso de las alertas de Tilcara\./);
  assert.match(await handleCommand("suscribir Tilcara", ctx), /^Ya estabas suscripto/);
  assert.deepEqual(store.subscribersOf("tilcara"), ["5493884123456"]);

  assert.match(await handleCommand("baja", ctx), /ya no vas a recibir/);
  assert.deepEqual(store.subscribersOf("tilcara"), []);
  assert.equal(await handleCommand("baja", ctx), "No tenías avisos activos.");
});

test("un mensaje desconocido devuelve la ayuda", async () => {
  assert.equal(await handleCommand("hola", context()), HELP_TEXT);
});
