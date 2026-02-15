// Generates bench/fixtures/05-many-modules/ with N TypeScript modules
// to benchmark import resolution + transform at scale.

import fs from 'node:fs';
import path from 'node:path';

const N = 100;
const dir = path.join(import.meta.dirname, 'fixtures', '05-many-modules');

if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
fs.mkdirSync(dir, { recursive: true });

// Generate N leaf modules
for (let i = 0; i < N; i++) {
  const code = `
export interface Module${i}Config {
  id: number;
  name: string;
  enabled: boolean;
}

export function compute${i}(input: number): number {
  return input * ${i + 1} + ${i};
}

export const MODULE_${i}_VERSION: string = '1.0.${i}';
`;
  fs.writeFileSync(path.join(dir, `mod${i}.ts`), code);
}

// Generate entry that imports all of them
const imports = Array.from({ length: N }, (_, i) =>
  `import { compute${i} } from './mod${i}.ts';`
).join('\n');

const calls = Array.from({ length: N }, (_, i) =>
  `compute${i}(${i})`
).join(' + ');

const entry = `${imports}

const total: number = ${calls};
console.log('ok');
`;

fs.writeFileSync(path.join(dir, 'index.ts'), entry);
console.log(`Generated ${N} modules in ${dir}`);
