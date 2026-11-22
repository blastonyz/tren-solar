import type { NextRequest } from "next/server";
import { TOWNS, findTown } from "@/lib/route";
import { getWeather } from "@/lib/weather";

/** Lluvia y viento de las próximas 48 horas. Con `?town=` devuelve un solo pueblo. */
export async function GET(request: NextRequest) {
  const wanted = request.nextUrl.searchParams.get("town");
  const town = wanted ? findTown(wanted) : undefined;
  if (wanted && !town) {
    return Response.json(
      { error: `No conozco el pueblo "${wanted}".`, towns: TOWNS.map((item) => item.id) },
      { status: 400 },
    );
  }

  try {
    const weather = await getWeather();
    return Response.json(
      town ? { ...weather, towns: weather.towns.filter((item) => item.townId === town.id) } : weather,
    );
  } catch (error) {
    console.error("[weather]", error);
    return Response.json({ error: "No hay datos de clima disponibles." }, { status: 503 });
  }
}
