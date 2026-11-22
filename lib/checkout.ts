import { convertArs } from "./fx";
import { markPaid, orders } from "./orders";
import { chargeCurrency, createPayment, mp, PAY_METHODS, stellar, stripe, type Order, type PayMethod, type PayResult } from "./payments/index";

export interface PricedListing {
  id: string;
  title: string;
  priceArs: number;
  communityShare: number;
}

export interface CheckoutInput {
  items: Array<{ id: string; qty: number }>;
  method: PayMethod;
  currency?: string;
}

export type BuildResult = { ok: true; order: Order } | { ok: false; error: string };

export const MAX_QTY = 20;
export const MAX_LINES = 30;

export function parseCheckoutBody(body: unknown): CheckoutInput | null {
  if (!body || typeof body !== "object") return null;
  const { items, method, currency } = body as { items?: unknown; method?: unknown; currency?: unknown };
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINES) return null;
  if (typeof method !== "string" || !PAY_METHODS.includes(method as PayMethod)) return null;
  const parsed: CheckoutInput["items"] = [];
  for (const item of items) {
    const { id, qty } = (item ?? {}) as { id?: unknown; qty?: unknown };
    if (typeof id !== "string" || !Number.isInteger(qty) || (qty as number) < 1 || (qty as number) > MAX_QTY) return null;
    parsed.push({ id, qty: qty as number });
  }
  return { items: parsed, method: method as PayMethod, currency: typeof currency === "string" ? currency.toUpperCase() : undefined };
}

/** El precio sale siempre del catálogo del servidor: lo que mande el navegador no cuenta. */
export async function buildOrder(input: CheckoutInput, lookup: (id: string) => PricedListing | undefined): Promise<BuildResult> {
  const merged = new Map<string, number>();
  for (const item of input.items) merged.set(item.id, (merged.get(item.id) ?? 0) + item.qty);

  const lines: Order["lines"] = [];
  let totalArs = 0;
  let communityArs = 0;
  for (const [id, qty] of merged) {
    const listing = lookup(id);
    if (!listing) return { ok: false, error: `El ítem ${id} no está en el catálogo de pago.` };
    lines.push({ listingId: id, title: listing.title, qty, priceArs: listing.priceArs });
    totalArs += listing.priceArs * qty;
    communityArs += listing.priceArs * qty * listing.communityShare;
  }

  const currency = chargeCurrency(input.method, input.currency);
  const amount = await convertArs(totalArs, currency);
  return {
    ok: true,
    order: {
      id: orders.newId(),
      lines,
      totalArs,
      communityArs: Math.round(communityArs),
      method: input.method,
      currency,
      amount: currency === "ARS" ? totalArs : Math.round(amount * 100) / 100,
      status: "pending",
      live: false,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function startPayment(order: Order): Promise<PayResult> {
  const result = await createPayment(order);
  order.live = result.live;
  order.providerRef = result.providerRef;
  orders.put(order);
  return result;
}

export interface OrderStatus {
  id: string;
  status: "pending" | "paid";
  live: boolean;
}

/**
 * Estado de una orden. Si no es en vivo no hay a quién preguntar y queda pendiente hasta simular.
 * Con Mercado Pago se busca por referencia aunque esta instancia no recuerde la orden.
 */
export async function resolveStatus(id: string, opts: { sessionId?: string } = {}): Promise<OrderStatus | null> {
  const order = orders.get(id);
  if (order?.status === "paid") return { id, status: "paid", live: order.live };

  if (opts.sessionId) {
    const paidId = await stripe.verifySession(opts.sessionId);
    if (paidId === id) {
      markPaid(id, opts.sessionId);
      return { id, status: "paid", live: true };
    }
  }
  if (!order || order.method === "mp") {
    const paymentId = await mp.findApproved(id);
    if (paymentId) {
      markPaid(id, paymentId);
      return { id, status: "paid", live: true };
    }
  }
  if (order?.method === "stellar") {
    const hash = await stellar.findPayment(order);
    if (hash) {
      markPaid(id, hash);
      return { id, status: "paid", live: true };
    }
  }
  return order ? { id, status: order.status, live: order.live } : null;
}
