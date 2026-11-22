/**
 * Suscripciones a avisos por WhatsApp y registro de avisos ya enviados.
 * Por ahora viven en memoria del proceso; la capa de repositorio (tarea 18) las pasará a MongoDB
 * con la misma interfaz.
 */

export interface Subscription {
  phone: string;
  townId: string;
  createdAt: string; // ISO 8601
}

export interface SubscriptionStore {
  /** `created` es false si el teléfono ya estaba suscripto a ese pueblo. */
  subscribe(phone: string, townId: string, now?: Date): { created: boolean };
  /** Baja de todos los pueblos del teléfono. Devuelve cuántas suscripciones borró. */
  unsubscribe(phone: string): number;
  townsOf(phone: string): string[];
  subscribersOf(townId: string): string[];
  list(): Subscription[];
  /** Marca el aviso como enviado a ese teléfono; false si ya se había enviado. */
  markSent(phone: string, dedupeKey: string): boolean;
  /** Olvida un envío marcado, por ejemplo si después falló. */
  unmarkSent(phone: string, dedupeKey: string): void;
}

export function createSubscriptionStore(): SubscriptionStore {
  const byKey = new Map<string, Subscription>();
  const sent = new Set<string>();
  const key = (phone: string, townId: string) => `${phone}:${townId}`;

  return {
    subscribe(phone, townId, now = new Date()) {
      if (byKey.has(key(phone, townId))) return { created: false };
      byKey.set(key(phone, townId), { phone, townId, createdAt: now.toISOString() });
      return { created: true };
    },
    unsubscribe(phone) {
      let removed = 0;
      for (const [id, subscription] of byKey) {
        if (subscription.phone === phone) {
          byKey.delete(id);
          removed++;
        }
      }
      return removed;
    },
    townsOf(phone) {
      return [...byKey.values()].filter((item) => item.phone === phone).map((item) => item.townId);
    },
    subscribersOf(townId) {
      return [...byKey.values()].filter((item) => item.townId === townId).map((item) => item.phone);
    },
    list() {
      return [...byKey.values()];
    },
    markSent(phone, dedupeKey) {
      const id = `${phone}|${dedupeKey}`;
      if (sent.has(id)) return false;
      sent.add(id);
      return true;
    },
    unmarkSent(phone, dedupeKey) {
      sent.delete(`${phone}|${dedupeKey}`);
    },
  };
}

// En `next dev` los módulos se recargan; guardarlo en globalThis evita perder las suscripciones.
const shared = globalThis as typeof globalThis & { __subscriptions?: SubscriptionStore };

export const subscriptions: SubscriptionStore = (shared.__subscriptions ??= createSubscriptionStore());
