import { register } from 'node:module';

// Register ESM hooks in the loader thread
register('./esm/index.mjs', import.meta.url);
