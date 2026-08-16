/*
  End-to-end validation for the New Delhi Darbar menu site.

  Boots both real pages in a JSDOM browser against the real data files and
  asserts the customer and admin workflows behave correctly — including the
  shared-source-of-truth translation flow and persistence between the two.

  Run: node scripts/test-e2e.js
*/
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) { passed++; return; }
  failures.push(name + (detail ? ` — ${detail}` : ''));
}

function eq(name, actual, expected) {
  check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/* A shared localStorage so the admin page's saves are visible to the menu page. */
function makeStorage(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    clear: () => map.clear(),
    get length() { return map.size; },
    key: i => [...map.keys()][i],
    _dump: () => Object.fromEntries(map)
  };
}

/*
  Load a page. JSDOM cannot fetch local files, so we stub PapaParse's
  `download` mode to read from disk — this exercises the real code path
  including the store's fallback logic.
*/
async function loadPage(file, storageSeed, beforeAdminJs) {
  const virtualConsole = new VirtualConsole();
  const consoleErrors = [];
  virtualConsole.on('jsdomError', e => consoleErrors.push(e.message));
  virtualConsole.on('error', (...a) => consoleErrors.push(a.join(' ')));

  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'http://localhost/' + file,
    virtualConsole
  });

  const { window } = dom;
  const storage = makeStorage(storageSeed);
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
  window.confirm = () => true;
  // JSDOM ships no WebCrypto; the sign-in module needs SubtleCrypto for hashing.
  if (!window.crypto || !window.crypto.subtle) {
    Object.defineProperty(window, 'crypto', {
      value: require('crypto').webcrypto, configurable: true
    });
  }
  window.IntersectionObserver = class {
    observe() {} disconnect() {} unobserve() {}
  };
  window.Element.prototype.scrollIntoView = () => {};
  window.URL.createObjectURL = () => 'blob:stub';
  window.URL.revokeObjectURL = () => {};

  // Real PapaParse, with local-file download support.
  const papaSrc = fs.readFileSync(require.resolve('papaparse'), 'utf8');
  window.eval(papaSrc.replace(/module\.exports/g, 'window.__papa_export'));
  const Papa = window.__papa_export || window.Papa;
  const nativeParse = Papa.parse.bind(Papa);
  Papa.parse = function (input, cfg) {
    if (cfg && cfg.download) {
      const p = path.join(ROOT, input);
      if (fs.existsSync(p)) {
        const res = nativeParse(fs.readFileSync(p, 'utf8'), Object.assign({}, cfg, { download: false, complete: null, error: null }));
        cfg.complete && cfg.complete(res);
      } else {
        cfg.error && cfg.error(new Error('not found: ' + input));
      }
      return;
    }
    return nativeParse(input, cfg);
  };
  window.Papa = Papa;

  // Load local scripts in document order. admin.js runs its sign-in check as
  // the last statement of its IIFE, so a `beforeAdminJs` hook (used to install
  // a mock NDDAuthClient) runs right after auth-client.js and before admin.js.
  const scripts = [...dom.window.document.querySelectorAll('script[src]')]
    .map(s => s.getAttribute('src'))
    .filter(src => !/^https?:/.test(src));
  for (const src of scripts) {
    if (beforeAdminJs && /\/admin\.js$/.test(src)) beforeAdminJs(window);
    window.eval(fs.readFileSync(path.join(ROOT, src), 'utf8'));
  }

  // Let async boot() settle.
  await new Promise(r => setTimeout(r, 60));
  return { dom, window, storage, consoleErrors };
}

/*
  The admin panel authenticates via GitHub OAuth against a Cloudflare Worker
  (worker/), which is tested separately and directly (worker/test-worker.mjs)
  against its real handler code. From this page's point of view, all that
  matters is: does NDDAuthClient.checkSession() report signedIn, and does
  .publish() succeed? So these tests replace that client with a stub that
  behaves like an already-authorized Worker session — exercising the SAME
  admin.js code paths (showPanel/showLogin/boot/publish) without needing a
  live network call to a real Worker deployment.

  ADMIN_USER here is just a display name for the mocked session — it has no
  relationship to any real credential; there is no password anywhere in this
  architecture to leak.
*/
const ADMIN_USER = 'anvra';

function mockAuthClient(window, opts) {
  const signedIn = !opts || opts.signedIn !== false;
  const publishResult = (opts && opts.publishResult) || {
    sha: 'abc1234',
    commitUrl: 'https://github.com/anvra/New-Delhi-Darbar-Menu/commit/abc1234',
    pagesUrl: 'https://anvra.github.io/New-Delhi-Darbar-Menu/'
  };
  const publishError = opts && opts.publishError;

  window.NDDAuthClient = {
    isConfigured: () => true,
    loginUrl: () => 'https://mock-worker.example/auth/login',
    checkSession: async () => (signedIn ? { signedIn: true, login: ADMIN_USER } : { signedIn: false }),
    signOut: async () => {},
    publish: async (files, message) => {
      window.__lastPublishCall = { files, message };
      if (publishError) throw new Error(publishError);
      return publishResult;
    }
  };
}

