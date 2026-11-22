// Permite que Node (pruebas y scripts) cargue el código de la app tal como lo escribe Next:
// imports relativos sin extensión y el alias "@/". Se usa con `node --import`.
import { statSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isAlias = specifier.startsWith("@/");
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");

    if ((isAlias || isRelative) && context.parentURL?.startsWith("file:")) {
      const base = isAlias
        ? resolvePath(root, specifier.slice(2))
        : resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
      const file = [base, `${base}.ts`, `${base}.tsx`].find(
        (candidate) => statSync(candidate, { throwIfNoEntry: false })?.isFile(),
      );
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }

    return nextResolve(specifier, context);
  },
});
