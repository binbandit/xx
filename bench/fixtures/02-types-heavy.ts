// Benchmark 2: Type-heavy code - lots of types to strip
// Measures how fast type annotations are stripped from real-world-style code.

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  pool: {
    min: number;
    max: number;
    idleTimeoutMs: number;
  };
}

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  pagination?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findMany(filter: Partial<T>): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}

type EventMap = {
  'user.created': User;
  'user.updated': User;
  'user.deleted': { id: string };
};

type EventHandler<K extends keyof EventMap> = (payload: EventMap[K]) => void | Promise<void>;

class TypedEventEmitter {
  private handlers: Map<string, Function[]> = new Map();

  on<K extends keyof EventMap>(event: K, handler: EventHandler<K>): void {
    const list = this.handlers.get(event as string) ?? [];
    list.push(handler);
    this.handlers.set(event as string, list);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const list = this.handlers.get(event as string) ?? [];
    for (const handler of list) {
      handler(payload);
    }
  }
}

function createService<T extends Record<string, unknown>>(config: T): T & { initialized: boolean } {
  return { ...config, initialized: true };
}

const dbConfig: DatabaseConfig = {
  host: 'localhost',
  port: 5432,
  database: 'bench',
  username: 'user',
  password: 'pass',
  ssl: false,
  pool: { min: 2, max: 10, idleTimeoutMs: 30000 },
};

const service = createService(dbConfig);
const emitter = new TypedEventEmitter();
emitter.on('user.created', (user: User) => {});

console.log('ok');