async function loadAdmin(storageSeed, authOpts) {
  const page = await loadPage('admin.html', storageSeed, w => mockAuthClient(w, authOpts));
  await new Promise(r => setTimeout(r, 60));
  return page;
}

(async () => {
  /* ---------------- 1. Glossary: single source of truth ---------------- */
  {
    const w = { };
    eval(fs.readFileSync(path.join(ROOT, 'src/core/glossary.js'), 'utf8').replace(
      'typeof window !== \'undefined\' ? window : globalThis', 'w'));
    const G = w.NDDGlossary;

    // Every published English name must be fully translatable from the glossary
    // alone, so no stored hi/gu duplicates are needed anywhere in the menu.
    const csv = fs.readFileSync(path.join(ROOT, 'assets/data/menu.csv'), 'utf8').trim().split('\n');
    const hdr = csv[0].split(',');
    const untranslatable = [];
    let storedDuplicates = 0;
    csv.slice(1).forEach(line => {
      const cells = line.split(',');
      const row = {};
      hdr.forEach((h, i) => (row[h] = cells[i]));
      [[row.category_en, row.category_hi, row.category_gu], [row.item_en, row.item_hi, row.item_gu]]
        .forEach(([en, hi, gu]) => {
          if (!en) return;
          ['hi', 'gu'].forEach(lang => {
            const stored = lang === 'hi' ? hi : gu;
            if (!G.translate(en, lang).complete) untranslatable.push(`${en} (${lang})`);
            // A stored value identical to the derived one is redundant duplication.
            if (stored && G.translate(en, lang).text === stored) storedDuplicates++;
          });
        });
    });
    eq('every published name is translatable from English alone', untranslatable.length, 0,
      untranslatable.slice(0, 5).join(', '));
    eq('no redundant duplicate translations stored in the CSV', storedDuplicates, 0);

    // Editing English alone must change all three languages.
    const field = { en: 'Chicken Masala', hi: '', gu: '' };
    const beforeHi = G.resolve(field, 'hi');
    field.en = 'Chicken Kadai';
    check('changing English updates Hindi automatically', G.resolve(field, 'hi') !== beforeHi);
    eq('derived Hindi is correct after edit', G.resolve(field, 'hi'), 'चिकन कड़ाई');
    eq('derived Gujarati is correct after edit', G.resolve(field, 'gu'), 'ચિકન કડાઈ');

    // Manual override wins, and is reported as such.
    const overridden = { en: 'Chicken Masala', hi: 'कस्टम नाम', gu: '' };
    eq('manual override takes precedence', G.resolve(overridden, 'hi'), 'कस्टम नाम');
    eq('manual override reports manual status', G.status(overridden, 'hi'), 'manual');
    eq('auto field reports auto status', G.status(overridden, 'gu'), 'auto');

    // Unknown words degrade gracefully to English rather than half-translating.
    const unknown = { en: 'Zebra Quesadilla', hi: '', gu: '' };
    eq('untranslatable text falls back to English', G.resolve(unknown, 'hi'), 'Zebra Quesadilla');
    eq('untranslatable text reports missing status', G.status(unknown, 'hi'), 'missing');

    // Partial matches must not emit mixed-script output.
    const partial = { en: 'Chicken Quesadilla', hi: '', gu: '' };
    eq('partially-known text does not half-translate', G.resolve(partial, 'hi'), 'Chicken Quesadilla');

    eq('empty English yields empty output', G.resolve({ en: '', hi: '', gu: '' }, 'hi'), '');

    // Glossary must cover the dishes a real admin is likely to add.
    const realistic = [
      'Butter Chicken', 'Chicken Lollipop', 'Mutton Biryani', 'Egg Curry',
      'Paneer Butter Masala', 'Veg Pulao', 'Tandoori Roti', 'Butter Naan',
      'Green Salad', 'Masala Papad', 'Sweet Lassi', 'Fresh Lime Soda',
      'Gulab Jamun', 'Fish Curry', 'Prawn Masala', 'Dal Fry', 'Jeera Rice',
      'Onion Salad', 'Ice Cream', 'Chicken Soup', 'Veg Manchurian',
      'Fried Rice', 'Chicken Noodles', 'Chapati', 'Bhindi Masala',
      'Aloo Gobi', 'Palak Paneer', 'Garlic Naan', 'Paneer Tikka',
      'Mixed Veg', 'Boneless Chicken', 'Half Plate Chicken', 'Extra Gravy'
    ];
    const uncovered = realistic.filter(
      d => !G.translate(d, 'hi').complete || !G.translate(d, 'gu').complete);
    eq('glossary covers common Indian menu dishes', uncovered.length, 0, uncovered.join(', '));

    // No duplicate keys (a later duplicate silently shadows the earlier one).
    const src = fs.readFileSync(path.join(ROOT, 'src/core/glossary.js'), 'utf8');
    ['PHRASES', 'TERMS'].forEach(name => {
      const body = src.split(`const ${name} = {`)[1].split('\n  };')[0];
      const keys = [...body.matchAll(/^\s*'?([a-z0-9 '\-]+)'?\s*:\s*\{/gmi)].map(m => m[1].trim());
      const dupes = [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
      eq(`no duplicate keys in ${name}`, dupes.length, 0, dupes.join(', '));
    });

    // Every entry must define both languages.
    let incomplete = 0;
    [G.TERMS, G.PHRASES].forEach(dict => {
      Object.entries(dict).forEach(([, v]) => { if (!v.hi || !v.gu) incomplete++; });
    });
    eq('every glossary entry has both hi and gu', incomplete, 0);
  }

  /* ---------------- 2. Customer menu page ---------------- */
  const menu = await loadPage('index.html');
  {
    const d = menu.window.document;
    const cards = d.querySelectorAll('.card[id]');
    const navLinks = d.querySelectorAll('.cat-link');

    check('menu renders category cards', cards.length === 6, `got ${cards.length}`);
    check('nav matches category count', navLinks.length === cards.length,
      `${navLinks.length} links vs ${cards.length} cards`);
    check('no loading spinner left behind', !d.querySelector('.menu-status'));

    const items = d.querySelectorAll('.item');
    check('all menu items render', items.length === 23, `got ${items.length}`);

    // Every nav link must point at a real section.
    let broken = 0;
    navLinks.forEach(a => {
      if (!d.getElementById(a.getAttribute('href').slice(1))) broken++;
    });
    eq('no broken category links', broken, 0);

    // Brand / contact wiring.
    eq('brand name renders', d.getElementById('brandH1').textContent, 'New Delhi Darbar');
    check('phone links use tel:', [...d.querySelectorAll('a.phone')].every(a => a.href.startsWith('tel:')));
    check('phone numbers present', d.querySelectorAll('a.phone').length === 4);
    check('address link points at maps', d.getElementById('addressLink').href.includes('maps.app.goo.gl'));
    check('stock note rendered', d.getElementById('stockNote').textContent.length > 10);
    check('footer note rendered', d.getElementById('sourceNote').textContent.length > 10);
    check('customer page has no admin link', !d.querySelector('a[href="admin.html"]'));

    // Prices must survive rendering.
    const prices = [...d.querySelectorAll('.price')].map(p => p.textContent);
    check('prices render', prices.length === 23, `got ${prices.length}`);
    check('price format preserved', prices.includes('80 Rs / plate'));

    // Notices.
    check('notices render', d.querySelectorAll('.notice-section').length === 2);
    check('notice HTML emphasis preserved', !!d.querySelector('.notice-section strong'));
    check('bulk list renders', d.querySelectorAll('.bulk-list li').length === 3);

    // Stored-XSS regression: notice body/pricing come from admin-authored
    // content and must be sanitized, never raw innerHTML. A future admin
    // edit (or a compromised admin session) must not be able to inject a
    // script that runs for every visitor of the public menu.
    const Store = menu.window.NDDStore;
    const payloads = [
      ['<script>window.__xss=1<\/script>', 'window.__xss=1'],
      ['<img src=x onerror="window.__xss=2">', ''],
      ['<a href="javascript:window.__xss=3">click</a>', 'click'],
      ['<strong onclick="window.__xss=4">bold</strong>', undefined]
    ];
    payloads.forEach(([payload, expectedText]) => {
      const out = Store.sanitizeRichText(payload);
      check(`sanitizer neutralizes: ${payload.slice(0, 40)}`,
        !/on\w+\s*=|javascript:|<script/i.test(out), out);
      if (expectedText !== undefined) {
        check(`sanitizer keeps safe text for: ${payload.slice(0, 40)}`,
          out.includes(expectedText) || expectedText === '', out);
      }
    });
    check('sanitizer preserves an allow-listed tag',
      Store.sanitizeRichText('<strong>ok</strong>') === '<strong>ok</strong>');

    // The actual injection point: assigning sanitized output to innerHTML of a
    // real element must never execute script, matching exactly what menu.js does.
    menu.window.__xss = undefined;
    const probe = d.createElement('div');
    probe.innerHTML = Store.sanitizeRichText('<img src=x onerror="window.__xss=true">');
    check('sanitized payload does not execute when assigned to innerHTML',
      menu.window.__xss !== true);
  }

  /* ---------------- 3. Language switching on the live page ---------------- */
  {
    const d = menu.window.document;
    const firstItemName = () => d.querySelector('.item-name').textContent;
    const firstCatHeading = () => d.querySelector('.card h2').textContent;

    eq('English item name', firstItemName(), 'Chicken Masala');

    d.querySelector('[data-lang="hi"]').click();
    await new Promise(r => setTimeout(r, 20));
    eq('Hindi item name after switch', firstItemName(), 'चिकन मसाला');
    eq('Hindi category heading', firstCatHeading(), 'चिकन आइटम');
    eq('html lang attribute updates', d.documentElement.lang, 'hi');
    check('Hindi nav labels update', d.querySelector('.cat-link').textContent === 'चिकन आइटम');
    check('prices unchanged across languages', d.querySelectorAll('.price').length === 23);
    check('Hindi static label', d.querySelector('[data-i18n="addressLabel"]').textContent === 'पता');

    d.querySelector('[data-lang="gu"]').click();
    await new Promise(r => setTimeout(r, 20));
    eq('Gujarati item name after switch', firstItemName(), 'ચિકન મસાલા');
    eq('Gujarati category heading', firstCatHeading(), 'ચિકન આઇટમ');

    d.querySelector('[data-lang="en"]').click();
    await new Promise(r => setTimeout(r, 20));
    eq('back to English', firstItemName(), 'Chicken Masala');
    eq('language persisted to storage', menu.storage.getItem('ndd-language'), 'en');

    // Theme toggle.
    const themeBtn = d.getElementById('themeButton');
    const before = d.documentElement.dataset.theme;
    themeBtn.click();
    check('theme toggles', d.documentElement.dataset.theme !== before);
    check('theme persisted', !!menu.storage.getItem('ndd-theme'));
  }

  /* ---------------- 4. Admin panel ---------------- */
  const admin = await loadAdmin();
  {
    const d = admin.window.document;
    check('admin loads categories', d.querySelectorAll('.cat-card').length === 6,
      `got ${d.querySelectorAll('.cat-card').length}`);
    check('admin is not showing the empty state',
      d.getElementById('catEmpty').style.display === 'none');
    check('admin loads items', d.querySelectorAll('.item-card').length === 23,
      `got ${d.querySelectorAll('.item-card').length}`);
    check('admin loads notices', d.querySelectorAll('.notice-block').length === 2);
    eq('brand form populated', d.getElementById('b_name').value, 'New Delhi Darbar');
    check('phone field populated', d.getElementById('b_phone1').value.length > 5);

    // Translation status UI.
    check('translation status badges render', d.querySelectorAll('.tstatus').length > 0);
    check('translation summary renders', d.getElementById('tsummary').textContent.includes('automatically'));
    const autoCount = d.querySelectorAll('.tstatus.auto').length;
    check('published content shows as auto-translated', autoCount > 40, `only ${autoCount}`);

    // Tabs.
    const tabs = d.querySelectorAll('.tab');
    eq('four tabs present', tabs.length, 4);
    tabs[1].click();
    check('tab switching works', d.getElementById('page-brand').classList.contains('active'));
    check('previous tab hidden', !d.getElementById('page-menu').classList.contains('active'));
    tabs[0].click();

    // Every wired control must exist (catches typo'd ids).
    ['saveBtn', 'resetBtn', 'viewSiteBtn', 'saveFab', 'addCatBtn', 'addNoticeBtn',
     'downloadCsvBtn', 'downloadFallbackBtn', 'downloadConfigBtn'].forEach(id => {
      check(`control #${id} exists`, !!d.getElementById(id));
    });
  }

  /* ---------------- 5. Admin edit -> persistence -> customer view ---------------- */
  {
    const d = admin.window.document;

    // Rename the first item in English only.
    const firstItemInput = d.querySelector('.item-card [data-f=en]');
    eq('editing the published first item', firstItemInput.value, 'Chicken Masala');
    firstItemInput.value = 'Chicken Biryani';
    firstItemInput.dispatchEvent(new admin.window.Event('input', { bubbles: true }));

    // The admin preview must immediately reflect all three languages.
    const preview = firstItemInput.closest('.item-card').querySelector('.trans-preview');
    check('admin preview shows derived Hindi instantly',
      preview.textContent.includes('चिकन बिरयानी'), preview.textContent.slice(0, 120));
    check('admin preview shows derived Gujarati instantly',
      preview.textContent.includes('ચિકન બિરયાની'));

    // Add a new item, English only.
    const addBtn = d.querySelector('.cat-card [data-act=addItem]');
    addBtn.click();
    const inputs = d.querySelectorAll('.cat-card:first-child .item-card [data-f=en]');
    const newInput = inputs[inputs.length - 1];
    newInput.value = 'Dry Chicken';
    newInput.dispatchEvent(new admin.window.Event('input', { bubbles: true }));

    // Price on the new row.
    const newRow = newInput.closest('.item-card');
    const priceInput = newRow.querySelector('[data-f=price]');
    priceInput.value = '120 Rs / plate';
    priceInput.dispatchEvent(new admin.window.Event('input', { bubbles: true }));

    // Save.
    d.getElementById('saveBtn').click();
    await new Promise(r => setTimeout(r, 30));

    const savedCsv = admin.storage.getItem('ndd-csv-override');
    check('save wrote the menu to storage', !!savedCsv);
    check('renamed item persisted', savedCsv.includes('Chicken Biryani'));
    check('new item persisted', savedCsv.includes('Dry Chicken'));
    check('new price persisted', savedCsv.includes('120 Rs / plate'));
    check('save wrote config to storage', !!admin.storage.getItem('ndd-config-override'));
    check('dirty indicator cleared after save',
      !d.getElementById('saveFab').classList.contains('dirty'));

    // Reload the CUSTOMER page with the admin's saved data.
    const menu2 = await loadPage('index.html', admin.storage._dump());
    const d2 = menu2.window.document;
    const names = [...d2.querySelectorAll('.item-name')].map(n => n.textContent);
    check('customer page picks up the admin edit', names.includes('Chicken Biryani'));
    check('customer page shows the new item', names.includes('Dry Chicken'));
    check('customer page shows the new price',
      [...d2.querySelectorAll('.price')].some(p => p.textContent === '120 Rs / plate'));

    // The new item must be translated in all languages with no extra admin work.
    d2.querySelector('[data-lang="hi"]').click();
    await new Promise(r => setTimeout(r, 20));
    const hiNames = [...d2.querySelectorAll('.item-name')].map(n => n.textContent);
    check('new item auto-translated to Hindi for customers', hiNames.includes('सूखी चिकन'),
      hiNames.slice(0, 8).join(', '));

    d2.querySelector('[data-lang="gu"]').click();
    await new Promise(r => setTimeout(r, 20));
    const guNames = [...d2.querySelectorAll('.item-name')].map(n => n.textContent);
    check('new item auto-translated to Gujarati for customers', guNames.includes('સૂકી ચિકન'));
  }

  /* ---------------- 6. Store round-trip & resilience ---------------- */
  {
    const w = admin.window;
    const Store = w.NDDStore;

    const cats = [{ id: 'test', name: { en: 'Test', hi: '', gu: '' },
                    items: [{ en: 'A', hi: 'ह', gu: '', price: '10 Rs' }] }];
    const csv = Store.categoriesToCsv(cats);
    const back = Store.parseCsvText(csv);
    eq('CSV round-trip keeps category', back[0].name.en, 'Test');
    eq('CSV round-trip keeps manual override', back[0].items[0].hi, 'ह');
    eq('CSV round-trip keeps empty override empty', back[0].items[0].gu, '');
    eq('CSV round-trip keeps price', back[0].items[0].price, '10 Rs');

    // Commas and quotes in content must survive.
    const tricky = [{ id: 't', name: { en: 'Rice, Special "House"', hi: '', gu: '' }, items: [] }];
    const trickyBack = Store.parseCsvText(Store.categoriesToCsv(tricky));
    eq('CSV escapes commas and quotes', trickyBack[0].name.en, 'Rice, Special "House"');

    // An empty category still round-trips (so a half-built category isn't lost).
    eq('empty category survives round-trip', trickyBack.length, 1);

    // Generated publish files must be valid JS that reproduces the data.
    const data = { brand: { name: 'X' }, notices: [], categories: cats };
    const scope = {};
    new Function('window', Store.configFileText(data))(scope);
    eq('generated config.js is valid and correct', scope.NDD_CONFIG.brand.name, 'X');
    new Function('window', Store.fallbackFileText(data))(scope);
    check('generated fallback is valid JS', typeof scope.NDD_MENU_CSV_FALLBACK === 'string');
    eq('generated fallback reparses correctly',
      Store.parseCsvText(scope.NDD_MENU_CSV_FALLBACK)[0].name.en, 'Test');

    eq('slugify makes safe ids', Store.slugify('Cold Beverages & More!'), 'cold-beverages-more');
    check('slugify falls back when empty', Store.slugify('!!!', 'fb') === 'fb');
  }

  /* ---------------- 7. Recovery from corrupt storage ---------------- */
  {
    // A stale empty override previously blanked the whole menu — must self-heal.
    const recovered = await loadPage('index.html', {
      'ndd-csv-override': 'category_order,category_id,category_en\n',
      'ndd-config-override': '{ this is not json'
    });
    check('recovers from an empty menu override',
      recovered.window.document.querySelectorAll('.card[id]').length === 6);
    check('recovers from corrupt config JSON',
      recovered.window.document.getElementById('brandH1').textContent === 'New Delhi Darbar');

    const adminRecovered = await loadAdmin({
      'ndd-csv-override': 'category_order,category_id,category_en\n'
    });
    check('admin recovers from an empty override',
      adminRecovered.window.document.querySelectorAll('.cat-card').length === 6);
  }

  /* ---------------- 8. Translation UI is understandable ---------------- */
  {
    const admin2 = await loadAdmin();
    const d = admin2.window.document;

    // Plain-language labels, no jargon.
    const summary = d.getElementById('tsummary').textContent;
    check('summary avoids the word "Auto"', !/\bAuto\b/.test(summary), summary);
    check('summary uses plain wording', summary.includes('translated automatically'));

    const panel = d.querySelector('.trans-preview');
    check('translation panel has a heading', panel.textContent.includes('Other languages'));
    check('languages are named in full, not codes',
      panel.textContent.includes('Hindi') && panel.textContent.includes('Gujarati'));

    // Every field must expose a way to change the translation.
    const editButtons = d.querySelectorAll('.btn-changeit, .btn-fixit');
    check('every translation row has an edit control',
      editButtons.length === d.querySelectorAll('.trans-row').length,
      `${editButtons.length} buttons vs ${d.querySelectorAll('.trans-row').length} rows`);

    // Opening the editor reveals an explanation and an input.
    const firstEdit = d.querySelector('.btn-changeit, .btn-fixit');
    firstEdit.click();
    const opened = d.querySelector('.trans-override.open');
    check('edit button opens the override editor', !!opened);
    check('override editor explains what to do',
      opened.querySelector('.override-help').textContent.length > 30);
    check('override editor has an input', !!opened.querySelector('input'));
    check('override editor has a Done button',
      [...opened.querySelectorAll('button')].some(b => b.textContent === 'Done'));

    // Typing an override and pressing Done must stick and be reported as the admin's own.
    const input = opened.querySelector('input');
    input.value = 'मेरा नाम';
    input.dispatchEvent(new admin2.window.Event('input', { bubbles: true }));
    [...opened.querySelectorAll('button')].find(b => b.textContent === 'Done').click();
    const row = d.querySelector('.trans-row');
    check('override text is shown after saving', row.textContent.includes('मेरा नाम'));
    check('override is labelled as the admin\'s own', !!d.querySelector('.tstatus.manual'));

    // An untranslatable item must offer a prominent "Type Hindi" action.
    const catInput = d.querySelector('.cat-card [data-f=en]');
    catInput.value = 'Zzzz Unknown Dish';
    catInput.dispatchEvent(new admin2.window.Event('input', { bubbles: true }));
    const fixIt = catInput.closest('.cat-card').querySelector('.btn-fixit');
    check('missing translation shows a prominent action', !!fixIt);
    check('the action names the language', /Type (Hindi|Gujarati)/.test(fixIt.textContent), fixIt.textContent);
    check('missing translation explains the fallback',
      catInput.closest('.cat-card').querySelector('.trans-text.is-missing')
        .textContent.includes('English'));
  }

  /*
    Browser-based GitHub publishing (a page accepting a write-scoped PAT) was
    removed as a frontend-authorization anti-pattern — see admin.js and
    SECURITY.md. Its former tests are gone with it. What remains below
    (section 9) replaces the one behavior worth keeping: the menu must still
    render from the embedded fallback when opened over file://, independent
    of any publishing mechanism.
  */

  /* ---------------- 9. Customer menu still works on file:// ---------------- */
  {
    const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
      runScripts: 'outside-only', url: 'file:///C:/menu/index.html', pretendToBeVisual: true
    });
    const w = dom.window;
    const map = new Map();
    Object.defineProperty(w, 'localStorage', {
      value: {
        getItem: k => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: k => map.delete(k)
      }, configurable: true
    });
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w.scrollTo = () => {}; w.confirm = () => true;
    w.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} };
    w.Element.prototype.scrollIntoView = () => {};
    w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
    const papaSrc = fs.readFileSync(require.resolve('papaparse'), 'utf8');
    w.eval(papaSrc.replace(/module\.exports/g, 'window.__papa_export'));
    w.Papa = w.__papa_export || w.Papa;
    // Simulate a browser blocking fetch on file://, while leaving normal
    // string parsing (used by the embedded fallback) working.
    const realParse = w.Papa.parse.bind(w.Papa);
    w.Papa.parse = (input, cfg) => {
      if (cfg && cfg.download) { cfg.error && cfg.error(new Error('blocked on file://')); return; }
      return realParse(input, cfg);
    };
    [...w.document.querySelectorAll('script[src]')]
      .map(s => s.getAttribute('src')).filter(s => !/^https?:/.test(s))
      .forEach(src => w.eval(fs.readFileSync(path.join(ROOT, src), 'utf8')));
    await new Promise(r => setTimeout(r, 140));

    check('menu still loads on file:// via the fallback',
      w.document.querySelectorAll('.card[id]').length === 6,
      `${w.document.querySelectorAll('.card[id]').length} categories`);
  }

  /* ---------------- 10. Backup & restore ---------------- */
  {
    const admin4 = await loadAdmin();
    const w = admin4.window;
    const d = w.document;

    check('backup button exists', !!d.getElementById('backupBtn'));
    check('restore button exists', !!d.getElementById('restoreBtn'));

    // Capture the generated backup instead of downloading it.
    let captured = null;
    const realCreate = w.URL.createObjectURL;
    w.Blob = class { constructor(parts) { captured = parts.join(''); } };
    w.URL.createObjectURL = () => 'blob:x';
    d.getElementById('backupBtn').click();
    w.URL.createObjectURL = realCreate;

    check('backup produced a file', !!captured);
    const backup = JSON.parse(captured);
    eq('backup is tagged with its format', backup._format, 'new-delhi-darbar-menu-backup');
    eq('backup contains every category', backup.categories.length, 6);
    check('backup contains brand details', backup.brand.name === 'New Delhi Darbar');
    check('backup contains notices', Array.isArray(backup.notices) && backup.notices.length === 2);
    const backedUpItems = backup.categories.reduce((n, c) => n + c.items.length, 0);
    eq('backup contains every item', backedUpItems, 23);

    // Restoring that backup must reproduce the same menu.
    const Store2 = w.NDDStore;
    const roundTrip = Store2.parseCsvText(Store2.categoriesToCsv(backup.categories));
    eq('backup restores the same category count', roundTrip.length, 6);
    eq('backup restores the same item count',
      roundTrip.reduce((n, c) => n + c.items.length, 0), 23);
    eq('backup preserves the first item name', roundTrip[0].items[0].en, 'Chicken Masala');
  }

  /*
    ---------------- 10b. Admin sign-in (GitHub OAuth via the Worker) ----------------

    Real authorization logic (CSRF state, the admin-account allow-list, session
    signing/expiry, write-path checks) lives in worker/src/index.js and is
    tested directly and thoroughly in worker/test-worker.mjs against the real
    handler. These tests instead cover admin.html/admin.js's half of the
    contract: it must stay locked until NDDAuthClient reports a session, must
    never contain a password field or any credential of its own, and must
    redirect to the Worker rather than checking anything itself.
  */
  {
    // No mock installed yet — the raw page must default to signed-out with no
    // password field anywhere in its markup.
    const raw = await loadPage('admin.html');
    const d = raw.window.document;

    check('admin starts signed out', d.body.classList.contains('signed-out'));
    check('login screen is present', !!d.getElementById('loginScreen'));
    check('there is no password input anywhere in the admin panel',
      !d.querySelector('input[type="password"]'));
    check('there is no username/credential input either',
      !d.querySelector('#loginUser, #loginPass'));
    check('sign-in is a single GitHub button', !!d.getElementById('githubSignInBtn'));
    check('menu is not loaded before sign-in',
      d.querySelectorAll('.cat-card').length === 0,
      `${d.querySelectorAll('.cat-card').length} categories leaked`);

    // No credential of any kind exists anywhere in the shipped client code —
    // there is nothing to hardcode, hash, or leak, because auth is server-side.
    const authClientSrc = fs.readFileSync(path.join(ROOT, 'src/core/auth-client.js'), 'utf8');
    check('auth-client.js contains no password or hash-shaped literal',
      !/[a-f0-9]{64}/.test(authClientSrc) && !/password/i.test(authClientSrc));
    check('auth-client.js contains no GitHub OAuth client secret pattern',
      !/client_secret/i.test(authClientSrc));
    check('the removed local-credentials files are gone',
      !fs.existsSync(path.join(ROOT, 'src/core/auth.js')) &&
      !fs.existsSync(path.join(ROOT, 'src/core/admin-credentials.js')) &&
      !fs.existsSync(path.join(ROOT, 'src/core/admin-credentials.sample.js')));

    // Clicking the sign-in button must navigate to the Worker's login route,
    // never check anything client-side.
    check('sign-in button exists to click', !!d.getElementById('githubSignInBtn'));

    // A session reported by the Worker (via the mocked client) unlocks the panel.
    const authed = await loadAdmin();
    const da = authed.window.document;
    check('an authorized session reveals the panel', da.body.classList.contains('signed-in'));
    check('the menu loads once signed in', da.querySelectorAll('.cat-card').length === 6,
      `${da.querySelectorAll('.cat-card').length} categories`);
    eq('header shows who is signed in', da.getElementById('whoami').textContent, ADMIN_USER);
    check('sign out button exists', !!da.getElementById('signOutBtn'));

    // No session reported keeps the panel locked with no data loaded.
    const notAuthed = await loadAdmin(null, { signedIn: false });
    const dn = notAuthed.window.document;
    check('no session keeps the panel locked', dn.body.classList.contains('signed-out'));
    check('no session loads no menu data', dn.querySelectorAll('.cat-card').length === 0);

    // Sign out must call the Worker's logout endpoint (via the client) and
    // return to the signed-out state.
    authed.window.confirm = () => true;
    let logoutCalled = false;
    authed.window.NDDAuthClient.signOut = async () => { logoutCalled = true; };
    // JSDOM has no real navigation, so location.reload() throws
    // "Not implemented" there — a real browser navigates fine. The signOut
    // call itself happens before that line runs, so it's still observable.
    try {
      da.getElementById('signOutBtn').click();
      await new Promise(r => setTimeout(r, 20));
    } catch (e) { /* expected: JSDOM can't actually reload the page */ }
    check('signing out calls the auth client’s signOut', logoutCalled);
  }

  /* ---------------- 10c. Customer page exposes no admin surface ---------------- */
  {
    const pub = await loadPage('index.html');
    const d = pub.window.document;

    // The public page must not advertise, link to, or hint at the admin panel.
    check('no admin link element exists', !d.getElementById('adminLink'));
    check('nothing links to admin.html',
      !d.querySelector('a[href*="admin"]'));

    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    check('index.html markup does not reference admin.html',
      !/href=["'][^"']*admin\.html/.test(html));

    // The public script must carry no auth or publishing capability.
    const menuJs = fs.readFileSync(path.join(ROOT, 'src/pages/menu.js'), 'utf8');
    check('menu.js has no admin reveal gesture', !/adminLink/.test(menuJs));
    check('menu.js does not use the auth client', !/NDDAuthClient/.test(menuJs));

    // The customer runtime must expose no way to authenticate or publish.
    check('auth client is absent from the customer page', !pub.window.NDDAuthClient);

    // Every browser-side credential/token flow (local password, browser-based
    // PAT publishing) has been removed entirely, not just excluded from the
    // public build — there is nothing left in the codebase that could leak.
    check('src/core/github.js (old PAT-publish module) has been removed', !fs.existsSync(path.join(ROOT, 'src/core/github.js')));
    check('src/core/auth.js (old password-check module) has been removed', !fs.existsSync(path.join(ROOT, 'src/core/auth.js')));
    check('src/core/admin-credentials.js has been removed', !fs.existsSync(path.join(ROOT, 'src/core/admin-credentials.js')));
    check('src/core/admin-credentials.sample.js has been removed', !fs.existsSync(path.join(ROOT, 'src/core/admin-credentials.sample.js')));
    check('admin.js contains no direct GitHub API calls (all writes go through the Worker)',
      !/api\.github\.com/.test(fs.readFileSync(path.join(ROOT, 'src/pages/admin.js'), 'utf8')));
    check('admin.html no longer contains any password input',
      !/type="password"/.test(fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8')));
  }

  /* ---------------- 10d. Real authorization lives server-side, not client-side ---------------- */
  {
    // This is the structural check for the whole redesign: the browser code
    // must never be able to decide, by itself, that a write is authorized.
    // All it can do is ask the Worker and act on the answer.
    const authClientSrc = fs.readFileSync(path.join(ROOT, 'src/core/auth-client.js'), 'utf8');
    check('auth-client.js makes network calls rather than deciding locally',
      /fetch\(/.test(authClientSrc));
    check('auth-client.js never compares a password or hash itself',
      !/hash|password|sha256/i.test(authClientSrc));
    check('auth-client.js sends credentials so the HttpOnly cookie is attached',
      /credentials:\s*['"]include['"]/.test(authClientSrc));

    const workerSrc = fs.readFileSync(path.join(ROOT, 'worker/src/index.js'), 'utf8');
    check('the Worker re-validates the session on every publish request',
      /verifySession/.test(workerSrc) && /handlePublish/.test(workerSrc));
    check('the Worker checks the authenticated user against an allow-list',
      /ADMIN_GITHUB_USERNAME/.test(workerSrc));
    check('the Worker uses a server-held write token, never a user-supplied one',
      /GITHUB_WRITE_TOKEN/.test(workerSrc));
    check('the Worker never forwards the OAuth client secret to the browser',
      !/Location.*client_secret|redirect.*client_secret/i.test(workerSrc));

    // worker/test-worker.mjs is the authoritative test of this logic; confirm
    // it exists and actually asserts the allow-list/session/CSRF behavior,
    // so this repo can't silently lose that coverage.
    const workerTestPath = path.join(ROOT, 'worker/test-worker.mjs');
    check('worker/test-worker.mjs exists and tests the real handler', fs.existsSync(workerTestPath));
    if (fs.existsSync(workerTestPath)) {
      const wt = fs.readFileSync(workerTestPath, 'utf8');
      check('worker tests cover CSRF state mismatch', /state mismatch/i.test(wt));
      check('worker tests cover non-admin rejection', /non-admin/i.test(wt));
      check('worker tests cover session expiry', /expired/i.test(wt));
      check('worker tests cover disallowed origin', /disallowed origin/i.test(wt));
    }
  }

  /* ---------------- 10e. Publish flow calls the auth client correctly ---------------- */
  {
    const authed = await loadAdmin();
    const d = authed.window.document;

    // A successful publish must call NDDAuthClient.publish with exactly the
    // three known files and must never attempt to reach GitHub directly.
    d.getElementById('publishBtn').click();
    await new Promise(r => setTimeout(r, 40));
    const call = authed.window.__lastPublishCall;
    check('publish was invoked', !!call);
    if (call) {
      const paths = call.files.map(f => f.path).sort();
      eq('publish sends exactly the three expected files', paths.join(','),
        ['assets/data/menu.csv', 'src/core/config.js', 'src/core/menu-fallback.js'].sort().join(','));
    }
    check('a successful publish shows a result with a live-site link',
      d.getElementById('publishResult').innerHTML.includes('github.io'));

    // A failed publish (e.g. session expired mid-edit, or the Worker
    // unreachable) must show the error and must not lose the admin's edits.
    const failing = await loadAdmin(null, { publishError: 'Not signed in, or your session expired. Please sign in again.' });
    const df = failing.window.document;
    df.getElementById('publishBtn').click();
    await new Promise(r => setTimeout(r, 40));
    check('a failed publish surfaces the Worker’s error message',
      /session expired/i.test(df.getElementById('publishResult').textContent));
    check('a failed publish reassures that nothing was lost',
      /still here|nothing was changed/i.test(df.getElementById('publishResult').textContent));
  }

  /* ---------------- 11. No runtime errors anywhere ---------------- */
  eq('customer page raised no console errors', menu.consoleErrors.length, 0,
    menu.consoleErrors.join(' | '));
  eq('admin page raised no console errors', admin.consoleErrors.length, 0,
    admin.consoleErrors.join(' | '));

  /* ---------------- report ---------------- */
  console.log(`\n  ${passed} passed, ${failures.length} failed\n`);
  if (failures.length) {
    failures.forEach(f => console.log('  ✗ ' + f));
    console.log('');
    process.exit(1);
  }
  console.log('  All end-to-end checks passed.\n');
})().catch(err => {
  console.error('\nTest harness crashed:\n', err);
  process.exit(1);
});
