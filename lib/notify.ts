import type { SubscriptionStore } from "./subscriptions";
import type { Alert } from "./types";
import { sendWhatsApp, type SendResult } from "./vonage";
import { formatAlert } from "./whatsapp";

/** El Sandbox acepta un mensaje por segundo. */
export const SEND_INTERVAL_MS = 1100;

export interface NotifySummary {
  alerts: number;
  sent: number;
  simulated: number;
  failed: number;
  /** Avisos que ese teléfono ya había recibido (mismo `dedupeKey`). */
  skipped: number;
  results: Array<SendResult & { dedupeKey: string }>;
}

export interface NotifyOptions {
  store: SubscriptionStore;
  send?: (to: string, text: string) => Promise<SendResult>;
  intervalMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Manda cada alerta a los suscriptos de su pueblo, una sola vez por teléfono y `dedupeKey`. */
export async function notifyAlerts(alerts: Alert[], options: NotifyOptions): Promise<NotifySummary> {
  const send = options.send ?? ((to, text) => sendWhatsApp(to, text));
  const intervalMs = options.intervalMs ?? SEND_INTERVAL_MS;
  const summary: NotifySummary = { alerts: alerts.length, sent: 0, simulated: 0, failed: 0, skipped: 0, results: [] };

  let first = true;
  for (const alert of alerts) {
    for (const phone of options.store.subscribersOf(alert.townId)) {
      if (!options.store.markSent(phone, alert.dedupeKey)) {
        summary.skipped++;
        continue;
      }
      if (!first && intervalMs > 0) await sleep(intervalMs);
      first = false;

      const result = await send(phone, `Aviso Tren Solar\n${formatAlert(alert)}`);
      summary.results.push({ ...result, dedupeKey: alert.dedupeKey });
      if (result.sent) summary.sent++;
      else if (result.simulated) summary.simulated++;
      else {
        summary.failed++;
        // Si falló, se puede reintentar en el próximo envío.
        options.store.unmarkSent(phone, alert.dedupeKey);
      }
    }
  }
  return summary;
}
