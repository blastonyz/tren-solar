import type { NextRequest } from "next/server";
import { TOWNS, findTown } from "@/lib/route";
import { subscriptions } from "@/lib/subscriptions";
import { normalizePhone } from "@/lib/vonage";

/** Registra un número de WhatsApp para recibir las alertas de un pueblo. Cuerpo: `{ phone, town }`. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { phone?: unknown; town?: unknown } | null;
  const phone = typeof body?.phone === "string" ? normalizePhone(body.phone) : null;
  if (!phone) {
    return Response.json(
      { error: "Número inválido. Usá el formato internacional, por ejemplo +5493884123456." },
      { status: 400 },
    );
  }
  const town = typeof body?.town === "string" ? findTown(body.town) : undefined;
  if (!town) {
    return Response.json(
      { error: "Pueblo inválido.", towns: TOWNS.map((item) => item.id) },
      { status: 400 },
    );
  }

  const { created } = subscriptions.subscribe(phone, town.id);
  return Response.json({ phone, townId: town.id, town: town.name, created }, { status: created ? 201 : 200 });
}
