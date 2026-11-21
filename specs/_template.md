---
id: <app-folder-name>
app: <app-folder-name or repo>
status: draft
version-introduced: 0.0.0
---

# <App name> (<vi name>)

## Goal

One or two sentences: who plays it and what they get from it.

## Requirements

- R1 <testable statement>
- R2 <testable statement>

## Out of scope

- <thing explicitly not built>

## Acceptance

| R | Check | Kind |
|---|---|---|
| R1 | `tools/e2e/specs/<app>.spec.mjs` test `D0 ...` | e2e |
| R2 | `node <app>/scripts/test-<app>.mjs` | unit |
| R3 | manual: <keyboard-only step> | manual |

## Notes

- Open questions are `TBD`.
