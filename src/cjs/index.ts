// CJS loader — hooks into require() for TypeScript files

import Module from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { transformCode } from '../utils/transform.ts';
import { inlineSourceMap } from '../utils/source-map.ts';

const extensions = (Module as any)._extensions as Record<string, Function>;
const tsExtensions = ['.ts', '.tsx', '.mts', '.cts'];

function compileTypeScript(module: any, filename: string): void {
  const source = readFileSync(filename, 'utf-8');
  const result = transformCode(filename, source, true);

  let code = result.code;
  if (result.map) {
    code = inlineSourceMap(code, result.map);
  }

  module._compile(code, filename);
}

for (const ext of tsExtensions) {
  extensions[ext] = compileTypeScript;
}

// lazy tsconfig paths

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

const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (
  request: string,
  parent: any,
  isMain: boolean,
  options: any,
) {
  try {
    return originalResolveFilename.call(this, request, parent, isMain, options);
  } catch (error: any) {
    if (error?.code !== 'MODULE_NOT_FOUND') throw error;
  }

  // tsconfig paths — skip for relative, absolute, and node: specifiers
  if (!request.startsWith('.') && !request.startsWith('/') && !request.startsWith('node:') && !/^[A-Za-z]:[\\/]/.test(request)) {
    const matcher = getPathsMatcher();
    if (matcher) {
      const matches = matcher(request);
      for (const match of matches) {
        try { return originalResolveFilename.call(this, match, parent, isMain, options); } catch {}
        for (const ext of tsExtensions) {
          try { return originalResolveFilename.call(this, match + ext, parent, isMain, options); } catch {}
        }
      }
    }
  }

  // .js → .ts
  const ext = path.extname(request);
  const tsAlts: Record<string, string[]> = { '.js': ['.ts', '.tsx'], '.cjs': ['.cts'], '.mjs': ['.mts'] };
  if (tsAlts[ext]) {
    const base = request.slice(0, -ext.length);
    for (const tsExt of tsAlts[ext]!) {
      try { return originalResolveFilename.call(this, base + tsExt, parent, isMain, options); } catch {}
    }
  }

  // extensionless
  for (const tsExt of tsExtensions) {
    try { return originalResolveFilename.call(this, request + tsExt, parent, isMain, options); } catch {}
  }

  // directory/index
  for (const tsExt of tsExtensions) {
    try { return originalResolveFilename.call(this, path.join(request, 'index' + tsExt), parent, isMain, options); } catch {}
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
