import { defineConfig, devices } from '@playwright/test';
import { PORT, BASE } from './lib/apps.mjs';

// WebKit (and phone-landscape, which is WebKit) needs host libraries this Fedora 44 box lacks and cannot install without sudo.
// Set E2E_WEBKIT=1 once `npx playwright install-deps webkit` has run. See out/rebuild-plan.md, M0 result.
const WEBKIT = process.env.E2E_WEBKIT === '1';

const CHROME_FLAGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];

export default defineConfig({
  testDir: './specs',
  testIgnore: ['**/_template.spec.mjs'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['line']],
  use: { baseURL: BASE, trace: 'retain-on-failure' },
  webServer: { command: 'node server.mjs', port: PORT, reuseExistingServer: !process.env.CI, env: { E2E_PORT: String(PORT) } },
  projects: [
    // @viewport tests (B10) need a phone; desktop Chromium skips them.
    { name: 'chromium', grepInvert: /@viewport/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, launchOptions: { args: CHROME_FLAGS } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } } } },
    ...(WEBKIT ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }] : []),
    { name: 'phone-portrait', use: { ...devices['Pixel 7'], launchOptions: { args: CHROME_FLAGS } } },
    ...(WEBKIT ? [{ name: 'phone-landscape', use: { ...devices['iPhone 13 landscape'] } }] : []),
  ],
});
