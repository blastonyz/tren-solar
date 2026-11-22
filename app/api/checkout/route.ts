import type { NextRequest } from "next/server";
import { LISTINGS_BY_ID } from "@/data/catalog";
import { buildOrder, parseCheckoutBody, startPayment } from "@/lib/checkout";
import { methodLabel } from "@/lib/payments";

/**
 * Crea una orden y el pago. Cuerpo: `{ items: [{ id, qty }], method: "mp" | "stripe" | "stellar", currency? }`.
 * Sin las claves del proveedor responde `live: false` y la orden se confirma con `/api/orders/:id/simulate`.
 */
export async function POST(request: NextRequest) {
  const input = parseCheckoutBody(await request.json().catch(() => null));
  if (!input) {
    return Response.json(
      { error: "Pedido inválido. Mandá items [{ id, qty }] y method: mp, stripe o stellar." },
      { status: 400 },
    );
  }

  const built = await buildOrder(input, (id) => LISTINGS_BY_ID.get(id));
  if (!built.ok) return Response.json({ error: built.error }, { status: 422 });

  try {
    const payment = await startPayment(built.order, request.nextUrl.origin);
    const { order } = built;
    return Response.json(
      {
        orderId: order.id,
        method: order.method,
        methodLabel: methodLabel[order.method],
        currency: order.currency,
        amount: order.amount,
        totalArs: order.totalArs,
        communityArs: order.communityArs,
        live: payment.live,
        url: payment.url,
        stellar: payment.stellar ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[checkout]", error);
    return Response.json({ error: "No pudimos iniciar el pago con ese medio." }, { status: 502 });
  }
}
