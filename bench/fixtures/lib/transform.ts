import type { User, TransformedUser } from './types.ts';

export function transform(user: User): TransformedUser {
  return {
    id: user.id,
    displayName: user.name.toUpperCase(),
    contactEmail: user.email.toLowerCase(),
    ageGroup: user.age < 30 ? 'young' : 'senior',
  };
}
