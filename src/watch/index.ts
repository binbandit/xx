import { watch as fsWatch, type FSWatcher } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

export interface WatchOptions {
  script: string;
  args: string[];
  nodeArgs: string[];
  include?: string[];
  exclude?: string[];
  clearScreen?: boolean;
  tsconfigPath?: string;
  noCache?: boolean;
}

const DEFAULT_EXCLUDE = [
  'node_modules',
  'bower_components',
  'vendor',
  'dist',
  '.git',
  '.svn',
  '.hg',
];

export function startWatch(options: WatchOptions): void {
  const {
    script,
    args,
    nodeArgs,
    include = [],
    exclude = DEFAULT_EXCLUDE,
    clearScreen = true,
    tsconfigPath,
    noCache,
  } = options;

  let child: ChildProcess | null = null;
  let restarting = false;
  const watchers: FSWatcher[] = [];

  const cwd = process.cwd();

  function buildArgs(): string[] {
    return [
      ...nodeArgs,
      '--import',
      `data:text/javascript,${encodeURIComponent(buildLoaderCode(tsconfigPath, noCache))}`,
      script,
      ...args,
    ];
  }

  function startChild(): void {
    const execArgs = buildArgs();
    child = spawn(process.execPath, execArgs, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...(tsconfigPath ? { XX_TSCONFIG_PATH: tsconfigPath } : {}),
        ...(noCache ? { XX_DISABLE_CACHE: '1' } : {}),
      },
    });

    child.on('exit', (code) => {
      if (!restarting) {
        process.exitCode = code ?? 1;
      }
    });
  }

  function restart(): void {
    restarting = true;
    if (clearScreen) {
      process.stdout.write('\x1B[2J\x1B[0;0H');
    }
    logInfo('Restarting...');

    if (child) {
      child.removeAllListeners();
      child.kill('SIGTERM');

      const forceKillTimer = setTimeout(() => {
        if (child && !child.killed) child.kill('SIGKILL');
      }, 2000);

      child.on('exit', () => {
        clearTimeout(forceKillTimer);
        child = null;
        restarting = false;
        startChild();
      });
    } else {
      restarting = false;
      startChild();
    }
  }

  function shouldIgnore(filename: string): boolean {
    const normalized = filename.replace(/\\/g, '/');
    for (const pattern of exclude) {
      if (normalized.includes(`/${pattern}/`) || normalized.startsWith(pattern + '/') || normalized === pattern) {
        return true;
      }
    }
    const basename = path.basename(normalized);
    if (basename.startsWith('.') && basename !== '.' && basename !== '..') {
      return true;
    }
    return false;
  }

  function setupWatchers(): void {
    const watchDirs = new Set<string>();
    watchDirs.add(cwd);

    for (const inc of include) {
      watchDirs.add(path.dirname(path.resolve(inc)));
    }

    const relevantExtensions = new Set([
      '.ts', '.tsx', '.mts', '.cts',
      '.js', '.jsx', '.mjs', '.cjs',
      '.json',
    ]);

    for (const dir of watchDirs) {
      try {
        const watcher = fsWatch(dir, { recursive: true }, (_eventType, filename) => {
          if (!filename || shouldIgnore(filename)) return;
          if (relevantExtensions.has(path.extname(filename))) {
            restart();
          }
        });
        watchers.push(watcher);
      } catch {
        // dir might not exist yet
      }
    }
  }

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (key: string) => {
      if (key === '\r' || key === '\n') {
        restart();
      } else if (key === '\u0003') {
        cleanup();
        process.exit(0);
      }
    });
  }

  function cleanup(): void {
    for (const w of watchers) w.close();
    if (child && !child.killed) child.kill('SIGTERM');
  }

  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });

  logInfo(`Watching for changes...`);
  setupWatchers();
  startChild();
}

function buildLoaderCode(tsconfigPath?: string, noCache?: boolean): string {
  const envLines: string[] = [];
  if (tsconfigPath) envLines.push(`process.env.XX_TSCONFIG_PATH=${JSON.stringify(tsconfigPath)};`);
  if (noCache) envLines.push(`process.env.XX_DISABLE_CACHE='1';`);
  return `${envLines.join('')}import('xx/loader');`;
}

function logInfo(msg: string): void {
  process.stderr.write(`\x1b[2m[\x1b[36mxx\x1b[0m\x1b[2m]\x1b[0m ${msg}\n`);
}
