import { connection } from "next/server";
import { getFires } from "@/lib/fires";

/** Focos de calor a menos de 25 km de la traza o de un pueblo. */
export async function GET() {
  await connection();
  try {
    return Response.json(await getFires());
  } catch (error) {
    console.error("[fires]", error instanceof Error ? error.message : "error desconocido");
    return Response.json({ error: "No hay datos de focos de calor disponibles." }, { status: 503 });
  }
}
