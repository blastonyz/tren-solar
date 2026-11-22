import type { NextRequest } from "next/server";
import { resolveStatus } from "@/lib/checkout";

/** Estado de una orden. Después de Stripe se llama con `?session_id=` para confirmarla. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? undefined;
  const status = await resolveStatus(id, { sessionId });
  if (!status) return Response.json({ error: "Orden no encontrada." }, { status: 404 });
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}
