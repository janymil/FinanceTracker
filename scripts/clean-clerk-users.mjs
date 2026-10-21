#!/usr/bin/env node
/**
 * Kaptia — delete every user from a Clerk instance through the Backend API.
 *
 * Usage:
 *   node scripts/clean-clerk-users.mjs                       # dry run (CLERK_SECRET_KEY from .env)
 *   node scripts/clean-clerk-users.mjs --confirm             # delete
 *   node scripts/clean-clerk-users.mjs --prod                # uses CLERK_SECRET_KEY_PROD (sk_live_...)
 *   node scripts/clean-clerk-users.mjs --key sk_live_... --confirm
 *
 * The key determines the instance: sk_test_* = development, sk_live_* = production.
 * Refuses to run against a production key unless --confirm is passed.
 */
import 'dotenv/config';

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const prod = args.includes('--prod');
const keyIndex = args.indexOf('--key');
const secretKey =
  keyIndex !== -1
    ? args[keyIndex + 1]
    : prod
      ? process.env.CLERK_SECRET_KEY_PROD
      : process.env.CLERK_SECRET_KEY;

if (!secretKey || !/^sk_(test|live)_/.test(secretKey)) {
  console.error(
    prod
      ? 'CLERK_SECRET_KEY_PROD must be set to the production secret key (sk_live_...).'
      : 'CLERK_SECRET_KEY must be a secret key (sk_test_... or sk_live_...).',
  );
  process.exit(1);
}

const instance = secretKey.startsWith('sk_live_') ? 'PRODUCTION (live)' : 'DEVELOPMENT (test)';
const base = 'https://api.clerk.com/v1';
const headers = { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' };

async function api(pathname, init = {}) {
  const res = await fetch(`${base}${pathname}`, { ...init, headers });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const message = body?.errors?.[0]?.long_message || body?.errors?.[0]?.message || res.statusText;
    throw new Error(`${init.method || 'GET'} ${pathname} -> ${res.status} ${message}`);
  }
  return body;
}

async function listAllUsers() {
  const users = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await api(`/users?limit=${limit}&offset=${offset}`);
    users.push(...page);
    if (page.length < limit) break;
  }
  return users;
}

console.log(`Clerk instance: ${instance}`);
console.log(`Mode          : ${confirm ? 'EXECUTE (destructive)' : 'DRY RUN (no changes)'}\n`);

let users;
try {
  users = await listAllUsers();
} catch (err) {
  console.error(`❌ Could not list users: ${err.message}`);
  process.exitCode = 1;
}

if (users) {
  if (users.length === 0) {
    console.log('✅ No users found in this Clerk instance.');
  } else {
    console.log(`Found ${users.length} user(s):`);
    for (const user of users) {
      const email = user.email_addresses?.[0]?.email_address || '(no email)';
      const created = user.created_at ? new Date(user.created_at).toISOString().slice(0, 10) : '?';
      console.log(`  ${user.id}  ${email.padEnd(34)} created ${created}`);
    }

    if (!confirm) {
      console.log('\nDRY RUN — nothing deleted. Re-run with --confirm to delete these users.');
    } else {
      let deleted = 0;
      const failures = [];
      for (const user of users) {
        try {
          await api(`/users/${user.id}`, { method: 'DELETE' });
          deleted += 1;
          if (deleted % 10 === 0 || deleted === users.length) {
            console.log(`  deleted ${deleted}/${users.length}`);
          }
        } catch (err) {
          failures.push({ id: user.id, error: err.message });
          console.error(`  ❌ ${user.id}: ${err.message}`);
        }
      }

      const remaining = await listAllUsers().catch(() => null);
      console.log(`\nDeleted ${deleted}/${users.length} users.`);
      if (failures.length) console.log(`Failures: ${failures.length}`);
      if (remaining) {
        console.log(
          remaining.length === 0
            ? '✅ Verified: Clerk instance has no users left.'
            : `❌ ${remaining.length} user(s) still present: ${remaining.map((u) => u.id).join(', ')}`,
        );
      }
      process.exitCode = failures.length === 0 && (remaining?.length ?? 0) === 0 ? 0 : 1;
    }
  }
}
