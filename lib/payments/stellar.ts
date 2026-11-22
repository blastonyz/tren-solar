// USDC en Stellar. El turista paga desde su wallet con un link SEP-7 y la orden se identifica por el memo.
import { live, payConfig } from "./config";
import type { Order, PayResult } from "./types";

export function sep7Uri(order: Order): string {
  const { stellar } = payConfig();
  const params = new URLSearchParams({
    destination: stellar.merchant,
    amount: order.amount.toFixed(2),
    asset_code: "USDC",
    asset_issuer: stellar.usdcIssuer,
    memo: order.id,
    memo_type: "MEMO_TEXT",
    msg: `Tren Solar ${order.id}`,
  });
  if (stellar.network !== "public") params.set("network_passphrase", "Test SDF Network ; September 2015");
  return `web+stellar:pay?${params.toString()}`;
}

export async function create(order: Order): Promise<PayResult> {
  if (!live.stellar()) return { url: null, live: false };
  const { stellar } = payConfig();
  return {
    url: null,
    live: true,
    stellar: { uri: sep7Uri(order), destination: stellar.merchant, amount: order.amount.toFixed(2), memo: order.id, network: stellar.network },
  };
}

/** Busca un pago de USDC con el memo de la orden y monto suficiente. Devuelve el hash de la transacción. */
export async function findPayment(order: Order): Promise<string | null> {
  if (!live.stellar()) return null;
  const { stellar } = payConfig();
  const url = `${stellar.horizon}/accounts/${stellar.merchant}/payments?order=desc&limit=50&join=transactions`;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  const json = (await response.json()) as {
    _embedded?: {
      records?: Array<{
        type: string;
        to?: string;
        asset_code?: string;
        asset_issuer?: string;
        amount?: string;
        transaction_hash?: string;
        transaction?: { memo?: string };
      }>;
    };
  };
  for (const record of json._embedded?.records ?? []) {
    if (record.type !== "payment" || record.to !== stellar.merchant) continue;
    if (record.asset_code !== "USDC" || record.asset_issuer !== stellar.usdcIssuer) continue;
    if (record.transaction?.memo !== order.id) continue;
    if (Number(record.amount) + 1e-7 < Number(order.amount.toFixed(2))) continue;
    return record.transaction_hash ?? null;
  }
  return null;
}
