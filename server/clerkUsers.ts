/**
 * Clerk "user.created" handling.
 *
 * The first dashboard load (`GET /api/auth/user`) and Clerk's webhook both create the account row,
 * and either can win. Whoever loses must not fail: a failing webhook is retried by Clerk for days,
 * and a failing first load leaves a brand-new person on an error page.
 */

interface UserStore {
  getUser(id: string): Promise<unknown>;
  createUser(user: any): Promise<unknown>;
}

const isUniqueViolation = (error: any) => error?.code === '23505' || /duplicate key/i.test(error?.message ?? '');

export type CreatedUserOutcome = 'created' | 'already-exists' | 'email-belongs-to-another-account';

export async function syncCreatedClerkUser(userData: any, store: UserStore): Promise<CreatedUserOutcome> {
  const { id, email_addresses, first_name, last_name, image_url, phone_numbers, created_at } = userData;
  if (await store.getUser(id)) return 'already-exists';

  const primaryEmail = email_addresses?.find((email: any) => email.id === userData.primary_email_address_id)?.email_address;
  const primaryPhone = phone_numbers?.find((phone: any) => phone.id === userData.primary_phone_number_id)?.phone_number;
  const createdAt = created_at ? new Date(created_at) : new Date();

  try {
    await store.createUser({
      id,
      email: primaryEmail || null,
      firstName: first_name || null,
      lastName: last_name || null,
      profileImageUrl: image_url || null,
      phone: primaryPhone || null,
      plan: 'free',
      settings: null,
      createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
      updatedAt: new Date(),
    });
    return 'created';
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Lost the race for the same id: the account exists, which is all this event wanted.
    if (await store.getUser(id)) return 'already-exists';
    // The id is free but the e-mail is taken by an older account. The sign-in flow re-links
    // those (see /api/auth/user), so acknowledge the event instead of making Clerk retry it.
    return 'email-belongs-to-another-account';
  }
}
