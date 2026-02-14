// ESM loader hooks — resolve + load
// These run on every import in the process so fast-path bailouts matter.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transformCode, isTypeScriptFile } from '../utils/transform.ts';
import { inlineSourceMap } from '../utils/source-map.ts';

const JS_TO_TS: Record<string, string[]> = {
  '.js': ['.ts', '.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
};
const TS_EXTS = ['.ts', '.tsx', '.mts', '.cts'];

let pathsMatcher: ((s: string) => string[]) | null | undefined;

function getPathsMatcher(): ((s: string) => string[]) | null {
  if (pathsMatcher !== undefined) return pathsMatcher;
  const tsconfigPath = process.env.XX_TSCONFIG_PATH;
  if (!tsconfigPath) {
    pathsMatcher = null;
    return null;
  }
  try {
    const { getTsconfig, createPathsMatcher } = require('get-tsconfig');
    const config = getTsconfig(tsconfigPath);
    pathsMatcher = config ? createPathsMatcher(config) : null;
  } catch {
    pathsMatcher = null;
  }
  return pathsMatcher;
}

export async function resolve(
  specifier: string,
  context: { parentURL?: string; conditions: string[] },
  nextResolve: Function,
): Promise<{ url: string; shortCircuit?: boolean; format?: string }> {

  // builtins and data: urls don't need us
  if (specifier.startsWith('node:') || specifier.startsWith('data:')) {
    return nextResolve(specifier, context);
  }

  // try as-is first — this handles all node_modules, existing .js files, etc
  try {
    return await nextResolve(specifier, context);
  } catch (error: any) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  }

  // import failed — try ts alternatives

  // tsconfig paths
  if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('file:')) {
    const matcher = getPathsMatcher();
    if (matcher) {
      const matches = matcher(specifier);
      for (const match of matches) {
        try { return await nextResolve(match, context); } catch {}
        for (const ext of TS_EXTS) {
          try { return await nextResolve(match + ext, context); } catch {}
        }
        for (const ext of TS_EXTS) {
          try { return await nextResolve(match + '/index' + ext, context); } catch {}
        }
      }
    }
  }

  // .js → .ts remapping
  const dotIdx = specifier.lastIndexOf('.');
  if (dotIdx >= 0) {
    const ext = specifier.slice(dotIdx);
    const tsAlts = JS_TO_TS[ext];
    if (tsAlts) {
      const base = specifier.slice(0, dotIdx);
      for (const tsExt of tsAlts) {
        try { return await nextResolve(base + tsExt, context); } catch {}
      }
    }
  }

  // extensionless
  for (const ext of TS_EXTS) {
    try { return await nextResolve(specifier + ext, context); } catch {}
  }

  // directory/index
  for (const ext of TS_EXTS) {
    try { return await nextResolve(specifier + '/index' + ext, context); } catch {}
  }

  throw new Error(`[xx] Cannot resolve '${specifier}'${context.parentURL ? ` from '${context.parentURL}'` : ''}`);
}

export async function load(
  url: string,
  context: { format?: string; conditions: string[] },
  nextLoad: Function,
): Promise<{ format: string; source: string; shortCircuit?: boolean }> {

  if (!url.startsWith('file:')) {
    return nextLoad(url, context);
  }

  const filePath = fileURLToPath(url);

  if (!isTypeScriptFile(filePath)) {
    return nextLoad(url, context);
  }

  const source = readFileSync(filePath, 'utf-8');
  const result = transformCode(filePath, source, true);

  let code = result.code;
  if (result.map) {
    code = inlineSourceMap(code, result.map);
  }

  let format = context.format || 'module';
  if (filePath.endsWith('.cts')) {
    format = 'commonjs';
  } else if (filePath.endsWith('.mts')) {
    format = 'module';
  }

  return { format, source: code, shortCircuit: true };
}
