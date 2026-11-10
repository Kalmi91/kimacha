#!/usr/bin/env node
/**
 * Pre-push gate: refuses a push whose new commits would publish personal data.
 *
 * Why it exists: real contact details once reached test fixtures and exam texts, and a public
 * history is very hard to clean afterwards. Fixtures use invented data; this catches the slip.
 *
 * The values are not in this repository. They live in a local file outside git, one
 * "name<TAB>regex" per line. Without that file the check passes, so other clones are not affected.
 *
 * Pass (exit 0): no pattern matches a new commit's author, committer, message or added lines.
 * Fail (exit 1): prints the category, commit and file, never the matched value.
 *
 * Input: the lines git gives a pre-push hook on stdin. Run by .githooks/pre-push.
 * Starts nothing and changes nothing.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PATTERN_FILE = join(homedir(), '.config', 'personal-data-gate', 'patterns.txt');
const NO_COMMIT = /^0+$/;
const MAX_OUTPUT = 1024 * 1024 * 1024;

function git(...args) {
  return spawnSync('git', args, { encoding: 'utf8', maxBuffer: MAX_OUTPUT });
}

function loadPatterns() {
  return readFileSync(PATTERN_FILE, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const tab = line.indexOf('\t');
      const source = line.slice(tab + 1);
      const ignoreCase = source.startsWith('(?i)');
      return {
        name: line.slice(0, tab),
        regex: new RegExp(ignoreCase ? source.slice(4) : source, ignoreCase ? 'i' : ''),
      };
    });
}

/** The commits this ref update would add to the remote, as git log arguments. */
function newCommits(localSha, remoteSha) {
  const known = !NO_COMMIT.test(remoteSha) && git('cat-file', '-e', `${remoteSha}^{commit}`).status === 0;
  return known ? [`${remoteSha}..${localSha}`] : [localSha, '--not', '--remotes=origin'];
}

function findLeaks(range, patterns) {
  const format = '--format=%x00%H%x00%an <%ae>%x00%cn <%ce>%x00%B%x00';
  const log = git('log', '-p', '--no-color', '--no-ext-diff', '--no-renames', format, ...range);
  if (log.status !== 0) {
    throw new Error(`git log failed: ${log.stderr.slice(0, 300)}`);
  }
  const leaks = [];
  const report = (text, commit, where) => {
    for (const { name, regex } of patterns) {
      if (regex.test(text)) {
        leaks.push(`${name}: ${commit.slice(0, 10)} ${where}`);
      }
    }
  };
  const parts = log.stdout.split('\0');
  for (let i = 1; i + 3 < parts.length; i += 5) {
    const [commit, author, committer, message, diff = ''] = parts.slice(i, i + 5);
    report(author, commit, 'author');
    report(committer, commit, 'committer');
    report(message, commit, 'commit message');
    let file = '';
    for (const line of diff.split('\n')) {
      if (line.startsWith('+++ ')) {
        file = line.replace(/^\+\+\+ (b\/)?/, '');
      } else if (line.startsWith('+')) {
        report(line, commit, file);
      }
    }
  }
  return leaks;
}

function main() {
  if (!existsSync(PATTERN_FILE)) {
    return 0;
  }
  const patterns = loadPatterns();
  const leaks = new Set();
  for (const update of readFileSync(0, 'utf8').split(/\r?\n/)) {
    const [, localSha, , remoteSha] = update.split(' ');
    if (localSha && !NO_COMMIT.test(localSha)) {
      for (const leak of findLeaks(newCommits(localSha, remoteSha), patterns)) {
        leaks.add(leak);
      }
    }
  }
  if (leaks.size === 0) {
    return 0;
  }
  console.error('Push refused, these commits would publish personal data:');
  for (const leak of leaks) {
    console.error(`  ${leak}`);
  }
  console.error('Replace the value with an invented one and rewrite the commit. Never use --no-verify.');
  return 1;
}

process.exit(main());
