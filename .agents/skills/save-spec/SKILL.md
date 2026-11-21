---
name: save-spec
description: Turn a user's requirement for an existing app or a new app into specs/<app>.md (or a new spec file) with numbered testable requirements, acceptance mapped to tests, and status draft then accepted. Use when the user describes what an app should do, asks for a feature, or asks for a new app to be spec'd.
---

# Save a spec

Read `specs/README.md` (format and lifecycle) and `specs/_template.md` first.

## 1. Decide the target

- Existing app: `specs/<app>.md` (exists). Add or edit requirements there.
- New app: `specs/<app>.md` with `<app>` as the kebab-case folder name. Status stays `draft` until the user agrees.
- Cross-app rule: `specs/house-kit.md`.

## 2. Ask only blockers

Ask one short question only if the spec cannot be written without the answer (for example, which of two conflicting behaviours is wanted). Otherwise write the spec, mark unknowns `TBD`, and list them in Notes.

## 3. Write requirements

- Number them `R1`, `R2`, ... Each is one testable statement.
- Changing an agreed R: keep its number, add the new wording, and note the change in Notes. Retire an R as `R5 (removed)`; never renumber.
- Keep the file at or under 80 lines.

## 4. Map acceptance

For each R, name the check:

```sh
ls tools/e2e/specs/<app>.spec.mjs          # e2e flow spec (title tags D/B)
ls <app>/scripts/                          # unit test scripts
grep -n "test('D" tools/e2e/specs/<app>.spec.mjs
```

If no check exists yet, write `TBD (no e2e yet)` and record it as a `manual:` step only when it cannot be automated. `implement-spec` will add the missing test.

## 5. Set status

- Written from the user's words, not yet agreed: `status: draft`.
- User says it is agreed (or approves the file): `status: accepted`.
- Never set `implemented` here; `implement-spec` does that.

## 6. New app

Tell the user: "Spec saved as draft. Next step: `implement-spec`, which calls `new-app` to scaffold the folder." Do not create the app folder in this skill.

## 7. Check and report

```sh
node shared/scripts/check.mjs --all
```

Note: `check.mjs` does not read specs yet, so a broken spec is caught by review only. Report the file path, the R count, and the open `TBD` items.
