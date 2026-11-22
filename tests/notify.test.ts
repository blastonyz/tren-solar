import assert from "node:assert/strict";
import { test } from "node:test";
import { notifyAlerts } from "../lib/notify";
import { createSubscriptionStore } from "../lib/subscriptions";
import type { Alert } from "../lib/types";
import type { SendResult } from "../lib/vonage";

const alert = (townId: string, dedupeKey: string): Alert => ({
  id: dedupeKey,
  dedupeKey,
  kind: "fire",
  severity: "warning",
  townId,
  town: townId,
  message: "Foco de calor.",
  location: { lat: 0, lng: 0 },
  issuedAt: "2026-11-22T15:00:00Z",
  source: "firms",
  simulated: true,
});

function recorder(fail: string[] = []) {
  const sent: Array<{ to: string; text: string }> = [];
  const send = async (to: string, text: string): Promise<SendResult> => {
    sent.push({ to, text });
    return fail.includes(to)
      ? { to, sent: false, simulated: false, error: "falló" }
      : { to, sent: true, simulated: false };
  };
  return { sent, send };
}

test("cada alerta va solo a los suscriptos de su pueblo y una sola vez", async () => {
  const store = createSubscriptionStore();
  store.subscribe("111111111", "tilcara");
  store.subscribe("222222222", "tilcara");
  store.subscribe("333333333", "humahuaca");
  const alerts = [alert("tilcara", "fire:tilcara"), alert("uquia", "fire:uquia")];
  const { sent, send } = recorder();

  const first = await notifyAlerts(alerts, { store, send, intervalMs: 0 });
  assert.equal(first.sent, 2);
  assert.deepEqual(sent.map((item) => item.to), ["111111111", "222222222"]);
  assert.match(sent[0].text, /^Aviso Tren Solar\nAtención · tilcara: Foco de calor\. \(dato de ejemplo\)$/);

  const second = await notifyAlerts(alerts, { store, send, intervalMs: 0 });
  assert.equal(second.sent, 0);
  assert.equal(second.skipped, 2);
  assert.equal(sent.length, 2);
});

test("un envío fallido se reintenta la próxima vez", async () => {
  const store = createSubscriptionStore();
  store.subscribe("111111111", "tilcara");
  const alerts = [alert("tilcara", "fire:tilcara")];

  const failing = recorder(["111111111"]);
  assert.equal((await notifyAlerts(alerts, { store, send: failing.send, intervalMs: 0 })).failed, 1);

  const working = recorder();
  assert.equal((await notifyAlerts(alerts, { store, send: working.send, intervalMs: 0 })).sent, 1);
});
