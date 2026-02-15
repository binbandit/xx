import type { TransformedUser } from './types.ts';

export function format(user: TransformedUser): string {
  return `${user.displayName} <${user.contactEmail}> [${user.ageGroup}]`;
}
