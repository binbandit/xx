import type { User } from './types.ts';

export function validate(user: User): boolean {
  if (!user.id || typeof user.id !== 'string') return false;
  if (!user.name || user.name.length < 1) return false;
  if (!user.email || !user.email.includes('@')) return false;
  if (typeof user.age !== 'number' || user.age < 0) return false;
  return true;
}
