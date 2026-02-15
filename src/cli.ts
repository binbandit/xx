#!/usr/bin/env node

// xx — fast tsx alternative using rolldown/oxc
// spawns a child node process with our loader hooks registered via --import

import { spawn, type ChildProcess } from 'node:child_process';
import { constants as osConstants } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { transformSync } from 'rolldown/utils';
import { startWatch } from './watch/index.ts';

const VERSION = '0.1.0';

function resolveLoaderPath(): string {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const mjsPath = dir + 'loader.mjs';
  if (fs.existsSync(mjsPath)) return mjsPath;
  const tsPath = dir + 'loader.ts';
  if (fs.existsSync(tsPath)) return tsPath;
  return mjsPath;
}

interface ParsedArgs {
  command: 'run' | 'watch' | 'version' | 'help' | 'repl';
  script?: string;
  scriptArgs: string[];
  nodeArgs: string[];
  eval?: string;
  print?: string;
  inputType?: string;
  tsconfig?: string;
  noCache: boolean;
  test: boolean;
  clearScreen: boolean;
  watchInclude: string[];
  watchExclude: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: 'run',
    scriptArgs: [],
    nodeArgs: [],
    noCache: false,
    test: false,
    clearScreen: true,
    watchInclude: [],
    watchExclude: [],
  };

  let i = 0;
  let foundScript = false;
  let isWatchMode = false;

  while (i < argv.length) {
    const arg = argv[i]!;

    if (foundScript) {
      result.scriptArgs.push(arg);
      i++;
      continue;
    }

    if (arg === 'watch' && !foundScript) {
      isWatchMode = true;
      result.command = 'watch';
      i++;
      continue;
    }

    if (arg === '--version' || arg === '-v') {
      result.command = 'version';
      return result;
    }
    if (arg === '--help' || arg === '-h') {
      result.command = 'help';
      return result;
    }
    if (arg === '--no-cache') {
      result.noCache = true;
      i++;
      continue;
    }
    if (arg === '--tsconfig' && i + 1 < argv.length) {
      result.tsconfig = argv[++i];
      i++;
      continue;
    }
    if (arg.startsWith('--tsconfig=')) {
      result.tsconfig = arg.slice('--tsconfig='.length);
      i++;
      continue;
    }

    if (isWatchMode) {
      if (arg === '--clear-screen=false') {
        result.clearScreen = false;
        i++;
        continue;
      }
      if (arg === '--include' && i + 1 < argv.length) {
        result.watchInclude.push(argv[++i]!);
        i++;
        continue;
      }
      if (arg.startsWith('--include=')) {
        result.watchInclude.push(arg.slice('--include='.length));
        i++;
        continue;
      }
      if (arg === '--exclude' && i + 1 < argv.length) {
        result.watchExclude.push(argv[++i]!);
        i++;
        continue;
      }
      if (arg.startsWith('--exclude=')) {
        result.watchExclude.push(arg.slice('--exclude='.length));
        i++;
        continue;
      }
    }

    if (arg === '-e' || arg === '--eval') {
      result.eval = argv[++i];
      i++;
      continue;
    }
    if (arg === '-p' || arg === '--print') {
      result.print = argv[++i];
      i++;
      continue;
    }
    if (arg === '--input-type' && i + 1 < argv.length) {
      result.inputType = argv[++i];
      i++;
      continue;
    }
    if (arg.startsWith('--input-type=')) {
      result.inputType = arg.slice('--input-type='.length);
      i++;
      continue;
    }
    if (arg === '--test') {
      result.test = true;
      i++;
      continue;
    }
    if (arg === '-i' || arg === '--interactive') {
      result.command = 'repl';
      i++;
      continue;
    }

    if (arg.startsWith('-')) {
      const valueFlags = [
        '--require', '-r', '--import', '--env-file',
        '--conditions', '-C',
      ];
      if (valueFlags.some(f => arg === f) && i + 1 < argv.length) {
        result.nodeArgs.push(arg, argv[++i]!);
        i++;
        continue;
      }
      result.nodeArgs.push(arg);
      i++;
      continue;
    }

    result.script = arg;
    foundScript = true;
    i++;
  }

  if (!result.script && !result.eval && !result.print && !result.test) {
    result.command = 'repl';
  }

  return result;
}

const args = parseArgs(process.argv.slice(2));

switch (args.command) {
  case 'version':
    process.stdout.write(`xx v${VERSION}\nnode ${process.version}\n`);
    break;
  case 'help':
    printHelp();
    break;
  case 'repl':
    handleRepl(args);
    break;
  case 'watch':
    handleWatch(args);
    break;
  case 'run':
  default:
    handleRun(args);
    break;
}

