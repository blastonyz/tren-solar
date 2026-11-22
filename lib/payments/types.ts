export type PayMethod = "mp" | "stripe" | "stellar";

export const PAY_METHODS: PayMethod[] = ["mp", "stripe", "stellar"];

export interface OrderLine {
  listingId: string;
  title: string;
  qty: number;
  priceArs: number;
}

export interface Order {
  id: string;
  lines: OrderLine[];
  totalArs: number;
  communityArs: number;
  method: PayMethod;
  /** Moneda en la que se cobra y monto en esa moneda. */
  currency: string;
  amount: number;
  status: "pending" | "paid";
  /** false = pago simulado (faltan las claves del proveedor). */
  live: boolean;
  providerRef?: string;
  createdAt: string;
  paidAt?: string;
}

export interface PayResult {
  /** Link de checkout del proveedor, o null si el pago se hace con wallet (Stellar) o es simulado. */
  url: string | null;
  live: boolean;
  providerRef?: string;
  stellar?: { uri: string; destination: string; amount: string; memo: string; network: string };
}

export const methodLabel: Record<PayMethod, string> = {
  mp: "Mercado Pago",
  stripe: "Tarjeta del exterior",
  stellar: "USDC en Stellar",
};

export const STRIPE_CURRENCIES = ["USD", "EUR", "BRL", "GBP"];

/** Moneda en que se cobra según el medio. Mercado Pago, pesos; USDC, dólares; tarjeta, la del turista si Stripe la acepta. */
export function chargeCurrency(method: PayMethod, preferred = "USD"): string {
  if (method === "mp") return "ARS";
  if (method === "stellar") return "USD";
  return STRIPE_CURRENCIES.includes(preferred) ? preferred : "USD";
}
