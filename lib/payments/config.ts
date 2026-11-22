const env = (key: string, fallback = "") => (process.env[key] ?? fallback).trim();

/** Lee el entorno en cada llamada para que los tests y el dev server vean los cambios. */
export const payConfig = () => {
  const network = env("STELLAR_NETWORK", "testnet");
  return {
    publicUrl: env("APP_BASE_URL", env("PUBLIC_URL", "http://localhost:3000")).replace(/\/$/, ""),
    mpToken: env("MP_ACCESS_TOKEN"),
    stripeKey: env("STRIPE_SECRET_KEY"),
    stellar: {
      network,
      merchant: env("STELLAR_MERCHANT_ADDRESS"),
      usdcIssuer: env("STELLAR_USDC_ISSUER", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"),
      horizon: network === "public" ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org",
    },
  };
};

export const live = {
  mp: () => Boolean(payConfig().mpToken),
  stripe: () => Boolean(payConfig().stripeKey),
  stellar: () => Boolean(payConfig().stellar.merchant),
};
