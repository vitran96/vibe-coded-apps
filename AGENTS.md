# AGENTS.md

Pointer only. The one instruction set for this repo is **`CLAUDE.md`** (Claude format, the source of truth). Read it fully before doing anything, then follow it.

- Skills: `.claude/skills/<name>/SKILL.md` (also visible at `.agents/skills/`, a symlink to it).
- App-specific rules: `.claude/rules/<app>.md` (for example `.claude/rules/caro.md` for `caro/`). Read the one for the app you touch.
- Agents and hooks, if any: `.claude/agents/` and `.claude/settings.json`; the hook scripts they call are in `.claude/hooks/` and are shared by every agent.
- If you are not Claude, create your own native equivalents (skill, agent, hook, rule) in your own format; each must only point to the Claude file, never copy it.
- Do not copy rules into this file or into `GEMINI.md`. Edit `CLAUDE.md`, then use the `ai-agnostic-sync` skill to refresh the pointers.
