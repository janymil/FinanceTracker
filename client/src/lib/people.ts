export interface PersonLike {
  firstName?: string | null;
  lastName?: string | null;
}

/** "Ana Quispe", or `fallback` when the account has no name on file. */
export function personName(person: PersonLike | null | undefined, fallback: string): string {
  const name = [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim();
  return name || fallback;
}
