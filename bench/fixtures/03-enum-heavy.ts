// Benchmark 3: Enum-heavy code - requires actual code generation (not just stripping)
// This tests the transform engine, not just type erasure.

enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}

enum StatusCode {
  OK = 200,
  Created = 201,
  NoContent = 204,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Conflict = 409,
  InternalServerError = 500,
  BadGateway = 502,
  ServiceUnavailable = 503,
}

enum LogLevel {
  Trace,
  Debug,
  Info,
  Warn,
  Error,
  Fatal,
}

enum Permission {
  Read = 1 << 0,
  Write = 1 << 1,
  Execute = 1 << 2,
  Admin = Read | Write | Execute,
}

const enum InlinedEnum {
  A = 'alpha',
  B = 'beta',
  C = 'gamma',
}

enum DatabaseDriver {
  Postgres = 'pg',
  MySQL = 'mysql',
  SQLite = 'sqlite',
  MongoDB = 'mongo',
}

function handleRequest(method: HttpMethod, path: string): StatusCode {
  if (method === HttpMethod.GET) return StatusCode.OK;
  if (method === HttpMethod.POST) return StatusCode.Created;
  if (method === HttpMethod.DELETE) return StatusCode.NoContent;
  return StatusCode.OK;
}

function checkPermission(userPerms: Permission, required: Permission): boolean {
  return (userPerms & required) === required;
}

const result = handleRequest(HttpMethod.GET, '/api/users');
const hasAccess = checkPermission(Permission.Admin, Permission.Write);
const level: LogLevel = LogLevel.Info;
const driver: DatabaseDriver = DatabaseDriver.Postgres;
const inlined: string = InlinedEnum.A;

console.log('ok');
