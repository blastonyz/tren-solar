// Mercado Pago Checkout Pro (pesos). Con un token TEST- usa el sandbox_init_point.
import { live, payConfig } from "./config";
import type { Order, PayResult } from "./types";

const API = "https://api.mercadopago.com";
const headers = () => ({ Authorization: `Bearer ${payConfig().mpToken}`, "Content-Type": "application/json" });

export async function create(order: Order, baseUrl?: string): Promise<PayResult> {
  if (!live.mp()) return { url: null, live: false };
  const { mpToken } = payConfig();
  const publicUrl = baseUrl ?? payConfig().publicUrl;
  const body = {
    items: [
      {
        id: order.id,
        title: `Viaje por la Quebrada (${order.lines.length} ${order.lines.length === 1 ? "ítem" : "ítems"})`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: order.totalArs,
      },
    ],
    external_reference: order.id,
    ...(publicUrl.startsWith("https://") ? { notification_url: `${publicUrl}/api/mp/webhook` } : {}),
    back_urls: {
      success: `${publicUrl}/?order=${order.id}`,
      failure: `${publicUrl}/?order=${order.id}`,
      pending: `${publicUrl}/?order=${order.id}`,
    },
    // Mercado Pago rechaza auto_return si las back_urls no son públicas (https): en local se omite.
    ...(publicUrl.startsWith("https://") ? { auto_return: "approved" } : {}),
  };
  const response = await fetch(`${API}/checkout/preferences`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const json = (await response.json()) as { id?: string; init_point?: string; sandbox_init_point?: string; message?: string };
  if (!response.ok) throw new Error(`Mercado Pago ${response.status}: ${json.message ?? ""}`);
  const url = mpToken.startsWith("TEST-") ? (json.sandbox_init_point ?? json.init_point) : json.init_point;
  return { url: url ?? null, live: true, providerRef: json.id };
}

/** Devuelve el id de la orden si el pago está aprobado. */
export async function verifyPayment(paymentId: string): Promise<string | null> {
  if (!live.mp()) return null;
  const response = await fetch(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, { headers: headers() });
  if (!response.ok) return null;
  const payment = (await response.json()) as { status?: string; external_reference?: string };
  return payment.status === "approved" && payment.external_reference ? String(payment.external_reference) : null;
}

/** Busca un pago aprobado por el id de orden. Sirve cuando el servidor no recuerda la orden (serverless). */
export async function findApproved(orderId: string): Promise<string | null> {
  if (!live.mp()) return null;
  const url = `${API}/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&status=approved&limit=1`;
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) return null;
  const json = (await response.json()) as { results?: Array<{ id?: number }> };
  const id = json.results?.[0]?.id;
  return id ? String(id) : null;
}
