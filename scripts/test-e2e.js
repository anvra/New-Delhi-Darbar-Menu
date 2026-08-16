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

/* The admin panel is behind a sign-in; most tests want it already unlocked. */
const ADMIN_USER = '7567587816';
const ADMIN_PASS = 'Thiskeyndd@396';

async function loadAdmin(storageSeed) {
  const page = await loadPage('admin.html', storageSeed);
  const d = page.window.document;
  if (d.body.classList.contains('signed-out')) {
    d.getElementById('loginUser').value = ADMIN_USER;
    d.getElementById('loginPass').value = ADMIN_PASS;
    d.getElementById('loginForm').dispatchEvent(
      new page.window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 120));
  }
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

  /* ---------------- 9. GitHub publishing ---------------- */
  {
    const admin3 = await loadAdmin();
    const w = admin3.window;
    const d = w.document;
    const GH = w.NDDGitHub;

    // UTF-8 safe base64 — plain btoa() corrupts Devanagari/Gujarati.
    const tricky = 'चिकन मसाला — ચિકન મસાલા';
    eq('base64 round-trips Indic text', GH.fromBase64(GH.toBase64(tricky)), tricky);

    // Setup guide is shown until connected.
    check('shows setup guide when not connected', d.getElementById('ghSetup').style.display !== 'none');
    check('hides publish button when not connected',
      d.getElementById('ghConnected').style.display === 'none');
    check('setup guide gives numbered steps',
      d.querySelectorAll('.setup-steps li').length >= 6);
    check('setup guide links to the token page',
      !!d.querySelector('a[href*="personal-access-tokens"]'));

    // Publishing must send exactly the three files, in one commit.
    const calls = [];
    w.fetch = async (url, opts) => {
      calls.push({ url, opts });
      const body = opts && opts.body ? JSON.parse(opts.body) : {};
      const json = (o) => ({ ok: true, status: 200, json: async () => o });
      if (/\/git\/ref\/heads\//.test(url)) return json({ object: { sha: 'headsha' } });
      if (/\/git\/commits\/headsha/.test(url)) return json({ tree: { sha: 'treesha' } });
      if (/\/git\/blobs/.test(url)) return json({ sha: 'blob-' + calls.length });
      if (/\/git\/trees/.test(url)) return json({ sha: 'newtree' });
      if (/\/git\/commits/.test(url)) return json({ sha: 'abcdef1234567890' });
      if (/\/git\/refs\/heads\//.test(url)) return json({});
      if (/\/repos\/[^/]+\/[^/]+$/.test(url)) return json({ full_name: 'anvra/New-Delhi-Darbar-Menu', permissions: { push: true } });
      if (/\/user$/.test(url)) return json({ login: 'anvra' });
      if (/\/commits\?/.test(url)) return json([]);
      return json({});
    };

    GH.setToken('github_pat_test');
    const info = await GH.verify();
    eq('verify reports the account', info.login, 'anvra');
    check('verify detects write access', info.canWrite === true);

    calls.length = 0;
    const res = await GH.publishFiles([
      { path: 'assets/data/menu.csv', content: 'a,b\n1,2\n' },
      { path: 'src/core/menu-fallback.js', content: '// x' },
      { path: 'src/core/config.js', content: '// y' }
    ], 'Update menu from Admin Panel');

    const blobCalls = calls.filter(c => /\/git\/blobs/.test(c.url));
    eq('uploads one blob per file', blobCalls.length, 3);
    const treeCall = calls.find(c => /\/git\/trees/.test(c.url));
    const treePaths = JSON.parse(treeCall.opts.body).tree.map(t => t.path);
    check('commits menu.csv to the right path', treePaths.includes('assets/data/menu.csv'));
    check('commits fallback to the right path', treePaths.includes('src/core/menu-fallback.js'));
    check('commits config to the right path', treePaths.includes('src/core/config.js'));
    eq('creates exactly one commit', calls.filter(c => /\/git\/commits$/.test(c.url)).length, 1);
    check('moves the branch to the new commit',
      calls.some(c => /\/git\/refs\/heads\//.test(c.url) && c.opts.method === 'PATCH'));
    eq('returns the pages url', res.pagesUrl, 'https://anvra.github.io/New-Delhi-Darbar-Menu/');
    check('returns a short sha', res.sha.length === 7);

    // Blob content must survive as valid UTF-8 through base64.
    const sent = JSON.parse(blobCalls[0].opts.body);
    eq('blob encoding declared', sent.encoding, 'base64');
    eq('blob content round-trips', GH.fromBase64(sent.content), 'a,b\n1,2\n');

    // Errors must be explained in plain language, not raw status codes.
    w.fetch = async () => ({ ok: false, status: 401, json: async () => ({ message: 'Bad credentials' }) });
    let msg = '';
    try { await GH.verify(); } catch (e) { msg = e.message; }
    check('401 produces a human explanation', /token/i.test(msg) && !/401/.test(msg), msg);

    w.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
    try { await GH.verify(); } catch (e) { msg = e.message; }
    check('403 explains the likely causes',
      /Contents/.test(msg) && /Repository access/i.test(msg), msg);

    GH.setToken('');
    check('clearing the token disconnects', !GH.hasToken());

    // A network-level failure must be explained, not surfaced as "Failed to fetch".
    GH.setToken('github_pat_x');
    w.fetch = async () => { throw new TypeError('Failed to fetch'); };
    try { await GH.verify(); } catch (e) { msg = e.message; }
    check('network failure is explained plainly', /internet connection/i.test(msg), msg);
    GH.setToken('');
  }

  /* ---------------- 9b. Connect button always reports back ---------------- */
  {
    // Regression: on file:// and in private mode, localStorage.setItem THROWS.
    // That aborted connectGitHub() before any message rendered, so the button
    // appeared to do nothing at all.
    const admin5 = await loadAdmin();
    const w = admin5.window;
    const d = w.document;

    const hostile = {
      getItem() { throw new Error('localStorage disabled'); },
      setItem() { throw new Error('localStorage disabled'); },
      removeItem() { throw new Error('localStorage disabled'); }
    };
    Object.defineProperty(w, 'localStorage', { value: hostile, configurable: true });

    // Re-evaluate the module so it probes the hostile storage.
    w.eval(fs.readFileSync(path.join(ROOT, 'src/core/github.js'), 'utf8'));
    const GH = w.NDDGitHub;

    let threw = false;
    try { GH.setToken('github_pat_abc'); } catch (e) { threw = true; }
    check('setToken survives unusable localStorage', !threw);
    eq('token still readable from memory', GH.getToken(), 'github_pat_abc');
    check('reports that storage is session-only', GH.isSessionOnly() === true);
    check('hasToken works without storage', GH.hasToken());
    GH.setToken('');
    check('clearing works without storage', !GH.hasToken());

    // The button must always leave a message behind.
    const msgEl = d.getElementById('ghConnectMsg');
    const tokenEl = d.getElementById('ghToken');
    const connectBtn = d.getElementById('ghConnectBtn');

    tokenEl.value = '';
    connectBtn.click();
    await new Promise(r => setTimeout(r, 20));
    check('empty token gives a message', msgEl.textContent.length > 0, msgEl.textContent);

    tokenEl.value = 'not-a-real-token';
    connectBtn.click();
    await new Promise(r => setTimeout(r, 20));
    check('malformed token is rejected with advice',
      /github_pat_/.test(msgEl.textContent), msgEl.textContent);

    // A rejected token must also report, and must re-enable the button.
    w.fetch = async () => ({ ok: false, status: 401, json: async () => ({ message: 'Bad credentials' }) });
    tokenEl.value = 'github_pat_looksvalid';
    connectBtn.click();
    await new Promise(r => setTimeout(r, 40));
    check('rejected token shows an explanation', /token/i.test(msgEl.textContent), msgEl.textContent);
    check('connect button is re-enabled after failure', !connectBtn.disabled);
  }

  /* ---------------- 9c. file:// is called out in the UI ---------------- */
  {
    const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8'), {
      runScripts: 'outside-only', url: 'file:///C:/menu/admin.html', pretendToBeVisual: true
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
    if (!w.crypto || !w.crypto.subtle) {
      Object.defineProperty(w, 'crypto', { value: require('crypto').webcrypto, configurable: true });
    }
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
    await new Promise(r => setTimeout(r, 60));

    const warning = w.document.getElementById('ghEnvWarning').textContent;
    check('file:// shows a warning', warning.length > 0);
    check('warning names the problem', /file:\/\//.test(warning), warning.slice(0, 90));
    check('warning links to the online admin panel',
      !!w.document.querySelector('#ghEnvWarning a[href*="github.io"]'));
    check('warning mentions the local server option',
      /localhost:8080/.test(warning), warning.slice(0, 200));
    // The menu itself must still load from the embedded fallback on file://.
    w.document.getElementById('loginUser').value = ADMIN_USER;
    w.document.getElementById('loginPass').value = ADMIN_PASS;
    w.document.getElementById('loginForm').dispatchEvent(
      new w.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 140));
    check('menu still loads on file:// via the fallback',
      w.document.querySelectorAll('.cat-card').length === 6,
      `${w.document.querySelectorAll('.cat-card').length} categories`);
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

  /* ---------------- 10b. Admin sign-in ---------------- */
  {
    const gated = await loadPage('admin.html');
    const w = gated.window;
    const d = w.document;
    const Auth = w.NDDAuth;

    // Locked by default.
    check('admin starts signed out', d.body.classList.contains('signed-out'));
    check('login screen is present', !!d.getElementById('loginScreen'));
    check('menu is not loaded before sign-in',
      d.querySelectorAll('.cat-card').length === 0,
      `${d.querySelectorAll('.cat-card').length} categories leaked`);

    // The password must not be recoverable from the source.
    const authSrc = fs.readFileSync(path.join(ROOT, 'src/core/auth.js'), 'utf8');
    check('password is not stored in plain text', !authSrc.includes('Thiskeyndd'));
    check('credentials are stored as a hash', /[a-f0-9]{64}/.test(authSrc));

    // Wrong credentials are rejected.
    let res = await Auth.signIn('7567587816', 'wrong-password', false);
    check('wrong password is rejected', res.ok === false);
    check('rejection message is helpful', /username or password/i.test(res.error));
    res = await Auth.signIn('wrong-user', 'Thiskeyndd@396', false);
    check('wrong username is rejected', res.ok === false);
    res = await Auth.signIn('', '', false);
    check('empty credentials are rejected', res.ok === false);
    check('still signed out after failures', !Auth.isSignedIn());

    // Correct credentials work.
    res = await Auth.signIn('7567587816', 'Thiskeyndd@396', false);
    check('correct credentials are accepted', res.ok === true, res.error);
    check('session is active', Auth.isSignedIn());
    eq('current user is reported', Auth.currentUser(), '7567587816');

    // Signing out clears it.
    Auth.signOut();
    check('sign out ends the session', !Auth.isSignedIn());

    // "Remember me" persists; without it the session is tab-only.
    await Auth.signIn('7567587816', 'Thiskeyndd@396', true);
    check('remember-me persists to localStorage',
      !!gated.storage.getItem('ndd-admin-session'));
    Auth.signOut();
    check('sign out clears the remembered session',
      !gated.storage.getItem('ndd-admin-session'));

    // An expired session must not grant access.
    gated.storage.setItem('ndd-admin-session',
      JSON.stringify({ username: '7567587816', expires: Date.now() - 1000 }));
    check('expired session is refused', !Auth.isSignedIn());

    // Submitting the real form must unlock the panel and load the menu.
    const gated2 = await loadPage('admin.html');
    const d2 = gated2.window.document;
    d2.getElementById('loginUser').value = '7567587816';
    d2.getElementById('loginPass').value = 'Thiskeyndd@396';
    d2.getElementById('loginForm').dispatchEvent(
      new gated2.window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 120));

    check('signing in reveals the panel', d2.body.classList.contains('signed-in'));
    check('signing in loads the menu', d2.querySelectorAll('.cat-card').length === 6,
      `${d2.querySelectorAll('.cat-card').length} categories`);
    eq('header shows who is signed in', d2.getElementById('whoami').textContent, '7567587816');
    check('password field is cleared after sign-in', d2.getElementById('loginPass').value === '');
    check('sign out button exists', !!d2.getElementById('signOutBtn'));

    // A bad submit shows an error and stays locked.
    const gated3 = await loadPage('admin.html');
    const d3 = gated3.window.document;
    d3.getElementById('loginUser').value = '7567587816';
    d3.getElementById('loginPass').value = 'nope';
    d3.getElementById('loginForm').dispatchEvent(
      new gated3.window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 120));
    check('bad sign-in shows an error', d3.getElementById('loginError').textContent.length > 0);
    check('bad sign-in stays locked', d3.body.classList.contains('signed-out'));
    check('sign-in button is re-enabled', !d3.getElementById('loginBtn').disabled);
  }

  /* ---------------- 10c. Admin link hidden from customers ---------------- */
  {
    const pub = await loadPage('index.html');
    const d = pub.window.document;
    const link = d.getElementById('adminLink');

    check('admin link exists in the markup', !!link);
    check('admin link is hidden from customers', link.hidden === true);

    // Five taps on the footer note reveal it for staff.
    const trigger = d.getElementById('sourceNote');
    for (let i = 0; i < 5; i++) trigger.click();
    check('five taps reveal the admin link', link.hidden === false);
    check('revealed link points at the admin panel',
      link.querySelector('a').getAttribute('href') === 'admin.html');

    // A couple of stray taps must not reveal it.
    const pub2 = await loadPage('index.html');
    const d2 = pub2.window.document;
    d2.getElementById('sourceNote').click();
    d2.getElementById('sourceNote').click();
    check('a couple of taps do not reveal it', d2.getElementById('adminLink').hidden === true);
  }

  /* ---------------- 10d. GitHub permission diagnosis ---------------- */
  {
    const a = await loadAdmin();
    const w = a.window;
    const GH = w.NDDGitHub;
    GH.setToken('github_pat_test');

    // A token that can see the repo but not read Contents must fail at connect
    // time with a clear reason, rather than a confusing 403 when publishing.
    w.fetch = async (url) => {
      const json = o => ({ ok: true, status: 200, json: async () => o });
      if (/\/user$/.test(url)) return json({ login: 'anvra' });
      if (/\/contents\//.test(url)) {
        return { ok: false, status: 403, json: async () => ({ message: 'Resource not accessible by personal access token' }) };
      }
      if (/\/repos\/[^/]+\/[^/]+$/.test(url)) return json({ full_name: 'anvra/x', permissions: { push: true } });
      return json({});
    };
    const info = await GH.verify();
    check('detects a token that cannot read Contents', info.canWrite === false);
    check('account push right is reported separately', info.accountCanPush === true);
    check('explains the Contents problem', /Contents|permission/i.test(info.contentsError), info.contentsError);

    // The 403 explanation must cover both common causes.
    w.fetch = async () => ({ ok: false, status: 403, json: async () => ({ message: 'Resource not accessible by personal access token' }) });
    let msg = '';
    try { await GH.readFile('x'); } catch (e) { msg = e.message; }
    check('403 mentions Contents: Read and write', /Contents/.test(msg), msg);
    check('403 mentions repository access', /Repository access|access to this specific/i.test(msg), msg);
    check('403 quotes what GitHub said', /GitHub said/.test(msg), msg);

    // Rate limiting is distinguished from a permission problem.
    w.fetch = async () => ({ ok: false, status: 403, json: async () => ({ message: 'API rate limit exceeded' }) });
    try { await GH.readFile('x'); } catch (e) { msg = e.message; }
    check('rate limiting is reported distinctly', /rate limit|few minutes/i.test(msg), msg);

    GH.setToken('');
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
