// Benchmark 4: Import chain - measures module resolution overhead
// Tests resolving and transforming multiple imported modules.
import { processUsers } from './lib/process.ts';

const result = processUsers();
console.log('ok');
