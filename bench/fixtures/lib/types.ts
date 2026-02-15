export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
}

export interface TransformedUser {
  id: string;
  displayName: string;
  contactEmail: string;
  ageGroup: string;
}

export interface ProcessResult {
  users: string[];
  count: number;
}
