import { transformSync } from 'rolldown/experimental';
import type { TransformResult } from './types.ts';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const JSX_EXTENSIONS = new Set(['.jsx', '.tsx']);

export function isTypeScriptFile(filename: string): boolean {
  const idx = filename.lastIndexOf('.');
  if (idx < 0) return false;
  return TS_EXTENSIONS.has(filename.slice(idx));
}

function isJSX(filename: string): boolean {
  const idx = filename.lastIndexOf('.');
  if (idx < 0) return false;
  return JSX_EXTENSIONS.has(filename.slice(idx));
}

export function transformCode(
  filename: string,
  code: string,
  sourceMap: boolean = true,
): TransformResult {
  const result = transformSync(filename, code, {
    sourcemap: sourceMap,
    jsx: isJSX(filename) ? { runtime: 'automatic' } : undefined,
  } as any);

  if (result.errors && result.errors.length > 0) {
    const err = result.errors[0];
    throw new Error(`[xx] Transform error in ${filename}: ${typeof err === 'string' ? err : JSON.stringify(err)}`);
  }

  return {
    code: result.code,
    map: result.map ?? undefined,
  };
}
