#!/usr/bin/env node

/**
 * caro.js - Development CLI helper for the single-file Caro & Gomoku application.
 *
 * Provides view, extract, inject, patch, test, and i18n management for index.html.
 * Zero external dependencies: pure Node.js stdlib (fs, path, vm).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const HTML_FILE = path.join(ROOT_DIR, 'index.html');
const BAK_FILE = path.join(ROOT_DIR, 'index.html.bak');

// Section markers in index.html
const SECTIONS = [
  { id: 'head', title: 'HTML Head & Meta', start: '<head>', end: '</head>' },
  { id: 'css', title: 'CSS Styles (§6)', start: '<style>', end: '</style>' },
  { id: 'body', title: 'HUD & Toolbar Markup', start: '<body>', end: '<!-- ============ dialogs ============ -->' },
  { id: 'dialogs', title: 'HTML Dialogs (Menu, Settings, etc.)', start: '<!-- ============ dialogs ============ -->', end: '<script type="module">' },
  { id: 'constants', title: '01 Constants & Defaults', start: '<script type="module">', end: '// ============================================================\n// 02 storage' },
  { id: 'i18n', title: 'I18N Dictionary & Helpers', start: 'const I18N = {', end: 'function t(key, ...args) {' },
  { id: 'storage', title: '02 Storage (Settings & Records)', start: '// 02 storage', end: '// 03 rules engine' },
  { id: 'rules', title: '03 Rules Engine (Pure Win Detection)', start: '// 03 rules engine', end: '// 05 AI engine' },
  { id: 'ai-engine', title: '05 AI Engine (Minimax, Patterns, Worker)', start: '// 05 AI engine', end: 'function runTests() {' },
  { id: 'tests', title: '14 Unit Tests (runTests)', start: 'function runTests() {', end: '// 04 AI client' },
  { id: 'ai-client', title: '04 AI Client (Worker Bridge)', start: '// 04 AI client', end: '// 08 Audio Engine' },
  { id: 'audio', title: '08 Audio Engine (Spa Ambient & SFX)', start: '// 08 Audio Engine', end: '// 09 Game Timer' },
  { id: 'timer', title: '09 Game Timer', start: '// 09 Game Timer', end: '// 06 Renderer' },
  { id: 'renderer', title: '06 Board Renderer (Three.js Orthographic)', start: '// 06 Renderer', end: '// 07 Input Controller' },
  { id: 'input', title: '07 Input Controller (Pointer Events & Keys)', start: '// 07 Input Controller', end: '// 04 Game Controller' },
  { id: 'game', title: '04 Game Controller (State Machine & Logic)', start: '// 04 Game Controller', end: '// 10 Replay Controller' },
  { id: 'replay', title: '10 Replay Controller (Timeline & Scrubbing)', start: '// 10 Replay Controller', end: '// 11 UI Bindings' },
  { id: 'ui', title: '11 UI Bindings (DOM & Modal Handlers)', start: '// 11 UI Bindings', end: '// 12 PWA Bootstrap' },
  { id: 'pwa', title: '12 PWA Bootstrap (Manifest & Icons)', start: '// 12 PWA Bootstrap', end: '// 13 Main & Self-play' },
  { id: 'main', title: '13 Main Lifecycle & Tournament', start: '// 13 Main & Self-play', end: '</script>\n\n<!--\n  Offline Service Worker' },
  { id: 'sw-source', title: 'Service Worker Template', start: '<script type="text/plain" id="sw-source">', end: '</script>\n</body>' }
];

function readHtml() {
  if (!fs.existsSync(HTML_FILE)) {
    console.error(`Error: index.html not found at ${HTML_FILE}`);
    process.exit(1);
  }
  return fs.readFileSync(HTML_FILE, 'utf8');
}

function writeHtml(content, createBackup = true) {
  if (createBackup) {
    fs.copyFileSync(HTML_FILE, BAK_FILE);
  }
  fs.writeFileSync(HTML_FILE, content, 'utf8');
}

function validateJsSyntax(html) {
  const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!match) {
    return { ok: false, error: 'Could not find <script type="module"> in index.html' };
  }
  try {
    const cp = require('child_process');
    cp.execFileSync(process.execPath, ['--input-type=module', '--check'], {
      input: match[1],
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { ok: true };
  } catch (err) {
    const msg = err.stderr ? err.stderr.toString().trim() : err.message;
    return { ok: false, error: msg };
  }
}

function getSectionBounds(html, secId) {
  const sec = SECTIONS.find(s => s.id.toLowerCase() === secId.toLowerCase());
  if (!sec) return null;

  const sIdx = html.indexOf(sec.start);
  if (sIdx === -1) return null;

  let eIdx = html.indexOf(sec.end, sIdx + sec.start.length);
  if (eIdx === -1) {
    eIdx = html.length;
  } else if (sec.id === 'head' || sec.id === 'css' || sec.id === 'sw-source') {
    eIdx += sec.end.length;
  }

  // Calculate line numbers
  const pre = html.slice(0, sIdx);
  const startLine = pre.split('\n').length;
  const chunk = html.slice(sIdx, eIdx);
  const endLine = startLine + chunk.split('\n').length - 1;

  return { sec, sIdx, eIdx, startLine, endLine, chunk };
}

// ============================================================
// Commands
// ============================================================

function cmdList() {
  const html = readHtml();
  console.log(`\n📄 Sections in index.html (${html.split('\n').length} lines, ${(html.length / 1024).toFixed(1)} KB):\n`);
  console.log(`${'ID'.padEnd(14)} ${'LINES'.padEnd(14)} ${'SIZE'.padEnd(10)} TITLE`);
  console.log('-'.repeat(72));

  SECTIONS.forEach(s => {
    const b = getSectionBounds(html, s.id);
    if (!b) {
      console.log(`${s.id.padEnd(14)} ${'NOT FOUND'.padEnd(14)} ${'-'.padEnd(10)} ${s.title}`);
    } else {
      const lineStr = `L${b.startLine}..L${b.endLine}`;
      const sizeStr = `${(b.chunk.length / 1024).toFixed(1)} KB`;
      console.log(`${s.id.padEnd(14)} ${lineStr.padEnd(14)} ${sizeStr.padEnd(10)} ${s.title}`);
    }
  });
  console.log('');
}

function cmdView(target, options = {}) {
  const html = readHtml();
  const bounds = getSectionBounds(html, target);

  if (bounds) {
    console.log(`\n--- Section: ${bounds.sec.id} (${bounds.sec.title}) [L${bounds.startLine}..L${bounds.endLine}] ---\n`);
    const lines = bounds.chunk.split('\n');
    const start = options.start ? Math.max(1, parseInt(options.start, 10)) : 1;
    const end = options.end ? Math.min(lines.length, parseInt(options.end, 10)) : lines.length;

    for (let i = start - 1; i < end; i++) {
      const lineNo = bounds.startLine + i;
      console.log(`${String(lineNo).padStart(5)}: ${lines[i]}`);
    }
    return;
  }

  // Fallback: search query
  cmdFind(target);
}

function cmdFind(query) {
  const html = readHtml();
  const lines = html.split('\n');
  const regex = new RegExp(query, 'i');
  const matches = [];

  lines.forEach((line, idx) => {
    if (regex.test(line)) {
      matches.push({ lineNo: idx + 1, line });
    }
  });

  if (matches.length === 0) {
    console.log(`No matches found for: "${query}"`);
    return;
  }

  console.log(`\n🔍 Found ${matches.length} match(es) for "${query}":\n`);
  matches.forEach(({ lineNo, line }) => {
    console.log(`${String(lineNo).padStart(5)}: ${line.trimEnd()}`);
  });
  console.log('');
}

function cmdExtract(secId, outFile) {
  const html = readHtml();
  const bounds = getSectionBounds(html, secId);
  if (!bounds) {
    console.error(`Error: Unknown section "${secId}". Use "node scripts/caro.js list" to see available sections.`);
    process.exit(1);
  }

  if (outFile) {
    fs.writeFileSync(outFile, bounds.chunk, 'utf8');
    console.log(`✅ Extracted section "${secId}" (${bounds.chunk.length} bytes) to ${outFile}`);
  } else {
    process.stdout.write(bounds.chunk);
  }
}

function cmdInject(secId, inFile) {
  const html = readHtml();
  const bounds = getSectionBounds(html, secId);
  if (!bounds) {
    console.error(`Error: Unknown section "${secId}".`);
    process.exit(1);
  }

  if (!fs.existsSync(inFile)) {
    console.error(`Error: Source file "${inFile}" not found.`);
    process.exit(1);
  }

  const replacement = fs.readFileSync(inFile, 'utf8');
  const newHtml = html.slice(0, bounds.sIdx) + replacement + html.slice(bounds.eIdx);

  // Validate syntax if modifying script section
  const check = validateJsSyntax(newHtml);
  if (!check.ok) {
    console.error(`❌ Validation failed! JS syntax error in injected code:`);
    console.error(check.error);
    process.exit(1);
  }

  writeHtml(newHtml);
  console.log(`✅ Successfully injected "${secId}" from ${inFile} (Backup saved to index.html.bak)`);
}

function cmdPatch(searchStr, replaceStr) {
  const html = readHtml();
  const count = (html.match(new RegExp(escapeRegex(searchStr), 'g')) || []).length;

  if (count === 0) {
    console.error(`❌ Patch failed: Target string not found in index.html.`);
    process.exit(1);
  }
  if (count > 1) {
    console.error(`❌ Patch failed: Target string matched ${count} times. Provide more context to make target unique.`);
    process.exit(1);
  }

  const newHtml = html.replace(searchStr, replaceStr);
  const check = validateJsSyntax(newHtml);
  if (!check.ok) {
    console.error(`❌ Patch rejected: Resulting code has JS syntax error:`);
    console.error(check.error);
    process.exit(1);
  }

  writeHtml(newHtml);
  console.log(`✅ Patch applied successfully! (Backup saved to index.html.bak)`);
}

function cmdRevert() {
  if (!fs.existsSync(BAK_FILE)) {
    console.error(`❌ No backup file found at ${BAK_FILE}`);
    process.exit(1);
  }
  fs.copyFileSync(BAK_FILE, HTML_FILE);
  console.log(`✅ Reverted index.html from index.html.bak`);
}

// ============================================================
// I18N Tools
// ============================================================

function extractI18nData(html) {
  const scriptMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error('Script module not found');

  const code = scriptMatch[1];
  const i18nMatch = code.match(/const I18N = (\{[\s\S]*?\n\};)/);
  if (!i18nMatch) throw new Error('const I18N declaration not found');

  const i18nStr = i18nMatch[1];

  // Evaluate I18N in sandbox
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`var I18N = ${i18nStr}`, sandbox);

  return { i18nObj: sandbox.I18N, i18nRaw: i18nMatch[0], code };
}

function cmdI18n(subcmd, ...args) {
  const html = readHtml();
  const { i18nObj } = extractI18nData(html);

  if (subcmd === 'list') {
    const vnKeys = Object.keys(i18nObj.vn || {});
    const engKeys = Object.keys(i18nObj.eng || {});
    const allKeys = Array.from(new Set([...vnKeys, ...engKeys])).sort();

    console.log(`\n🌐 I18N Keys (${allKeys.length} total keys):\n`);
    console.log(`${'KEY'.padEnd(28)} ${'VIETNAMESE (vn)'.padEnd(36)} ENGLISH (eng)`);
    console.log('-'.repeat(90));

    allKeys.forEach(k => {
      const v = typeof i18nObj.vn?.[k] === 'function' ? '[fn]' : String(i18nObj.vn?.[k] ?? 'MISSING');
      const e = typeof i18nObj.eng?.[k] === 'function' ? '[fn]' : String(i18nObj.eng?.[k] ?? 'MISSING');
      const truncV = v.length > 33 ? v.slice(0, 30) + '...' : v;
      const truncE = e.length > 33 ? e.slice(0, 30) + '...' : e;
      console.log(`${k.padEnd(28)} ${truncV.padEnd(36)} ${truncE}`);
    });
    console.log('');
    return;
  }

  if (subcmd === 'get') {
    const key = args[0];
    if (!key) {
      console.error('Usage: node scripts/caro.js i18n get <key>');
      process.exit(1);
    }
    const vn = i18nObj.vn?.[key];
    const eng = i18nObj.eng?.[key];
    console.log(`\nKey: ${key}`);
    console.log(`vn : ${typeof vn === 'function' ? vn.toString() : JSON.stringify(vn)}`);
    console.log(`eng: ${typeof eng === 'function' ? eng.toString() : JSON.stringify(eng)}\n`);
    return;
  }

  if (subcmd === 'add' || subcmd === 'set') {
    const key = args[0];
    const vnVal = args[1];
    const engVal = args[2];

    if (!key || !vnVal || !engVal) {
      console.error('Usage: node scripts/caro.js i18n add <key> "<vietnameseText>" "<englishText>"');
      process.exit(1);
    }

    // Insert key before the closing brace of vn and eng
    const vnMarker = `    timeoutTurnSkipped: (name) => \`\${name} hết giờ — mất lượt\``;
    const engMarker = `    timeoutTurnSkipped: (name) => \`\${name} timed out — turn skipped\``;

    if (!html.includes(vnMarker) || !html.includes(engMarker)) {
      console.error('Could not locate standard i18n insertion anchor.');
      process.exit(1);
    }

    const safeVn = vnVal.replace(/'/g, "\\'");
    const safeEng = engVal.replace(/'/g, "\\'");

    let updated = html.replace(
      vnMarker,
      `${vnMarker},\n    ${key}: '${safeVn}'`
    );
    updated = updated.replace(
      engMarker,
      `${engMarker},\n    ${key}: '${safeEng}'`
    );

    const check = validateJsSyntax(updated);
    if (!check.ok) {
      console.error('❌ Failed to add i18n key: syntax error generated:', check.error);
      process.exit(1);
    }

    writeHtml(updated);
    console.log(`✅ Added i18n key "${key}" to both vn and eng.`);
    return;
  }

  if (subcmd === 'check') {
    cmdCheck();
    return;
  }

  console.log(`
Usage: node scripts/caro.js i18n <subcommand>

Subcommands:
  list                 List all translation keys with values
  get <key>            Inspect specific translation key
  add <key> <vn> <eng> Safely add new translation to both languages
  check                Verify i18n rules, completeness, and HTML bindings
  `);
}

// ============================================================
// Unit Tests & Checks
// ============================================================

function cmdTest() {
  const html = readHtml();
  const scriptMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    console.error('❌ Script module not found.');
    process.exit(1);
  }

  // Setup minimal DOM mocks to run pure game/ai/unit tests
  const sandbox = {
    console,
    Int8Array,
    Math,
    Array,
    Object,
    String,
    Date,
    URLSearchParams,
    performance: global.performance,
    matchMedia: () => ({ matches: false }),
    window: {},
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {} }),
      addEventListener: () => {}
    },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { search: '', href: 'http://localhost/' },
    navigator: { userAgent: 'node' }
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = () => {};
  sandbox.window.addEventListener = () => {};

  const codeWithoutImports = scriptMatch[1].replace(/import\s+.*?from\s+.*?;/g, '// import removed');
  vm.createContext(sandbox);

  try {
    vm.runInContext(codeWithoutImports, sandbox);
  } catch (err) {
    console.error('❌ Failed to load script into test environment:', err.message);
    process.exit(1);
  }

  if (typeof sandbox.runTests !== 'function') {
    console.error('❌ runTests function not found in script.');
    process.exit(1);
  }

  console.log('\n🧪 Running Caro & Gomoku unit tests in Node.js...\n');
  const res = sandbox.runTests();

  if (!res || !res.results) {
    console.log('✅ Tests executed without return value.');
    return;
  }

  const failed = res.failed || [];
  if (failed.length > 0) {
    console.error(`\n❌ ${failed.length} test(s) failed!`);
    process.exit(1);
  } else {
    console.log(`\n🎉 All ${res.results.length} unit tests passed successfully!\n`);
  }
}

function cmdCheck() {
  console.log('\n🔍 Running comprehensive project sanity checks...\n');
  const html = readHtml();
  let errors = 0;

  // 1. JS Syntax Check
  const jsCheck = validateJsSyntax(html);
  if (jsCheck.ok) {
    console.log('  ✅ JS module syntax is valid.');
  } else {
    console.error('  ❌ JS syntax error:', jsCheck.error);
    errors++;
  }

  // 2. HTML Tag Balance Check
  ['dialog', 'script', 'style'].forEach(tag => {
    const opens = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const closes = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (opens === closes) {
      console.log(`  ✅ <${tag}> tags balanced (${opens} elements).`);
    } else {
      console.error(`  ❌ Mismatched <${tag}> tags: ${opens} open, ${closes} close.`);
      errors++;
    }
  });

  // 3. I18N Rules Check
  try {
    const { i18nObj } = extractI18nData(html);
    const langs = Object.keys(i18nObj);

    // Rule: ONLY Vietnamese (vn) and English (eng) are supported
    const allowed = ['vn', 'eng'];
    const invalidLangs = langs.filter(l => !allowed.includes(l));
    if (invalidLangs.length === 0 && langs.includes('vn') && langs.includes('eng')) {
      console.log('  ✅ Languages: strictly vn (Tiếng Việt) & eng (English).');
    } else {
      console.error(`  ❌ Invalid languages detected (${langs.join(', ')}). Only "vn" and "eng" are allowed.`);
      errors++;
    }

    // Rule: Vietnamese is default
    if (html.includes("lang: 'vn'")) {
      console.log('  ✅ Default language is Vietnamese (vn).');
    } else {
      console.error('  ❌ Default language is NOT set to "vn" in DEFAULT_SETTINGS.');
      errors++;
    }

    // Key parity check
    const vnKeys = Object.keys(i18nObj.vn || {});
    const engKeys = Object.keys(i18nObj.eng || {});
    const missingInEng = vnKeys.filter(k => !(k in (i18nObj.eng || {})));
    const missingInVn = engKeys.filter(k => !(k in (i18nObj.vn || {})));

    if (missingInEng.length === 0 && missingInVn.length === 0) {
      console.log(`  ✅ All ${vnKeys.length} i18n keys are synchronized across vn and eng.`);
    } else {
      if (missingInEng.length > 0) {
        console.error(`  ❌ Missing in English (eng): ${missingInEng.join(', ')}`);
        errors++;
      }
      if (missingInVn.length > 0) {
        console.error(`  ❌ Missing in Vietnamese (vn): ${missingInVn.join(', ')}`);
        errors++;
      }
    }

    // HTML data-i18n binding check
    const dataI18nMatches = Array.from(html.matchAll(/data-i18n="([^"]+)"/g)).map(m => m[1]);
    const unbound = dataI18nMatches.filter(k => !(k in i18nObj.vn));
    if (unbound.length === 0) {
      console.log(`  ✅ All ${dataI18nMatches.length} HTML data-i18n bindings exist in I18N dictionary.`);
    } else {
      console.error(`  ❌ Unbound data-i18n keys in HTML: ${Array.from(new Set(unbound)).join(', ')}`);
      errors++;
    }

  } catch (err) {
    console.error('  ❌ Failed to parse I18N dictionary:', err.message);
    errors++;
  }

  // 4. Audio Engine defaults check
  if (html.includes("musicOn: false")) {
    console.log('  ✅ Background music is disabled by default.');
  } else {
    console.error('  ❌ Background music is NOT disabled by default in DEFAULT_SETTINGS.');
    errors++;
  }

  // 5. Run Unit Tests
  console.log('\n  🧪 Running unit test suite...');
  try {
    cmdTest();
  } catch (err) {
    errors++;
  }

  if (errors > 0) {
    console.error(`\n❌ Sanity check failed with ${errors} issue(s)!\n`);
    process.exit(1);
  } else {
    console.log('\n✨ All checks passed! Repository is in clean and verified state.\n');
  }
}

// ============================================================
// CLI Router
// ============================================================

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function printHelp() {
  console.log(`
Caro & Gomoku Dev Tool (Node.js)

Usage:
  node scripts/caro.js <command> [arguments]

Commands:
  list                          List all code/template sections with line numbers
  view <section|query>          Inspect a section (or search text) with line numbers
  find <query>                  Search regex or text across index.html with context
  extract <section> [file]      Extract a section into a separate file or stdout
  inject <section> <file>       Inject modified code back into index.html (with syntax check)
  patch <target> <replacement>  Safely replace an exact unique string (with syntax check)
  revert                        Restore index.html from index.html.bak
  test                          Run all 26 unit tests in Node.js
  check                         Run all sanity checks (syntax, tags, i18n sync, tests)
  i18n list                     List all translation keys across vn and eng
  i18n get <key>                View specific translation values
  i18n add <key> <vn> <eng>     Safely append new key to both languages

Sections:
  head, css, body, dialogs, constants, i18n, storage, rules,
  ai-engine, tests, ai-client, audio, timer, renderer, input,
  game, replay, ui, pwa, main, sw-source
`);
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  switch (cmd) {
    case 'list':
    case 'sections':
      cmdList();
      break;

    case 'view':
    case 'show': {
      const target = args[1];
      if (!target) return printHelp();
      let start = null, end = null;
      for (let i = 2; i < args.length; i++) {
        if (args[i] === '--start' && args[i + 1]) start = args[++i];
        if (args[i] === '--end' && args[i + 1]) end = args[++i];
      }
      cmdView(target, { start, end });
      break;
    }

    case 'find':
    case 'search': {
      const query = args[1];
      if (!query) return printHelp();
      cmdFind(query);
      break;
    }

    case 'extract': {
      const sec = args[1];
      const out = args[2];
      if (!sec) return printHelp();
      cmdExtract(sec, out);
      break;
    }

    case 'inject': {
      const sec = args[1];
      const inFile = args[2];
      if (!sec || !inFile) return printHelp();
      cmdInject(sec, inFile);
      break;
    }

    case 'patch': {
      const s = args[1];
      const r = args[2];
      if (!s || r === undefined) {
        console.error('Usage: node scripts/caro.js patch "<searchStr>" "<replaceStr>"');
        process.exit(1);
      }
      cmdPatch(s, r);
      break;
    }

    case 'revert':
      cmdRevert();
      break;

    case 'test':
    case 'tests':
      cmdTest();
      break;

    case 'check':
    case 'lint':
    case 'validate':
      cmdCheck();
      break;

    case 'i18n':
      cmdI18n(args[1], ...args.slice(2));
      break;

    default:
      printHelp();
      break;
  }
}

main();
