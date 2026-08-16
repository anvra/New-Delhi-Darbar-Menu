/*
  New Delhi Darbar — shared data store.

  Single data-access layer used by BOTH the customer menu and the admin panel,
  so the two can never drift apart. Responsibilities:
    - load menu + site config (localStorage override -> menu.csv -> embedded fallback)
    - normalize everything into one in-memory shape
    - serialize back out to CSV / config.js for publishing

  Canonical in-memory shape:
    {
      brand:      { name, tagline, since, specialty, meta, phones[], address, mapUrl,
                    stockNote:{en,hi,gu}, sourceNote:{en,hi,gu} },
      categories: [ { id, name:{en,hi,gu}, items:[ {en,hi,gu,price} ] } ],
      notices:    [ { title:{en,hi,gu}, html:{en,hi,gu}, bulkList:[{en,hi,gu}], bulkPricing:{en,hi,gu} } ]
    }

  English is the source of truth; `hi`/`gu` hold OPTIONAL manual overrides only.
  An empty hi/gu is normal and means "derive it from the glossary" — see glossary.js.
*/
(function (root) {
  'use strict';

  const STORAGE_CONFIG = 'ndd-config-override';
  const STORAGE_CSV = 'ndd-csv-override';

  const CSV_COLUMNS = [
    'category_order', 'category_id', 'category_en', 'category_hi', 'category_gu',
    'item_order', 'item_en', 'item_hi', 'item_gu', 'price'
  ];

  function str(v) { return String(v == null ? '' : v).trim(); }

  /*
    Allow-list HTML sanitizer for the small amount of admin-authored rich text
    (notice bodies / bulk-pricing notes) that needs emphasis like <strong>.

    Rendering that text with raw innerHTML would be stored XSS: anything typed
    into the admin textarea — or injected there via a compromised admin
    session/browser — would execute as script for every site visitor. This
    strips everything except a tiny fixed set of formatting tags/attributes,
    using the browser's own HTML parser (not regex, which is not reliable for
    HTML) so the result can only ever be inert markup.
  */
  const SANITIZE_ALLOWED_TAGS = new Set(['STRONG', 'B', 'EM', 'I', 'BR', 'SPAN', 'U', 'SMALL', 'SUP', 'SUB', 'STRIKE', 'S', 'MARK', 'DEL', 'INS', 'CODE', 'KBD', 'Q', 'CITE', 'DFN', 'ABBR', 'TIME', 'VAR', 'SAMP', 'WBR']);
  const SANITIZE_ALLOWED_ATTRS = new Set([]); // no attributes allowed — no href, no on*, no style

  function sanitizeRichText(html) {
    const input = str(html);
    if (!input) return '';
    if (typeof document === 'undefined') {
      // No DOM available (e.g. a build script) — fail safe to escaped plain text.
      return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const template = document.createElement('template');
    template.innerHTML = input;

    function clean(node) {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) return; // text is always safe
        if (child.nodeType !== Node.ELEMENT_NODE || !SANITIZE_ALLOWED_TAGS.has(child.tagName)) {
          // Disallowed element (e.g. <script>, <img onerror>, <a>): keep its
          // text content, drop the tag and everything the tag could carry.
          const text = document.createTextNode(child.textContent || '');
          child.replaceWith(text);
          return;
        }
        [...child.attributes].forEach(attr => {
          if (!SANITIZE_ALLOWED_ATTRS.has(attr.name.toLowerCase())) child.removeAttribute(attr.name);
        });
        clean(child);
      });
    }

    clean(template.content);
    return template.innerHTML;
  }

  function slugify(text, fallback) {
    const slug = str(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || fallback || ('cat-' + Math.random().toString(36).slice(2, 8));
  }

  /* ---------------- CSV <-> categories ---------------- */

  function rowsToCategories(rows) {
    const byId = new Map();
    (rows || []).forEach(r => {
      const id = str(r.category_id);
      if (!id) return;
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          order: Number(r.category_order) || 0,
          name: { en: str(r.category_en), hi: str(r.category_hi), gu: str(r.category_gu) },
          items: []
        });
      }
      const en = str(r.item_en);
      if (!en) return; // category-only row (a category with no items yet)
      byId.get(id).items.push({
        order: Number(r.item_order) || 0,
        en,
        hi: str(r.item_hi),
        gu: str(r.item_gu),
        price: str(r.price)
      });
    });

    const cats = [...byId.values()];
    cats.forEach(c => c.items.sort((a, b) => a.order - b.order));
    cats.sort((a, b) => a.order - b.order);
    // Order was only needed for sorting; array position is the source of truth from here on.
    cats.forEach(c => { delete c.order; c.items.forEach(i => delete i.order); });
    return cats;
  }

  function categoriesToRows(categories) {
    const rows = [];
    (categories || []).forEach((c, ci) => {
      const base = {
        category_order: ci + 1,
        category_id: c.id,
        category_en: c.name.en || '',
        category_hi: c.name.hi || '',
        category_gu: c.name.gu || ''
      };
      if (!c.items.length) {
        rows.push(Object.assign({}, base, { item_order: '', item_en: '', item_hi: '', item_gu: '', price: '' }));
        return;
      }
      c.items.forEach((it, ii) => {
        rows.push(Object.assign({}, base, {
          item_order: ii + 1,
          item_en: it.en || '',
          item_hi: it.hi || '',
          item_gu: it.gu || '',
          price: it.price || ''
        }));
      });
    });
    return rows;
  }

  function categoriesToCsv(categories) {
    const rows = categoriesToRows(categories);
    return Papa.unparse({
      fields: CSV_COLUMNS,
      data: rows.map(r => CSV_COLUMNS.map(c => r[c] == null ? '' : r[c]))
    });
  }

  function parseCsvText(text) {
    const res = Papa.parse(text, { header: true, skipEmptyLines: true });
    return rowsToCategories(res.data);
  }

  /* ---------------- Loading ---------------- */

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.brand) {
          // Migration: convert string fields to {en,hi,gu} objects
          const multi = ['tagline', 'since', 'specialty', 'meta', 'address'];
          multi.forEach(f => {
            if (typeof parsed.brand[f] === 'string') {
              parsed.brand[f] = { en: parsed.brand[f], hi: '', gu: '' };
            }
          });
          return parsed;
        }
      }
    } catch (e) { /* corrupt override — fall back to the shipped config */ }
    return JSON.parse(JSON.stringify(root.NDD_CONFIG || { brand: {}, notices: [] }));
  }

  function loadCategories() {
    return new Promise(resolve => {
      // 1. Admin's unpublished local edits.
      try {
        const raw = localStorage.getItem(STORAGE_CSV);
        if (raw) {
          const parsed = parseCsvText(raw);
          if (parsed.length) { resolve(parsed); return; }
          // An empty override is stale/corrupt — discard so real data can load.
          localStorage.removeItem(STORAGE_CSV);
        }
      } catch (e) { /* fall through */ }

      // 2. The published menu.csv.
      Papa.parse('assets/data/menu.csv', {
        download: true, header: true, skipEmptyLines: true,
        complete: res => {
          const cats = rowsToCategories(res.data);
          resolve(cats.length ? cats : fallbackCategories());
        },
        // 3. Embedded copy (covers file:// where fetch is blocked).
        error: () => resolve(fallbackCategories())
      });
    });
  }

  function fallbackCategories() {
    if (root.NDD_MENU_CSV_FALLBACK) {
      try { return parseCsvText(root.NDD_MENU_CSV_FALLBACK); } catch (e) { /* ignore */ }
    }
    return [];
  }

  async function load() {
    const [config, categories] = [loadConfig(), await loadCategories()];
    return {
      brand: config.brand || {},
      notices: config.notices || [],
      categories
    };
  }

  /* ---------------- Saving ---------------- */

  function save(data) {
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify({ brand: data.brand, notices: data.notices }));
    localStorage.setItem(STORAGE_CSV, categoriesToCsv(data.categories));
  }

  function clearOverrides() {
    localStorage.removeItem(STORAGE_CONFIG);
    localStorage.removeItem(STORAGE_CSV);
  }

  /* ---------------- Publishing (file exports) ---------------- */

  function configFileText(data) {
    // This header ships on the PUBLIC site, so it must not name admin paths.
    return '/*\n' +
      '  New Delhi Darbar — brand info & notices.\n' +
      '  Menu categories/items live in assets/data/menu.csv.\n' +
      '  Generated by the private Admin Panel — edit there, then re-export.\n' +
      '*/\n' +
      'window.NDD_CONFIG = ' + JSON.stringify({ brand: data.brand, notices: data.notices, lastUpdated: new Date().toISOString() }, null, 2) + ';\n';
  }

  function fallbackFileText(data) {
    return '/*\n' +
      '  Embedded fallback copy of assets/data/menu.csv, used only when the page\n' +
      '  cannot fetch the CSV (e.g. opened directly as a local file).\n' +
      '  Generated by the Admin Panel — keep in sync with menu.csv.\n' +
      '*/\n' +
      'window.NDD_MENU_CSV_FALLBACK = `' + categoriesToCsv(data.categories).trim() + '\n`;\n';
  }

  root.NDDStore = {
    STORAGE_CONFIG, STORAGE_CSV, CSV_COLUMNS,
    load, save, clearOverrides,
    loadConfig, loadCategories,
    rowsToCategories, categoriesToRows, categoriesToCsv, parseCsvText,
    configFileText, fallbackFileText,
    slugify, str, sanitizeRichText
  };

})(typeof window !== 'undefined' ? window : globalThis);
