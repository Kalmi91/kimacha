// Read-only check of the Android signing keystore, to run before `expo prebuild`, a release
// build or deleting a worktree (`npm run check-keystore`).
//
// The key that signs the installed app lives only outside git, in a backup folder
// (<home>/signing-keys/kimacha/debug.keystore; SIGNING_KEYS_DIR replaces <home>/signing-keys).
// `expo prebuild` overwrites android/, so this script checks that
//   1. the backup exists, and
//   2. if android/app/debug.keystore exists, it is byte-for-byte the backup (SHA-256 of the file).
// It only reads the files, never copies or writes a key, and prints only a short prefix of the
// file hash, never key material.
//
// Exit code: 0 = backup present and (no working copy, or the same), 1 = backup missing or differs,
// 2 = the check itself failed.
//
// Usage: node scripts/check-keystore.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKUP = path.join(process.env.SIGNING_KEYS_DIR || path.join(os.homedir(), 'signing-keys'), 'kimacha', 'debug.keystore');
const WORKING = path.join(ROOT, 'android', 'app', 'debug.keystore');

const fingerprint = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const short = (hash) => `${hash.slice(0, 12)}...`;

function main() {
  if (!fs.existsSync(BACKUP)) {
    console.error(`MISSING: no keystore backup at ${BACKUP}. Do not run expo prebuild or delete the worktree.`);
    return 1;
  }
  const backup = fingerprint(BACKUP);
  console.log(`backup:  present, SHA-256 ${short(backup)}`);

  if (!fs.existsSync(WORKING)) {
    console.log('working: android/app/debug.keystore not present (expo prebuild would generate a NEW key; put the backup there first)');
    return 0;
  }
  const working = fingerprint(WORKING);
  if (working !== backup) {
    console.error(`DIFFERS: android/app/debug.keystore has SHA-256 ${short(working)}, not the backup's. Builds would be signed with another key.`);
    return 1;
  }
  console.log('working: android/app/debug.keystore matches the backup');
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  console.error(`check-keystore failed: ${err.message}`);
  process.exit(2);
}
