#!/usr/bin/env node
/**
 * Kaptia — local Clerk configuration checker.
 *
 * Dev (localhost) must use the TEST instance keys from the SAME Clerk application:
 *   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
 *   CLERK_SECRET_KEY=sk_test_...
 *
 * Usage: npm run auth:check
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function parseEnvFile(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return null;
  const values = {};
  for (const rawLine of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

// Same precedence as the dev server: .env, then .env.local (local wins)
const baseEnv = parseEnvFile('.env') || {};
const localEnv = parseEnvFile('.env.local');
const env = { ...baseEnv, ...(localEnv || {}) };

const pick = (key) => process.env[key] || env[key] || '';
const pk = pick('VITE_CLERK_PUBLISHABLE_KEY');
const sk = pick('CLERK_SECRET_KEY');

const issues = [];
const warnings = [];

function describeKey(key) {
  if (!key) return 'missing';
  if (key.startsWith('pk_test_')) return 'publishable (test instance)';
  if (key.startsWith('pk_live_')) return 'publishable (production instance)';
  if (key.startsWith('sk_test_')) return 'secret (test instance)';
  if (key.startsWith('sk_live_')) return 'secret (production instance)';
  return 'unrecognised format';
}

function decodeInstance(publishableKey) {
  try {
    const payload = publishableKey.replace(/^pk_(test|live)_/, '');
    const decoded = Buffer.from(payload, 'base64').toString('utf8').replace(/\$$/, '');
    return decoded || null;
  } catch {
    return null;
  }
}

if (!pk) issues.push('VITE_CLERK_PUBLISHABLE_KEY is missing.');
else if (!/^pk_(test|live)_/.test(pk)) issues.push('VITE_CLERK_PUBLISHABLE_KEY must start with pk_test_ (dev) or pk_live_ (prod).');

if (!sk) issues.push('CLERK_SECRET_KEY is missing.');
else if (!/^sk_(test|live)_/.test(sk)) {
  issues.push('CLERK_SECRET_KEY must be a SECRET key starting with sk_test_ (dev) or sk_live_ (prod).');
  if (sk.startsWith('pk_')) issues.push('CLERK_SECRET_KEY currently contains a PUBLISHABLE key - that is why authenticated requests return 401.');
}
if (sk && sk.includes('REPLACE_WITH')) issues.push('CLERK_SECRET_KEY is still a placeholder - paste the real secret key.');

if (pk && sk && /^pk_test_/.test(pk) && /^sk_live_/.test(sk)) {
  warnings.push('You are mixing a test publishable key with a production secret key - sessions will not verify.');
}
if (pk && sk && /^pk_live_/.test(pk) && /^sk_test_/.test(sk)) {
  warnings.push('You are mixing a production publishable key with a test secret key - sessions will not verify.');
}

const instance = decodeInstance(pk);

console.log('');
console.log('Kaptia — Clerk configuration check');
console.log('----------------------------------');
console.log('env precedence      : .env' + (localEnv ? ' + .env.local (local wins in dev)' : ' (no .env.local found)'));
console.log('publishable key     : ' + (pk ? `${describeKey(pk)}  [${pk.slice(0, 16)}...]` : 'missing'));
console.log('secret key          : ' + (sk ? `${describeKey(sk)}  [${sk.slice(0, 8)}...]` : 'missing'));
if (instance) console.log('frontend API host   : ' + instance);
console.log('');

if (warnings.length) {
  console.log('Warnings:');
  warnings.forEach((w) => console.log('  ! ' + w));
  console.log('');
}

if (issues.length) {
  console.log('Problems:');
  issues.forEach((i) => console.log('  x ' + i));
  console.log('');
  console.log('How to fix (development / localhost):');
  console.log('  1. Open https://dashboard.clerk.com and select your application.');
  console.log('  2. Make sure you are in the DEVELOPMENT instance (toggle at the top).');
  console.log('  3. Go to Configure -> API Keys.');
  console.log('  4. Copy "Publishable key" (pk_test_...) into VITE_CLERK_PUBLISHABLE_KEY.');
  console.log('  5. Copy the "Secret key" (sk_test_...) into CLERK_SECRET_KEY.');
  console.log('  6. Put both in .env.local (recommended) or .env, then restart `npm run dev`.');
  console.log('  Both keys MUST come from the same instance.');
  console.log('');
  process.exit(1);
}

console.log('Clerk configuration looks valid for this environment.');
console.log('');
