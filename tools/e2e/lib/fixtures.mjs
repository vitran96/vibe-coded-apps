// `test` with an automatic guard: any request off 127.0.0.1, page error or console.error fails the test.
import { readFileSync } from 'node:fs';
import { test as base, expect } from '@playwright/test';

export { expect };
export const test = base.extend({
  guard: [async ({ page, context }, use) => {
    const problems = [];
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' || ['data:', 'blob:', 'file:'].includes(url.protocol)) return route.continue();
      problems.push(`external request: ${url.href}`);
      return route.abort();
    });
    page.on('response', (r) => { if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url()}`); });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
    await use();
    expect(problems, 'guard: external requests, page errors or console errors').toEqual([]);
  }, { auto: true }],
});

// Seed a legacy save (saves/<file>, see capture-saves.mjs) before the app's own scripts run. Once per tab, so a reload keeps the state.
export async function seed(page, file) {
  const data = JSON.parse(readFileSync(new URL(`../saves/${file}`, import.meta.url), 'utf8')).localStorage;
  await page.addInitScript((d) => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
  }, data);
}
// Parsed value of one localStorage key (null when absent): the app's real state, read back.
export const stored = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
