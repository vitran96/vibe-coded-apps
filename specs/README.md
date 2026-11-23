# Specs

Specs are the source of truth for what an app or the repo must do. Code follows the spec; when they disagree, fix the code or change the spec (with a status change), never silently.

## Files

- `specs/<app>.md` one spec per app (`caro`, `chess`, `chinese-chess`, `game-launcher`).
- `specs/house-kit.md` repo-wide rules shared by every app (from the hard rules in root `CLAUDE.md`).
- `specs/_template.md` copy this for a new spec.

## Format

- Frontmatter: `id` (same as the file name), `app` (folder name or `repo`), `status`, `version-introduced`.
- Sections in order: Goal, Requirements, Out of scope, Acceptance, Notes.
- Requirements are numbered `R1`, `R2`, ... Each one is a single testable statement ("Undo reverts 2 plies in PvE"), not a wish.
- Acceptance maps every R to a check: an e2e test (`tools/e2e/specs/<app>.spec.mjs`, found by its `D`/`B` title tag), a script under `<app>/scripts/`, `check.mjs`, or a `manual:` step.
- Unknown behaviour is written as `TBD`, never guessed.

## Status lifecycle

1. `draft`: written from a user request, not yet agreed. Blocking questions only.
2. `accepted`: the user agreed. Requirements are final; numbers do not change (retire an R by writing `R5 (removed)`).
3. `implemented`: every R has code and a passing acceptance check. Set by `implement-spec`.

Existing baseline specs were reverse-written from the code and start at `implemented`.

## Workflow

- New request for an existing app: `save-spec` (writes or updates the spec, status `draft` then `accepted`), then `implement-spec`.
- New app: `save-spec` first, then `implement-spec`, which calls `new-app` to scaffold.
- Version: user-visible changes bump the version with `bump-version`; the spec records `version-introduced` for the R that added it.

## Rules

- A spec never names files that do not exist; a spec never contradicts `CLAUDE.md`. If a spec needs a rule the house kit forbids, the house kit wins.
- Keep each spec at or under 80 lines.
