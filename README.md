# xx

Fast TypeScript runner for Node.js. Like [tsx](https://github.com/privatenumber/tsx) but uses [Rolldown/Oxc](https://rolldown.rs) (Rust) instead of esbuild (Go) for transforms.

## Install

```bash
pnpm add xx
```

## Usage

```bash
xx file.ts                       # run a ts file
xx watch server.ts               # watch mode
xx -e "const x: number = 1"      # eval
xx -p "1 + 2"                    # eval + print
xx --test                        # node test runner w/ ts
xx                               # repl
```

All node flags pass through (`--env-file`, `--inspect`, etc).

### As a loader

Skip the CLI overhead entirely:

```bash
node --import xx/loader file.ts
```

## Benchmarks

Measured with [hyperfine](https://github.com/sharkdp/hyperfine) on Node v25.6.1, macOS arm64. 30 runs, 3 warmup.

**Hooks-only** (no CLI process, just the loader — apples-to-apples transform comparison):

| | tsx | xx | |
|---|--:|--:|---|
| 1 file | 177ms | 126ms | 1.4x |
| 5 modules | 193ms | 120ms | 1.6x |
| 100 modules | 303ms | 148ms | **2.1x** |

**E2E** (full `xx file.ts` vs `tsx file.ts`):

| | tsx | xx | |
|---|--:|--:|---|
| 1 file | 190ms | 153ms | 1.2x |
| types-heavy | 208ms | 151ms | 1.4x |
| enums | 207ms | 146ms | 1.4x |
| 5 modules | 171ms | 143ms | 1.2x |
| 100 modules | 226ms | 164ms | 1.4x |

The gap grows with more modules since Oxc's per-file transform cost is way lower than esbuild's (~0.02ms vs ~0.31ms). E2E numbers are closer because both tools pay the same child-process spawn cost.

Run `bash bench/run.sh` to reproduce (needs hyperfine + tsx).

## How it works

Same architecture as tsx — CLI spawns `node --no-strip-types --import <loader> file.ts`, loader registers ESM hooks via `module.register()`, hooks intercept `.ts`/`.tsx`/`.mts`/`.cts` imports and run them through Oxc's `transformSync`. CJS support via `Module._extensions` patching.

We import from `rolldown/utils` instead of `rolldown/experimental` which avoids loading the full bundler engine (~9ms vs ~44ms import time).

Also handles `.js` → `.ts` remapping, extensionless resolution, directory/index resolution, and tsconfig paths (lazy-loaded so there's zero cost if you don't use them).

## Requirements

- Node >= 22.12.0
- Works as a drop-in tsx replacement (same CLI flags, same loader interface)

## License

MIT
