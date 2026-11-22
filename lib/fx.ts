/**
 * Cotizaciones. Los ARS por USD salen del dólar MEP (lo que paga un turista con tarjeta extranjera)
 * y el resto de las monedas, del cruce contra USD. Si las APIs no responden, se usan valores fijos.
 */

export const FALLBACK_ARS_PER_USD = 1740;
export const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.86,
  BRL: 5.4,
  CLP: 940,
  BOB: 6.9,
  UYU: 40,
  GBP: 0.75,
  PEN: 3.4,
};

interface Rates {
  at: number;
  ttl: number;
  arsPerUsd: number;
  usdRates: Record<string, number>;
  source: string;
}

let cache: Rates | null = null;
const TTL = 10 * 60 * 1000;
const TTL_FALLBACK = 30 * 1000;

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

export async function rates(): Promise<Rates> {
  if (cache && Date.now() - cache.at < cache.ttl) return cache;
  let arsPerUsd = FALLBACK_ARS_PER_USD;
  let usdRates = FALLBACK_USD_RATES;
  let ok = true;
  let source = "dólar MEP de referencia";
  try {
    const mep = (await getJson("https://dolarapi.com/v1/dolares/bolsa")) as { venta?: number };
    if (Number(mep.venta) > 0) {
      arsPerUsd = Number(mep.venta);
      source = "dólar MEP (dolarapi.com)";
    }
  } catch {
    ok = false;
  }
  try {
    const fx = (await getJson("https://open.er-api.com/v6/latest/USD")) as { rates?: Record<string, number> };
    if (fx.rates) usdRates = { ...FALLBACK_USD_RATES, ...fx.rates };
  } catch {
    ok = false;
  }
  cache = { at: Date.now(), ttl: ok ? TTL : TTL_FALLBACK, arsPerUsd, usdRates, source };
  return cache;
}

export async function convertArs(amountArs: number, currency: string): Promise<number> {
  if (currency === "ARS") return amountArs;
  const { arsPerUsd, usdRates } = await rates();
  return (amountArs / arsPerUsd) * (usdRates[currency] ?? 1);
}

const ZERO_DECIMAL = new Set(["CLP", "PYG", "JPY"]);

export function fmtMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: ZERO_DECIMAL.has(currency) || currency === "ARS" ? 0 : 2,
  }).format(amount);
}
