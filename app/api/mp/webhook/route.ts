import type { NextRequest } from "next/server";
import { markPaid } from "@/lib/orders";
import { mp } from "@/lib/payments";

/**
 * Mercado Pago avisa con `?type=payment&data.id=...` o con un JSON `{ type, data: { id } }`.
 * Nunca se confía en el aviso: se pide el pago a la API con el token y se mira el estado.
 */
export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  const body = (await request.json().catch(() => null)) as { type?: string; data?: { id?: string | number } } | null;
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body?.type;
  const paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? body?.data?.id;

  if (type === "payment" && paymentId) {
    const orderId = await mp.verifyPayment(String(paymentId)).catch(() => null);
    if (orderId) markPaid(orderId, String(paymentId));
  }
  return new Response(null, { status: 200 });
}
