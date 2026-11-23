---
name: log-fixed-issue
description: Log a fixed bug in the app's FIXED_ISSUES.md (symptom, root cause, invariant, location, test) so it cannot come back. Use every time you fix a bug in an app or in shared code (shared/house, build scripts) that could regress, when you add a new app that has no FIXED_ISSUES.md yet, and before finishing any bug-fix task.
---

# Log a fixed issue

Every app keeps `<app>/FIXED_ISSUES.md`. A bug fix is not finished until its entry is there.

## 1. Find or create the file

```sh
ls <app>/FIXED_ISSUES.md || cp shared/template/FIXED_ISSUES.md <app>/FIXED_ISSUES.md
```

A bug in `shared/` (house kit, build or check scripts) is logged in each app it hit; if it hit all of them, log it in the app where you found it and write "shared" in Location.

## 2. Add the entry

Newest first, under the header, in the file's existing style (caro's `[ISSUE-NNN]` blocks; number = next free):

```md
### [ISSUE-007] Short title of the symptom
- **Symptom:** what the player saw, in plain words.
- **Root Cause:** the real reason, not the patch.
- **Invariant:** the rule that must stay true so it cannot return (testable).
- **Location:** `src/file.js` → `functionName()`.
- **Test:** the unit or e2e test that fails without the fix (add one if none exists).
```

## 3. Keep it honest

- One entry per root cause. Same bug seen again: update its entry, do not add a copy.
- The invariant must be checkable; if it is also an app rule, add one line to `.claude/rules/<app>.md` when that file exists.
- Bug found while implementing a spec: also note it in the spec's Notes if it changes a requirement.
- Do not log style changes, features or refactors.

## 4. Check before you finish

```sh
git diff --stat -- '<app>/FIXED_ISSUES.md' 2>/dev/null || jj diff --stat <app>/FIXED_ISSUES.md
```

If the fix touched `src/` and this file did not change, say why (not a regression risk) in your final message.
