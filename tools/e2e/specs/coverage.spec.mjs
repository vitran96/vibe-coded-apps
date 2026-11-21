// E11: every app folder has its own flow spec, so a new app cannot ship with only the generic checks.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { allApps } from '../lib/apps.mjs';
import { test, expect } from '../lib/fixtures.mjs';

const SPECS = new URL('.', import.meta.url).pathname;

test('every app has specs/<app>.spec.mjs', () => {
  const apps = allApps();
  expect(apps.length).toBeGreaterThan(0);
  const missing = apps.filter((a) => !existsSync(join(SPECS, `${a}.spec.mjs`)));
  expect(missing, 'copy specs/_template.spec.mjs to specs/<app>.spec.mjs').toEqual([]);
});
