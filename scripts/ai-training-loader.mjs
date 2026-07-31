import { access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context, nextResolve);
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.')) throw error;
    const parentPath = fileURLToPath(context.parentURL);
    const base = pathResolve(dirname(parentPath), specifier);
    for (const candidate of [`${base}.js`, pathResolve(base, 'index.js')]) {
      try {
        await access(candidate);
        return { shortCircuit: true, url: pathToFileURL(candidate).href };
      } catch {
        continue;
      }
    }
    throw error;
  }
}
