import { randomBytes } from "node:crypto";
import type { Order } from "./payments/types";

/**
 * Órdenes en memoria. En serverless cada instancia tiene la suya, así que el estado de pago nunca se
 * decide acá: se consulta al proveedor (Mercado Pago, Stripe, Horizon). Esto se mueve a Mongo con la tarea 18.
 */
const globalStore = globalThis as unknown as { __orders?: Map<string, Order> };
const store = (globalStore.__orders ??= new Map<string, Order>());

export const orders = {
  get: (id: string) => store.get(id),
  put: (order: Order) => {
    store.set(order.id, order);
    return order;
  },
  newId: () => `TS${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`,
};

export function markPaid(id: string, providerRef?: string): Order | undefined {
  const order = store.get(id);
  if (!order || order.status === "paid") return order;
  order.status = "paid";
  order.paidAt = new Date().toISOString();
  if (providerRef) order.providerRef = providerRef;
  return order;
}
