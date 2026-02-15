// builds xx — bundles src/ into dist/ using rolldown
// uses rolldown/experimental (not rolldown/experimental) to avoid pulling in the full bundler at runtime

import { build } from 'rolldown';
import path from 'node:path';
import fs from 'node:fs';

const srcDir = path.resolve(import.meta.dirname, '..', 'src');
const distDir = path.resolve(import.meta.dirname, '..', 'dist');

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}

await build({
  input: {
    'cli': path.join(srcDir, 'cli.ts'),
    'loader': path.join(srcDir, 'loader.ts'),
    'esm/index': path.join(srcDir, 'esm/index.ts'),
    'cjs/index': path.join(srcDir, 'cjs/index.ts'),
  },
  output: {
    dir: distDir,
    format: 'esm',
    entryFileNames: '[name].mjs',
    sourcemap: true,
  },
  platform: 'node',
  external: [
    'rolldown/experimental',
    'get-tsconfig',
    /^node:/,
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
  },
});

// add shebang
const cliPath = path.join(distDir, 'cli.mjs');
const cliContent = fs.readFileSync(cliPath, 'utf-8');
if (!cliContent.startsWith('#!')) {
  fs.writeFileSync(cliPath, `#!/usr/bin/env node\n${cliContent}`);
}
fs.chmodSync(cliPath, 0o755);

console.log('\nbuild complete:');
for (const file of fs.readdirSync(distDir, { recursive: true }) as string[]) {
  const fullPath = path.join(distDir, file);
  if (fs.statSync(fullPath).isFile()) {
    const size = fs.statSync(fullPath).size;
    console.log(`  dist/${file} (${(size / 1024).toFixed(1)}KB)`);
  }
}
