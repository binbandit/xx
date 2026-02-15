import { validate } from './validate.ts';
import { format } from './format.ts';
import { transform } from './transform.ts';
import type { User, ProcessResult } from './types.ts';

export function processUsers(): ProcessResult {
  const users: User[] = [
    { id: '1', name: 'Alice', email: 'alice@test.com', age: 30 },
    { id: '2', name: 'Bob', email: 'bob@test.com', age: 25 },
    { id: '3', name: 'Charlie', email: 'charlie@test.com', age: 35 },
  ];

  const validated = users.filter(u => validate(u));
  const transformed = validated.map(u => transform(u));
  const formatted = transformed.map(u => format(u));

  return { users: formatted, count: formatted.length };
}
