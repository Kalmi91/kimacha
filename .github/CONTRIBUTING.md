# Contributing

Kimacha is maintained by one person and the source is published for viewing and evaluation (see
[LICENSE](../LICENSE)). Open an issue before anything larger than a small fix. `main` is always releasable.

## Setup

```bash
git clone https://github.com/Kalmi91/kimacha.git
cd kimacha
npm ci
git config core.hooksPath .githooks
```

The last line turns on two local guards: Conventional Commit messages, and no agent working documents.
`Repo hygiene` in CI checks the same rules again.

## The gate

Run all three before you push. CI runs them on every pull request.

```bash
npm run typecheck:ci   # tsc --noEmit
npm run lint           # expo lint, 0 errors, no new warnings
npm run test:ci        # jest
```

Try a UI change in the web build (`npm run web`) or on a device too.

## Branches and commits

- One short-lived branch per change, named after the work: `feat/exam-listening-replay`.
- Open a pull request into `main`. Do not push to `main` directly.
- Rebase on `main` instead of merging `main` into your branch: merge commits make the large JSON
  word lists unreadable to review.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat`, `fix`, `chore`,
  `docs`, `test`, `refactor`, `build`, `ci`, `perf`, `style`, `revert`). The subject says what the change
  does for the user: `feat(learn): one Check button, docked above the keyboard`.
- No AI attribution lines in commit messages or pull request text, such as a `Co-Authored-By` naming
  an AI or "Generated with". The commit hook and CI reject them in commit messages.

## Data rules

The product rules are in [docs/NORTH-STAR.md](../docs/NORTH-STAR.md). The ones that decide most reviews:

- **Never a sentence with an unknown word.** Every word in an example sentence is taught by that level
  or carries a gloss, and a sentence stays inside the grammar its level has unlocked.
  `node scripts/audit-games.mjs` checks lessons against the Spanish deck. CI does not run it.
- **Data lives in JSON.** Spanish words are in `data/words-open/{a1,a2,b1,b2,c1}.json`, English words in
  `data/words/en/`, grammar lessons in `data/games/grammar/<lang>/`. The `.ts` files next to them
  only wire the data up. After editing the Spanish word list run `node scripts/words-open-check.mjs`.
- **Never regenerate a word list wholesale.** Word data cannot be reviewed by eye: add and edit entries.
- **Strings exist in English and Spanish** (`lib/i18n/en.ts`, `lib/i18n/es.ts`). Spanish content uses
  Mexican usage. The vocabulary ceiling is C1.

## Releases

The maintainer cuts releases (version bump in `app.json`, local build, Google Play upload, `vX.Y.Z` tag
and GitHub Release). The steps are in the README. Security problems go to [SECURITY.md](SECURITY.md),
not to a public issue.

## Building an APK locally (Windows)

Install JDK 17 and the Android SDK (platform 36, build-tools 36, NDK 27.1.12297006) and set `JAVA_HOME`
and `ANDROID_HOME`. Then `npx expo prebuild --platform android --clean` and `android\gradlew.bat assembleRelease`
(from `android\`). `android/` is generated and gitignored: put native settings in `app.json` or in a config
plugin under `plugins/`, never in the generated folder. Play bundles are signed by `plugins/withPlaySigning.js`
when you pass `-PplayStore=true`, with the key described by `%USERPROFILE%\.kimacha\keystore.properties` (or the
file named in `KIMACHA_KEYSTORE_PROPERTIES`). Never commit a keystore or that file. Details: README, Release process.
