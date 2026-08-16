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
async function loadPage(file, storageSeed) {
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

  // Load local scripts in document order.
  const scripts = [...dom.window.document.querySelectorAll('script[src]')]
    .map(s => s.getAttribute('src'))
    .filter(src => !/^https?:/.test(src));
  for (const src of scripts) {
    window.eval(fs.readFileSync(path.join(ROOT, src), 'utf8'));
  }

  // Let async boot() settle.
  await new Promise(r => setTimeout(r, 60));
  return { dom, window, storage, consoleErrors };
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
    check('admin link present', !!d.querySelector('a[href="admin.html"]'));

    // Prices must survive rendering.
    const prices = [...d.querySelectorAll('.price')].map(p => p.textContent);
    check('prices render', prices.length === 23, `got ${prices.length}`);
    check('price format preserved', prices.includes('80 Rs / plate'));

    // Notices.
    check('notices render', d.querySelectorAll('.notice-section').length === 2);
    check('notice HTML emphasis preserved', !!d.querySelector('.notice-section strong'));
    check('bulk list renders', d.querySelectorAll('.bulk-list li').length === 3);
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
  const admin = await loadPage('admin.html');
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

    const adminRecovered = await loadPage('admin.html', {
      'ndd-csv-override': 'category_order,category_id,category_en\n'
    });
    check('admin recovers from an empty override',
      adminRecovered.window.document.querySelectorAll('.cat-card').length === 6);
  }

  /* ---------------- 8. No runtime errors anywhere ---------------- */
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
