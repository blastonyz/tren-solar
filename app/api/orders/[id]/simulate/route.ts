import { markPaid, orders } from "@/lib/orders";

/** Confirma un pago de prueba. Solo funciona con órdenes que no son en vivo (sin claves del proveedor). */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const order = orders.get(id);
  if (!order) return Response.json({ error: "Orden no encontrada." }, { status: 404 });
  if (order.live) return Response.json({ error: "Esta orden se paga en el proveedor." }, { status: 409 });
  markPaid(id, "simulado");
  return Response.json({ id, status: "paid", live: false });
}
