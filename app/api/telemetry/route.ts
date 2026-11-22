import { connection } from "next/server";
import { simulateTelemetry } from "@/lib/telemetry";

/** Posición del tren, pasajeros, energía y ocupación por pueblo. Datos simulados. */
export async function GET() {
  // La respuesta depende de la hora: se arma en cada pedido, nunca en el build.
  await connection();
  return Response.json(simulateTelemetry(new Date()), {
    headers: { "Cache-Control": "no-store" },
  });
}
