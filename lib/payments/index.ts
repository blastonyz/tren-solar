import * as mp from "./mercadopago";
import * as stellar from "./stellar";
import * as stripe from "./stripe";
import type { Order, PayResult } from "./types";

export * from "./types";
export { live } from "./config";

export function createPayment(order: Order): Promise<PayResult> {
  switch (order.method) {
    case "mp":
      return mp.create(order);
    case "stripe":
      return stripe.create(order);
    case "stellar":
      return stellar.create(order);
  }
}

export { mp, stellar, stripe };
