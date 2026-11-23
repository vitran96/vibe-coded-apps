---
name: archive-version
description: Keep a playable copy of every app's current built index.html under archived/vX.Y.Z/<app>/ before a breaking change (save-format break, house rules change). Use only before a breaking change, never on an ordinary release.
---

# Archive a release

Old versions stay reachable at `./archived/vX.Y.Z/<app>/`. Use this only right before a breaking change, such as a save-format break or a change to the house rules. Do not archive on every release.

## Steps

1. Make sure the built files are current:
   ```sh
   node shared/scripts/build.mjs --all
   node shared/scripts/check.mjs --all
   ```
2. Archive the pre-break release, with the version that is being left behind:
   ```sh
   node shared/scripts/archive-version.mjs v2.2.0
   ```
   This copies each app's `index.html` into `archived/v2.2.0/<app>/index.html`. It refuses an existing archive, a bad tag, a built file that is stale or not self-contained (rules 2-4), and writes nothing if any app fails.
3. Commit the new `archived/` folder on its own (`chore(repo): archive v2.2.0 before <change>`).
4. Then make the breaking change and bump with `bump-version`.

## Rules

- Archived files are copies. Never edit or rebuild them. `build.mjs`, `check.mjs` and the e2e discovery skip the `archived/` folder.
- Each archive is a single immutable folder. To archive again, use a new version tag.

## Self-test

`node shared/scripts/archive-version.mjs --self-test` (also run in CI).
