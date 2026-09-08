# Contributing

Kimacha is a small project with a trunk-based workflow. `main` is the only
long-lived branch and is always releasable.

## Working on a change

Small, reviewed-by-yourself changes go straight to `main`. Anything larger, or
anything you want a second opinion on, goes through a short-lived branch and a
pull request. Either way the gate is the same, so run it before pushing:

```bash
npm run typecheck:ci   # tsc --noEmit
npm run lint           # expo lint
npm run test:ci        # jest
```

CI runs the same three on every push to `main` and on every pull request.
`main` is protected: no force pushes, no deletion, and the checks must pass.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), which is what the
existing history uses:

```
feat(learn): one Check button, docked above the keyboard
fix(games): no side effects inside state updaters
chore(release): 3.1.15 (49)
```

Scope is the area of the app (`learn`, `games`, `exam`, `grammar`, `de`, `web`,
`ci`, `store`, …). Write the subject as what the change does for the user, not
what the diff touches.

## Releases

A release is a `chore(release): X.Y.Z (versionCode)` commit that bumps the
version in `app.json` and `android/app/build.gradle`, tagged `vX.Y.Z`. Pushing
the tag runs `.github/workflows/android-release.yml`, which builds the APK.

## Agent working documents

`AGENTS.md`, `BUILD.md`, `GAMES.md`, `BUGS.md` and friends are symlinks into a
private workspace repository and are not part of this repository. If they are
missing after a fresh clone, the tooling that reads them will not find them,
which is expected for anyone but the maintainer.
