/**
 * Caché en memoria del proceso de Next, con vencimiento por entrada.
 * Alcanza para la demo (un solo proceso). No se comparte entre instancias.
 */

interface Entry {
  value: unknown;
  expiresAt: number;
}

const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();

export interface Loaded<T> {
  value: T;
  /** Cuánto vale este resultado. Un respaldo conviene que venza antes que un dato real. */
  ttlMs: number;
}

/** Devuelve el valor guardado si sigue vigente; si no, lo carga una sola vez aunque haya pedidos en paralelo. */
export async function remember<T>(key: string, load: () => Promise<Loaded<T>>): Promise<T> {
  const entry = entries.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value as T;

  const running = pending.get(key);
  if (running) return running as Promise<T>;

  const promise = load()
    .then(({ value, ttlMs }) => {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => pending.delete(key));

  pending.set(key, promise);
  return promise;
}

export function clearCache(): void {
  entries.clear();
  pending.clear();
}