function handleRun(args: ParsedArgs): void {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (args.tsconfig) env.XX_TSCONFIG_PATH = args.tsconfig;
  if (args.noCache) env.XX_DISABLE_CACHE = '1';

  const loaderURL = pathToFileURL(resolveLoaderPath()).href;

  const nodeArgs: string[] = [
    '--no-strip-types',
    ...args.nodeArgs,
    '--import', loaderURL,
  ];

  if (args.eval !== undefined || args.print !== undefined) {
    const evalType = args.print !== undefined ? 'print' : 'eval';
    const code = (args.print ?? args.eval)!;

    const result = transformSync('/eval.ts', code, {
      sourcemap: false,
    } as any);

    const flag = evalType === 'print' ? '--print' : '--eval';
    nodeArgs.push(flag, result.code);

    if (args.inputType) {
      nodeArgs.push('--input-type', args.inputType);
    }

    const child = spawnChild(nodeArgs, env);
    relaySignals(child);
    return;
  }

  if (args.test) {
    nodeArgs.push('--test');
    if (args.scriptArgs.length === 0 && !args.script) {
      nodeArgs.push('**/{test,test/**/*,test-*,*[.-_]test}.?(c|m)@(t|j)s');
    }
    if (args.script) nodeArgs.push(args.script);
    nodeArgs.push(...args.scriptArgs);

    const child = spawnChild(nodeArgs, env);
    relaySignals(child);
    return;
  }

  if (args.script) {
    nodeArgs.push(args.script);
    nodeArgs.push(...args.scriptArgs);
  }

  const child = spawnChild(nodeArgs, env);
  relaySignals(child);
}

function handleWatch(args: ParsedArgs): void {
  if (!args.script) {
    process.stderr.write('Error: watch mode requires a script path\n');
    process.exit(1);
  }

  const loaderURL = pathToFileURL(resolveLoaderPath()).href;

  startWatch({
    script: args.script,
    args: args.scriptArgs,
    nodeArgs: ['--no-strip-types', ...args.nodeArgs, '--import', loaderURL],
    include: args.watchInclude,
    exclude: args.watchExclude.length > 0 ? args.watchExclude : undefined,
    clearScreen: args.clearScreen,
    tsconfigPath: args.tsconfig,
    noCache: args.noCache,
  });
}

function handleRepl(args: ParsedArgs): void {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (args.tsconfig) env.XX_TSCONFIG_PATH = args.tsconfig;

  const loaderURL = pathToFileURL(resolveLoaderPath()).href;

  const nodeArgs: string[] = [
    '--no-strip-types',
    ...args.nodeArgs,
    '--import', loaderURL,
    '--interactive',
  ];

  const child = spawnChild(nodeArgs, env);
  relaySignals(child);
}

function spawnChild(nodeArgs: string[], env: NodeJS.ProcessEnv): ChildProcess {
  const stdio: any[] = ['inherit', 'inherit', 'inherit'];
  if (process.send) stdio.push('ipc');

  const child = spawn(process.execPath, nodeArgs, { stdio, env });

  if (process.send) {
    child.on('message', (msg) => process.send!(msg));
    process.on('message', (msg) => {
      if (child.send) child.send(msg as any);
    });
  }

  child.on('close', (exitCode, signal) => {
    if (exitCode === null && signal) {
      const signalCode = (osConstants.signals as any)[signal] ?? 0;
      process.exit(128 + signalCode);
    }
    process.exit(exitCode ?? 0);
  });

  return child;
}

function relaySignals(child: ChildProcess): void {
  const relay = (signal: NodeJS.Signals) => {
    if (!child.killed) child.kill(signal);
  };
  process.on('SIGINT', () => relay('SIGINT'));
  process.on('SIGTERM', () => relay('SIGTERM'));
}

function printHelp(): void {
  process.stdout.write(`
xx v${VERSION} - fast typescript execution

Usage:
  xx [flags] <script.ts> [script args...]
  xx watch [flags] <script.ts> [script args...]

Commands:
  watch             Watch mode - restart on file changes

Flags:
  --tsconfig <path> Custom tsconfig.json path
  --no-cache        Disable transform caching
  -e, --eval <code> Evaluate TypeScript code
  -p, --print <code> Evaluate and print result
  --test            Run node test runner with TypeScript
  -v, --version     Show version
  -h, --help        Show this help

Watch flags:
  --include <path>  Additional paths to watch
  --exclude <path>  Paths to exclude from watching
  --clear-screen=false  Disable screen clearing on restart

Examples:
  xx file.ts                   Run a TypeScript file
  xx --env-file=.env file.ts   Run with environment file
  xx watch server.ts           Watch mode
  xx -e "console.log(42)"      Evaluate expression
  xx --test                    Run tests
  xx                           TypeScript REPL

All node flags are passed through.
`);
}
