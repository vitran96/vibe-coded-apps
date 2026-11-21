// App discovery and the URL forms every generic spec loads an app from.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, allApps } from '../../../shared/scripts/build.mjs';

export { ROOT, allApps };
export const PORT = Number(process.env.E2E_PORT ?? 4173);
export const BASE = `http://127.0.0.1:${PORT}`;

// Rule 4: the same built file must work under each of these.
export const MODES = {
  served: (app) => `${BASE}/${app}/`,
  pages: (app) => `${BASE}/vibe-coded-apps/${app}/`,
  renamed: (app) => `${BASE}/zz-renamed-${app}/`,
  deep: (app) => `${BASE}/any/deep/path/${app}/`,
  file: (app) => pathToFileURL(join(ROOT, app, 'index.html')).href,
};

// Per-app recipe into a fresh vs-computer game (A4-A6). A missing recipe fails on purpose: add one when an app joins.
export const NEW_VS_AI = {
  caro: ['Đấu với Máy'],
  chess: ['#btn-play', '#btn-start-game'],
  'chinese-chess': ['#btn-start-play', '#btn-newgame-start'],
};
export async function newVsAi(page, app) {
  const steps = NEW_VS_AI[app];
  if (!steps) throw new Error(`no NEW_VS_AI recipe for ${app}: add one in tools/e2e/lib/apps.mjs`);
  for (const s of steps) {
    await (s.startsWith('#') ? page.locator(s) : page.getByRole('button', { name: s }).first()).click();
  }
}
