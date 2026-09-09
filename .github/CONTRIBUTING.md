# Contributing

Kimacha has one long-lived branch, `main`, and it is always releasable.

## Working on a change

Every change goes through a short-lived branch and a pull request. That used to
be reserved for larger work, because the repository had a single author; with
two language tracks live at once, a direct push to `main` is what makes the
other track's next rebase painful, so the branch is not optional any more.

Name the branch after the work, and use the language code when the change
belongs to one track: `feat/sv-a1-words`, `fix/exam-listening-replay`.

Rebase your branch on `main` rather than merging `main` into it. The word
corpora are large JSON files, and a merge commit in the middle of them makes
the history unreadable exactly where it is hardest to review.

The gate is the same either way, so run it before pushing:

```bash
npm run typecheck:ci   # tsc --noEmit
npm run lint           # expo lint
npm run test:ci        # jest
```

CI runs the same three on every push to `main` and on every pull request.
`main` is protected: no force pushes, no deletion, and the checks must pass.

## Who owns what

`.github/CODEOWNERS` routes review by path. Each direction has its own word set:
there is no corpus shared between tracks, and even A0 is the target language's
own hundred most useful words, because what a beginner needs differs by language
and even by direction (hu to en is not en to hu). `data/words/{a0..c2}.json` is
the Spanish track's set, still at the path it had before the other tracks
existed; `data/words/<lang>/` is a track's own. A track writes under its own
directories only (`data/**/<lang>/`, `lib/i18n/<lang>.ts`).

Nobody regenerates a word corpus wholesale: word data cannot be reviewed by eye,
so a regenerated file is an unreviewable diff.

## First thing after cloning

```bash
git config core.hooksPath .githooks
```

That turns on two local guards: agent working documents cannot be committed
here, no file can be tracked and ignored at the same time, and the commit
message has to be a Conventional Commit. `Repo hygiene` in CI checks the same
rules again on every push and pull request, so a missed hook is caught, not
merged.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), which is what the
existing history uses:

```
feat(learn): one Check button, docked above the keyboard
fix(games): no side effects inside state updaters
chore(release): 3.1.15 (49)
```

Scope is the area of the app (`learn`, `games`, `exam`, `grammar`, `web`, `ci`,
`store`, …) or the language code when the change belongs to one track (`sv`,
`de`, `en`). Write the subject as what the change does for the user, not what
the diff touches.

## Releases

A release is a `chore(release): X.Y.Z (versionCode)` commit that bumps the
version in `app.json` and `android/app/build.gradle`, tagged `vX.Y.Z`.

The APK is built locally by the maintainer, not by CI. `android/` is not in this
repository, and the signing keystore exists only on the maintainer's machine, so
`.github/workflows/android-release.yml` is manual-dispatch only until both of
those change.

## Agent working documents

`AGENTS.md`, `BUILD.md`, `GAMES.md`, `BUGS.md` and friends are symlinks into a
private workspace repository and are not part of this repository. If they are
missing after a fresh clone, the tooling that reads them will not find them,
which is expected for anyone but the maintainer.

What those documents carry that a contributor genuinely needs, the product rules
the code is built to, lives in `docs/NORTH-STAR.md`, which is public and does
not depend on the symlinks.
