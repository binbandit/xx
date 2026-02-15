#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────
# xx benchmark suite
#
# Two sections:
#
#   1. END-TO-END (CLI → script exit)
#      Measures what the user actually experiences: `xx file.ts`
#      Both tsx and xx spawn a child process, so this includes CLI
#      startup + child spawn + loader init + transform + execution.
#
#   2. HOOKS-ONLY (loader overhead, no CLI)
#      Isolates the loader/transform performance by running:
#        node --import <loader> file.ts
#      This removes the CLI process entirely and measures only the
#      cost of the module hooks + Oxc/esbuild transforms.
#      This is where the real engine difference shows.
#
# Three runners:
#   node --strip-types  (Node.js built-in baseline, zero overhead)
#   tsx                 (incumbent, esbuild-powered)
#   xx                  (challenger, Rolldown/Oxc-powered)
#
# Requirements: hyperfine, tsx, xx (built)
# ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES="$SCRIPT_DIR/fixtures"
RESULTS_DIR="$SCRIPT_DIR/results"

XX_CLI="$ROOT/dist/cli.mjs"
XX_LOADER="$ROOT/dist/loader.mjs"
TSX_CLI="$ROOT/node_modules/.bin/tsx"
TSX_LOADER="$ROOT/node_modules/tsx/dist/loader.mjs"

WARMUP=3
RUNS=30

mkdir -p "$RESULTS_DIR"

NODE_V=$(node --version)
TSX_V=$(pnpm tsx --version 2>/dev/null | head -1)

echo ""
echo "================================================================"
echo "  xx benchmark suite"
echo "================================================================"
echo "  node     $NODE_V"
echo "  tsx      $TSX_V"
echo "  xx       v0.1.0  (rolldown/oxc)"
echo "  hyperfine $(hyperfine --version)"
echo "  warmup   $WARMUP    runs   $RUNS"
echo "  date     $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "  machine  $(uname -ms)"
echo "================================================================"
echo ""

# ── Section 1: End-to-end (what the user types) ───────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  SECTION 1: END-TO-END  (full CLI → exit)              ║"
echo "╚══════════════════════════════════════════════════════════╝"

run_e2e() {
  local name="$1"
  local fixture="$2"
  local node_cmd="$3"
  local json_out="$RESULTS_DIR/e2e-${name}.json"

  echo ""
  echo "── $name ──"

  hyperfine \
    --warmup "$WARMUP" \
    --runs "$RUNS" \
    --export-json "$json_out" \
    --style full \
    -n "node (built-in)" "$node_cmd" \
    -n "tsx"             "$TSX_CLI $fixture" \
    -n "xx"              "node $XX_CLI $fixture"
}

run_e2e "01-hello" \
  "$FIXTURES/01-hello.ts" \
  "node --strip-types $FIXTURES/01-hello.ts"

run_e2e "02-types-heavy" \
  "$FIXTURES/02-types-heavy.ts" \
  "node --strip-types $FIXTURES/02-types-heavy.ts"

run_e2e "03-enum-heavy" \
  "$FIXTURES/03-enum-heavy.ts" \
  "node --experimental-transform-types $FIXTURES/03-enum-heavy.ts"

run_e2e "04-import-chain" \
  "$FIXTURES/04-import-chain.ts" \
  "node --strip-types $FIXTURES/04-import-chain.ts"

run_e2e "05-many-modules" \
  "$FIXTURES/05-many-modules/index.ts" \
  "node --strip-types $FIXTURES/05-many-modules/index.ts"


# ── Section 2: Hooks-only (isolate the transform engine) ──────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  SECTION 2: HOOKS-ONLY  (loader overhead, no CLI)      ║"
echo "║  Command: node --import <loader> file.ts                ║"
echo "║  This isolates Oxc vs esbuild transform performance.    ║"
echo "╚══════════════════════════════════════════════════════════╝"

run_hooks() {
  local name="$1"
  local fixture="$2"
  local node_cmd="$3"
  local json_out="$RESULTS_DIR/hooks-${name}.json"

  echo ""
  echo "── $name ──"

  hyperfine \
    --warmup "$WARMUP" \
    --runs "$RUNS" \
    --export-json "$json_out" \
    --style full \
    -n "node (built-in)" "$node_cmd" \
    -n "tsx hooks (esbuild)"  "node --no-strip-types --import $TSX_LOADER $fixture" \
    -n "xx hooks (oxc)"       "node --no-strip-types --import $XX_LOADER $fixture"
}

run_hooks "01-hello" \
  "$FIXTURES/01-hello.ts" \
  "node --strip-types $FIXTURES/01-hello.ts"

run_hooks "02-types-heavy" \
  "$FIXTURES/02-types-heavy.ts" \
  "node --strip-types $FIXTURES/02-types-heavy.ts"

run_hooks "03-enum-heavy" \
  "$FIXTURES/03-enum-heavy.ts" \
  "node --experimental-transform-types $FIXTURES/03-enum-heavy.ts"

run_hooks "04-import-chain" \
  "$FIXTURES/04-import-chain.ts" \
  "node --strip-types $FIXTURES/04-import-chain.ts"

run_hooks "05-many-modules" \
  "$FIXTURES/05-many-modules/index.ts" \
  "node --strip-types $FIXTURES/05-many-modules/index.ts"


# ── Summary ────────────────────────────────────────────────────

echo ""
echo "================================================================"
echo "  Results saved to: $RESULTS_DIR/"
echo "================================================================"
echo ""
ls -la "$RESULTS_DIR"/*.json
