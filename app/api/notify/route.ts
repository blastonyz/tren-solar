import type { NextRequest } from "next/server";
import { getCurrentAlerts } from "@/lib/current-alerts";
import { notifyAlerts } from "@/lib/notify";
import { findTown } from "@/lib/route";
import { subscriptions } from "@/lib/subscriptions";

/**
 * Envía las alertas vigentes a los suscriptos de cada pueblo por WhatsApp.
 * Cuerpo opcional: `{ "town": "tilcara" }` para un solo pueblo.
 * Si está `NOTIFY_TOKEN`, pide `Authorization: Bearer <NOTIFY_TOKEN>`.
 */
export async function POST(request: NextRequest) {
  const token = process.env.NOTIFY_TOKEN;
  if (token && request.headers.get("authorization") !== `Bearer ${token}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { town?: unknown };
  const wanted = typeof body.town === "string" && body.town ? body.town : undefined;
  const town = wanted ? findTown(wanted) : undefined;
  if (wanted && !town) {
    return Response.json({ error: `No conozco el pueblo "${wanted}".` }, { status: 400 });
  }

  try {
    const alerts = (await getCurrentAlerts()).filter((alert) => !town || alert.townId === town.id);
    const summary = await notifyAlerts(alerts, { store: subscriptions });
    return Response.json({
      ...summary,
      // Solo los últimos 4 dígitos: la respuesta no expone los teléfonos.
      results: summary.results.map(({ to, ...rest }) => ({ ...rest, to: `...${to.slice(-4)}` })),
    });
  } catch (error) {
    console.error("[notify]", error instanceof Error ? error.message : "error desconocido");
    return Response.json({ error: "No se pudieron enviar los avisos." }, { status: 503 });
  }
}
