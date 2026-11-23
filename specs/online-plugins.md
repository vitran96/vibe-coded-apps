---
id: online-plugins
app: repo
status: draft
version-introduced: TBD
---

# Optional plugins and online play (Chơi trực tuyến) — future scope

## Goal

Every app can gain optional features (play online, find an opponent, watch a match) from a plugin, with no change when no plugin is present: the games stay fully offline and never open a network connection themselves. The desktop launcher owns the plugins and runs them beside the game. Nothing here is built yet; this spec records the design to keep apps compatible.

## Requirements

- R1 The house kit exposes `House.hooks`: `emit(name, payload)` (fire and forget), `ask(name, payload)` (promise answered by a plugin, resolves `undefined` when none) and `on(name, fn)`. With no plugin every call is a no-op; apps behave exactly as today.
- R2 Plugin discovery, in order: (a) a host object `window.__HOUSE_HOST__` injected before the game scripts by the launcher, the same injection point as the storage shim; (b) nothing else in v1. A plain web page has no plugin. A `./plugins.mjs` next to `index.html` is a TBD for later and must stay optional and silent when absent.
- R3 A plugin registers `{ id, version, apiVersion, hooks }`; the kit refuses an `apiVersion` it does not support and keeps running without it (never throws).
- R4 Standard events (names fixed here, payloads per app spec): `game:start`, `game:move`, `game:undo`, `game:end`, `game:state`. Standard questions: `ui:slots` (a plugin adds start-screen buttons, e.g. "Chơi trực tuyến"), `opponent:provider` (a plugin supplies a remote opponent).
- R5 Each app that supports plugins keeps a deterministic engine with serializable state: `getState()`, `applyMove(move)`, a stable move notation and a rules version. An opponent is a provider with one interface: local human, computer (existing AI) or remote (plugin); online play is a remote provider.
- R6 Watching a match is a read-only provider that receives the move stream and reuses the app's replay code (caro already has `replay.js`).
- R7 The game never uses `fetch`, WebSocket or any network API. The plugin runs in the launcher (Tauri side, no CORS, no game-readable secrets) and talks to the game frame over `postMessage` with versioned messages (`{ v, type, id, payload }`); both sides check the message source is the game frame.
- R8 New UI from a plugin (menus, lobby, errors) follows the house rules: vi/en strings, keyboard reachable, aria-live announcements, plain wording for older players. A plugin failure or lost connection shows one plain message and returns the player to a playable offline game.
- R9 Saves, `House.store` and the app's storage prefix are untouched by plugins; a plugin stores its data under its own `plugin_<id>_` prefix.
- R10 `check.mjs` (static) fails if an app calls a network API; E2E runs each app twice, with and without a stub plugin, and both pass.
- R11 Server side (matchmaking, relay, spectate) is a separate project. Planned wire format: WebSocket, JSON messages `hello`, `queue`, `matched`, `move`, `resign`, `spectate`, `state`, each with `v`. Server rules come first from the move validator in the shared engine.

## Out of scope

- The server, accounts, chat, rankings, anti-cheat, moderation (TBD; they decide whether any sign-in is needed for older players).
- Plugins for the plain-web build (no host there).
- Third-party plugin marketplace: launcher-bundled and signed plugins only (updates via `game-launcher-ota`).

## Acceptance

| R | Check | Kind |
|---|---|---|
| R1, R3 | `shared/scripts/test-hooks.mjs` (TBD): no-op without plugin, bad `apiVersion` ignored | unit |
| R2, R7 | launcher unit test (TBD): host object injected before game scripts; wrong-source message dropped | unit |
| R4, R5, R6 | per-app spec and test (TBD), first app chosen later | unit |
| R8 | manual: kill the plugin mid-game, read the message in vi and en, keyboard only | manual |
| R9, R10 | `check.mjs` network-API rule; `tools/e2e` run with and without stub plugin (TBD) | unit + e2e |
| R11 | design review only | manual |

## Notes

- Feasible with the current structure: every app already has one global scope and the launcher already injects a script (storage shim) into each game. `srcdoc` iframes are cross-origin to the launcher, so `postMessage` is the right bridge and also keeps games network-free.
- Decide before building: the first game to support it, whether online needs sign-in, who hosts the server, and whether a user can pick a self-hosted server.
