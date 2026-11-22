// Stripe Checkout para tarjetas del exterior. Sin SDK: la API REST alcanza.
import { live, payConfig } from "./config";
import type { Order, PayResult } from "./types";

const API = "https://api.stripe.com/v1";
const headers = () => ({ Authorization: `Bearer ${payConfig().stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" });

export async function create(order: Order, baseUrl?: string): Promise<PayResult> {
  if (!live.stripe()) return { url: null, live: false };
  const publicUrl = baseUrl ?? payConfig().publicUrl;
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": order.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(Math.round(order.amount * 100)),
    "line_items[0][price_data][product_data][name]": `Viaje por la Quebrada (${order.id})`,
    client_reference_id: order.id,
    success_url: `${publicUrl}/?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${publicUrl}/?order=${order.id}`,
  });
  const response = await fetch(`${API}/checkout/sessions`, { method: "POST", headers: headers(), body: form });
  const json = (await response.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(`Stripe ${response.status}: ${json.error?.message ?? ""}`);
  return { url: json.url ?? null, live: true, providerRef: json.id };
}

/** Devuelve el id de la orden si la sesión está pagada. */
export async function verifySession(sessionId: string): Promise<string | null> {
  if (!live.stripe()) return null;
  const response = await fetch(`${API}/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: headers() });
  if (!response.ok) return null;
  const session = (await response.json()) as { payment_status?: string; client_reference_id?: string };
  return session.payment_status === "paid" && session.client_reference_id ? String(session.client_reference_id) : null;
}
