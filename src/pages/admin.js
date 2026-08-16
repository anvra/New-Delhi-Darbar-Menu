/*
  New Delhi Darbar — Admin Panel.

  Single source of truth: the admin types ENGLISH once. Hindi and Gujarati are
  derived automatically through src/core/glossary.js, and every translatable
  field shows its live translation status:

    AUTO    — derived from the glossary, kept in sync with the English text
    MANUAL  — an admin explicitly overrode this language
    NEEDS   — English contains words the glossary doesn't know yet

  Manual overrides are optional and stored alongside the English source; they
  never need to be re-entered when unrelated fields change.
*/
(() => {
  'use strict';

  const { NDDStore: Store, NDDGlossary: Glossary } = window;

  let data = { brand: {}, notices: [], categories: [] };
  let isDirty = false;

  /* ---------------- small helpers ---------------- */

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const statusEl = $('status');
  function showStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = 'status show ' + (kind || 'ok');
    setTimeout(() => statusEl.classList.remove('show'), 2400);
  }

  /* ---------------- spelling suggestions ---------------- */

  const BASE_WORDS = (
    'the a an of for and or with without in on at to from is are was were be been being ' +
    'restaurant menu item items price plate pc piece pieces per note notes special order orders ' +
    'bulk quantity quantities fresh fried fry gravy dry masala kadai tikka biryani rice roti plain ' +
    'bread water mineral cold hot beverages beverage soft drink drinks chicken mutton fish prawn ' +
    'prawns kheema kebab jeera address phone since serving welcome authentic taste consistent ' +
    'quality preparation prepared according requirement requirements customized customised advance ' +
    'please large even same remains pricing information tax service charge stated source supplied ' +
    'preserved wording no yes also we accept your you our place available stock served whatever ' +
    'paneer egg veg salad papad dal curry soup naan paratha lassi juice tea coffee tandoori grilled ' +
    'roasted hyderabadi chokha rotla pudaa paplet jinga biryani mixed half full extra'
  ).split(/\s+/);

  const KNOWN_WORDS = new Set(BASE_WORDS.map(w => w.toLowerCase()));
  // Terms already in the glossary are, by definition, correctly spelled.
  Object.keys(Glossary.TERMS).forEach(w => KNOWN_WORDS.add(w.toLowerCase()));
  Object.keys(Glossary.PHRASES).forEach(p => p.split(/[^a-z]+/i).forEach(w => w && KNOWN_WORDS.add(w.toLowerCase())));

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
      }
      prev = cur;
    }
    return prev[n];
  }

  function suggestWord(word) {
    const w = word.toLowerCase();
    if (!w || KNOWN_WORDS.has(w) || w.length < 4 || /\d/.test(w)) return null;
    let best = null, bestDist = Infinity;
    KNOWN_WORDS.forEach(k => {
      if (Math.abs(k.length - w.length) > 2) return;
      const d = levenshtein(w, k);
      if (d < bestDist) { bestDist = d; best = k; }
    });
    return (best && bestDist > 0 && bestDist <= 2) ? best : null;
  }

  function matchCase(original, suggestion) {
    return (original[0] === original[0].toUpperCase())
      ? suggestion.charAt(0).toUpperCase() + suggestion.slice(1)
      : suggestion;
  }

  function checkSpelling(input) {
    const wrap = input.closest('.field-wrap');
    if (!wrap) return;
    const existing = wrap.querySelector('.suggest-chip');
    if (existing) existing.remove();

    const value = input.value;
    for (const token of value.split(/([^A-Za-z']+)/)) {
      if (!/^[A-Za-z']+$/.test(token)) continue;
      const sug = suggestWord(token);
      if (!sug) continue;

      const fixed = matchCase(token, sug);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'suggest-chip';
      chip.innerHTML = `✎ Did you mean <b>${esc(fixed)}</b> instead of “${esc(token)}”?`;
      chip.addEventListener('click', () => {
        input.value = value.replace(new RegExp('\\b' + token + '\\b'), fixed);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        chip.remove();
      });
      wrap.appendChild(chip);
      return;
    }
  }

  function wireSpellcheck(scope) {
    scope.querySelectorAll('.field-wrap input[type=text], .field-wrap textarea').forEach(input => {
      if (input.dataset.spellWired) return;
      input.dataset.spellWired = '1';
      input.addEventListener('blur', () => checkSpelling(input));
    });
  }

  /* ---------------- translation status UI ---------------- */

  const LANG_NAME = { hi: 'Hindi', gu: 'Gujarati' };
  // Plain-language wording, aimed at a non-technical restaurant owner.
  const STATUS_LABEL = { auto: 'Done', manual: 'Yours', missing: 'Not translated' };

  /*
    Build the per-field translation panel: shows the resolved Hindi/Gujarati
    text, whether it was translated automatically, and a clearly-labelled
    editor for typing a different wording.
    `field` is the live {en,hi,gu} object — edits mutate it directly.
  */
  function buildTranslationPreview(field, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'trans-preview';

    function render() {
      wrap.innerHTML = '';

      const head = document.createElement('div');
      head.className = 'trans-head';
      head.innerHTML = '<span>Other languages</span>';
      wrap.appendChild(head);

      ['hi', 'gu'].forEach(lang => {
        const state = Glossary.status(field, lang);
        const resolved = Glossary.resolve(field, lang);
        const isMissing = state === 'missing';

        const row = document.createElement('div');
        row.className = 'trans-row';
        row.innerHTML = `
          <span class="trans-lang-name">${LANG_NAME[lang]}</span>
          <span class="trans-text${isMissing ? ' is-missing' : ''}">${
            isMissing
              ? (field.en
                  ? 'Will show the English words to customers'
                  : 'Type the English name first')
              : esc(resolved)
          }</span>
          <span class="tstatus ${state}">${STATUS_LABEL[state]}</span>`;

        const actions = document.createElement('span');
        actions.className = 'trans-actions';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        // A missing translation is the case that needs attention, so it gets
        // the prominent, self-explanatory button.
        if (isMissing && field.en) {
          editBtn.className = 'btn-fixit';
          editBtn.textContent = `Type ${LANG_NAME[lang]}`;
        } else {
          editBtn.className = 'btn-changeit';
          editBtn.textContent = state === 'manual' ? 'Edit' : 'Change';
        }
        actions.appendChild(editBtn);
        row.appendChild(actions);

        const override = document.createElement('div');
        override.className = 'trans-override';

        const help = document.createElement('div');
        help.className = 'override-help';
        help.textContent = isMissing
          ? `Type this dish's name in ${LANG_NAME[lang]}. Leave it empty to keep showing the English name.`
          : `Type your own ${LANG_NAME[lang]} wording. Leave it empty to go back to the automatic translation.`;
        override.appendChild(help);

        const input = document.createElement('input');
        input.type = 'text';
        input.value = field[lang] || '';
        input.placeholder = `${LANG_NAME[lang]} name`;
        input.setAttribute('aria-label', `${LANG_NAME[lang]} translation`);
        override.appendChild(input);

        const buttons = document.createElement('div');
        buttons.className = 'toolrow';

        const doneBtn = document.createElement('button');
        doneBtn.type = 'button';
        doneBtn.className = 'btn small primary';
        doneBtn.textContent = 'Done';
        doneBtn.addEventListener('click', () => {
          field[lang] = input.value.trim();
          onChange && onChange();
          render();
        });
        buttons.appendChild(doneBtn);

        if (state === 'manual') {
          const clear = document.createElement('button');
          clear.type = 'button';
          clear.className = 'btn small';
          clear.textContent = 'Use automatic translation';
          clear.addEventListener('click', () => {
            field[lang] = '';
            onChange && onChange();
            render();
          });
          buttons.appendChild(clear);
        }

        override.appendChild(buttons);

        input.addEventListener('input', () => {
          field[lang] = input.value.trim();
          onChange && onChange();
        });
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); doneBtn.click(); }
          if (e.key === 'Escape') { e.preventDefault(); render(); }
        });

        editBtn.addEventListener('click', () => {
          override.classList.toggle('open');
          if (override.classList.contains('open')) input.focus();
        });

        wrap.appendChild(row);
        wrap.appendChild(override);
      });
    }

    render();
    wrap.refresh = render;
    return wrap;
  }

  function updateTranslationSummary() {
    let auto = 0, manual = 0, missing = 0;
    const tally = field => {
      ['hi', 'gu'].forEach(lang => {
        const s = Glossary.status(field, lang);
        if (s === 'auto') auto++;
        else if (s === 'manual') manual++;
        else if (s === 'missing') missing++;
      });
    };
    data.categories.forEach(c => { tally(c.name); c.items.forEach(tally); });

    const el = $('tsummary');
    if (!el) return;
    el.innerHTML = `
      <div class="metric"><span class="tstatus auto">Done</span> <b>${auto}</b> translated automatically</div>
      <div class="metric"><span class="tstatus manual">Yours</span> <b>${manual}</b> written by you</div>
      <div class="metric"><span class="tstatus missing">Not translated</span> <b>${missing}</b> will show English</div>`;
  }

  /* ---------------- dirty tracking ---------------- */

  const saveFab = $('saveFab');
  const fabLabel = $('fabLabel');

  function markDirty() {
    if (isDirty) return;
    isDirty = true;
    saveFab.classList.add('dirty');
    fabLabel.textContent = 'Save & Publish';
  }
  function clearDirty() {
    isDirty = false;
    saveFab.classList.remove('dirty');
  }

  /* ---------------- brand form ---------------- */

  const BRAND_FIELDS = ['name', 'tagline', 'since', 'specialty', 'meta', 'address', 'mapUrl'];

  function fillBrandForm() {
    const b = data.brand;
    BRAND_FIELDS.forEach(f => { const el = $('b_' + f); if (el) el.value = b[f] || ''; });
    $('b_phone1').value = (b.phones || [])[0] || '';
    $('b_phone2').value = (b.phones || [])[1] || '';
    $('b_stockEn').value = (b.stockNote || {}).en || '';
    $('b_sourceEn').value = (b.sourceNote || {}).en || '';

    // Translation previews for the two multilingual brand notes.
    b.stockNote = b.stockNote || { en: '', hi: '', gu: '' };
    b.sourceNote = b.sourceNote || { en: '', hi: '', gu: '' };
    mountPreview('stockNotePreview', b.stockNote);
    mountPreview('sourceNotePreview', b.sourceNote);
    wireSpellcheck($('page-brand'));
  }

  function mountPreview(hostId, field) {
    const host = $(hostId);
    if (!host) return;
    host.innerHTML = '';
    host.appendChild(buildTranslationPreview(field, markDirty));
  }

  function readBrandForm() {
    const b = data.brand;
    BRAND_FIELDS.forEach(f => { const el = $('b_' + f); if (el) b[f] = el.value.trim(); });
    b.phones = [$('b_phone1').value.trim(), $('b_phone2').value.trim()].filter(Boolean);
    b.stockNote = b.stockNote || {};
    b.stockNote.en = $('b_stockEn').value.trim();
    b.sourceNote = b.sourceNote || {};
    b.sourceNote.en = $('b_sourceEn').value.trim();
  }

  /* ---------------- categories & items ---------------- */

  function renderCategories() {
    const list = $('catList');
    list.innerHTML = '';
    $('catEmpty').style.display = data.categories.length ? 'none' : 'block';

    data.categories.forEach((cat, ci) => {
      const card = document.createElement('div');
      card.className = 'cat-card';
      card.innerHTML = `
        <div class="cat-card-head">
          <button class="move-btn" data-act="up" title="Move category up" ${ci === 0 ? 'disabled' : ''}>↑</button>
          <button class="move-btn" data-act="down" title="Move category down" ${ci === data.categories.length - 1 ? 'disabled' : ''}>↓</button>
          <div class="grow field-wrap">
            <input type="text" data-f="en" value="${esc(cat.name.en)}"
                   placeholder="Category name in English" spellcheck="true" lang="en"
                   aria-label="Category name in English">
          </div>
          <span class="cat-count">${cat.items.length} item${cat.items.length === 1 ? '' : 's'}</span>
          <button class="icon-btn" data-act="delete" title="Delete category">✕</button>
        </div>
        <div class="cat-body">
          <div class="cat-preview"></div>
          <label style="margin-top:12px">Items</label>
          <div class="items-holder"></div>
          <button class="btn small" data-act="addItem">+ Add Item</button>
        </div>`;
      list.appendChild(card);

      const countEl = card.querySelector('.cat-count');
      const namePreview = buildTranslationPreview(cat.name, () => { markDirty(); updateTranslationSummary(); });
      card.querySelector('.cat-preview').appendChild(namePreview);

      const nameInput = card.querySelector('[data-f=en]');
      nameInput.addEventListener('input', () => {
        cat.name.en = nameInput.value;
        // Keep the URL id readable and in sync while the category is still new.
        if (!cat.idLocked) cat.id = Store.slugify(cat.name.en, cat.id);
        namePreview.refresh();
        updateTranslationSummary();
        markDirty();
      });

      card.querySelector('[data-act=up]').addEventListener('click', () => moveCategory(ci, -1));
      card.querySelector('[data-act=down]').addEventListener('click', () => moveCategory(ci, 1));
      card.querySelector('[data-act=delete]').addEventListener('click', () => {
        const label = cat.name.en || 'this category';
        if (!confirm(`Delete “${label}” and all ${cat.items.length} of its items?\n\nThis cannot be undone.`)) return;
        data.categories.splice(ci, 1);
        renderCategories();
        updateTranslationSummary();
        markDirty();
      });

      const itemsHolder = card.querySelector('.items-holder');

      function renderItems() {
        itemsHolder.innerHTML = '';
        if (!cat.items.length) {
          itemsHolder.innerHTML = '<div class="hint" style="padding:6px 0">No items yet — click “+ Add Item”.</div>';
        }
        cat.items.forEach((item, ii) => {
          const row = document.createElement('div');
          row.className = 'item-card';
          row.innerHTML = `
            <div class="item-top">
              <button class="move-btn" data-act="up" title="Move item up" ${ii === 0 ? 'disabled' : ''}>↑</button>
              <button class="move-btn" data-act="down" title="Move item down" ${ii === cat.items.length - 1 ? 'disabled' : ''}>↓</button>
              <div class="grow field-wrap">
                <input type="text" data-f="en" value="${esc(item.en)}"
                       placeholder="Item name in English" spellcheck="true" lang="en"
                       aria-label="Item name in English">
              </div>
              <div class="item-price">
                <input type="text" data-f="price" value="${esc(item.price)}"
                       placeholder="e.g. 80 Rs / plate" aria-label="Price">
              </div>
              <button class="icon-btn" data-act="delete" title="Delete item">✕</button>
            </div>`;
          itemsHolder.appendChild(row);

          const preview = buildTranslationPreview(item, () => { markDirty(); updateTranslationSummary(); });
          row.appendChild(preview);

          const enInput = row.querySelector('[data-f=en]');
          enInput.addEventListener('input', () => {
            item.en = enInput.value;
            preview.refresh();
            updateTranslationSummary();
            markDirty();
          });
          row.querySelector('[data-f=price]').addEventListener('input', e => {
            item.price = e.target.value;
            markDirty();
          });
          row.querySelector('[data-act=delete]').addEventListener('click', () => {
            cat.items.splice(ii, 1);
            renderItems();
            countEl.textContent = `${cat.items.length} item${cat.items.length === 1 ? '' : 's'}`;
            updateTranslationSummary();
            markDirty();
          });
          row.querySelector('[data-act=up]').addEventListener('click', () => {
            if (ii === 0) return;
            [cat.items[ii - 1], cat.items[ii]] = [cat.items[ii], cat.items[ii - 1]];
            renderItems(); markDirty();
          });
          row.querySelector('[data-act=down]').addEventListener('click', () => {
            if (ii === cat.items.length - 1) return;
            [cat.items[ii + 1], cat.items[ii]] = [cat.items[ii], cat.items[ii + 1]];
            renderItems(); markDirty();
          });
          wireSpellcheck(row);
        });
      }

      renderItems();

      card.querySelector('[data-act=addItem]').addEventListener('click', () => {
        cat.items.push({ en: '', hi: '', gu: '', price: '' });
        renderItems();
        countEl.textContent = `${cat.items.length} item${cat.items.length === 1 ? '' : 's'}`;
        const inputs = itemsHolder.querySelectorAll('[data-f=en]');
        if (inputs.length) inputs[inputs.length - 1].focus();
        markDirty();
      });

      wireSpellcheck(card);
    });

    updateTranslationSummary();
  }

  function moveCategory(index, dir) {
    const next = index + dir;
    if (next < 0 || next >= data.categories.length) return;
    [data.categories[index], data.categories[next]] = [data.categories[next], data.categories[index]];
    renderCategories();
    markDirty();
  }

  $('addCatBtn').addEventListener('click', () => {
    data.categories.push({ id: Store.slugify('category-' + (data.categories.length + 1)), name: { en: '', hi: '', gu: '' }, items: [] });
    renderCategories();
    const inputs = $('catList').querySelectorAll('.cat-card-head [data-f=en]');
    if (inputs.length) inputs[inputs.length - 1].focus();
    markDirty();
  });

  /* ---------------- notices ---------------- */

  function renderNotices() {
    const list = $('noticeList');
    list.innerHTML = '';
    if (!data.notices.length) {
      list.innerHTML = '<div class="empty-state">No notices yet. Click “+ Add Notice” to create one.</div>';
    }

    data.notices.forEach((n, ni) => {
      n.title = n.title || { en: '', hi: '', gu: '' };
      n.html = n.html || { en: '', hi: '', gu: '' };
      n.bulkPricing = n.bulkPricing || { en: '', hi: '', gu: '' };

      const block = document.createElement('div');
      block.className = 'notice-block';
      block.innerHTML = `
        <div class="toolrow" style="justify-content:space-between">
          <strong class="hint">Notice ${ni + 1}</strong>
          <button class="icon-btn" data-act="delete" title="Delete notice">✕ Delete</button>
        </div>
        <div class="field-wrap"><label>Title (English)</label>
          <input type="text" data-f="title" value="${esc(n.title.en)}" spellcheck="true" lang="en"></div>
        <div class="title-preview"></div>
        <div class="field-wrap"><label>Body (English)</label>
          <textarea data-f="html" spellcheck="true" lang="en">${esc(n.html.en)}</textarea>
          <div class="hint">Basic HTML such as &lt;strong&gt; is allowed for emphasis.</div></div>
        <div class="body-preview"></div>
        <label style="margin-top:10px">Bulk-order list</label>
        <div class="bulk-holder"></div>
        <button class="btn small" data-act="addBulk">+ Add list line</button>
        <div class="field-wrap"><label style="margin-top:10px">Bulk pricing note (English, optional)</label>
          <textarea data-f="bulkPricing" spellcheck="true" lang="en">${esc(n.bulkPricing.en)}</textarea></div>
        <div class="pricing-preview"></div>`;
      list.appendChild(block);

      const titlePrev = buildTranslationPreview(n.title, markDirty);
      const bodyPrev = buildTranslationPreview(n.html, markDirty);
      const pricingPrev = buildTranslationPreview(n.bulkPricing, markDirty);
      block.querySelector('.title-preview').appendChild(titlePrev);
      block.querySelector('.body-preview').appendChild(bodyPrev);
      block.querySelector('.pricing-preview').appendChild(pricingPrev);

      const bind = (sel, field, prev) => {
        block.querySelector(sel).addEventListener('input', e => {
          field.en = e.target.value;
          prev.refresh();
          markDirty();
        });
      };
      bind('[data-f=title]', n.title, titlePrev);
      bind('[data-f=html]', n.html, bodyPrev);
      bind('[data-f=bulkPricing]', n.bulkPricing, pricingPrev);

      block.querySelector('[data-act=delete]').addEventListener('click', () => {
        if (!confirm('Delete this notice? This cannot be undone.')) return;
        data.notices.splice(ni, 1);
        renderNotices();
        markDirty();
      });

      const bulkHolder = block.querySelector('.bulk-holder');
      function renderBulk() {
        bulkHolder.innerHTML = '';
        n.bulkList = n.bulkList || [];
        if (!n.bulkList.length) {
          bulkHolder.innerHTML = '<div class="hint">No lines yet.</div>';
        }
        n.bulkList.forEach((entry, bi) => {
          const row = document.createElement('div');
          row.className = 'bulk-item field-wrap';
          row.innerHTML = `
            <input type="text" value="${esc(entry.en)}" placeholder="Line text in English" spellcheck="true" lang="en">
            <button class="icon-btn" title="Remove line">✕</button>`;
          bulkHolder.appendChild(row);
          row.querySelector('input').addEventListener('input', e => { entry.en = e.target.value; markDirty(); });
          row.querySelector('button').addEventListener('click', () => {
            n.bulkList.splice(bi, 1); renderBulk(); markDirty();
          });
        });
        wireSpellcheck(bulkHolder);
      }
      renderBulk();

      block.querySelector('[data-act=addBulk]').addEventListener('click', () => {
        n.bulkList = n.bulkList || [];
        n.bulkList.push({ en: '', hi: '', gu: '' });
        renderBulk();
        markDirty();
      });

      wireSpellcheck(block);
    });
  }

  $('addNoticeBtn').addEventListener('click', () => {
    data.notices.push({
      title: { en: 'New Notice', hi: '', gu: '' },
      html: { en: '', hi: '', gu: '' },
      bulkList: [],
      bulkPricing: { en: '', hi: '', gu: '' }
    });
    renderNotices();
    markDirty();
  });

  /* ---------------- validation, save, publish ---------------- */

  function validate() {
    const problems = [];
    const seenIds = new Set();
    data.categories.forEach((c, i) => {
      if (!c.name.en.trim()) problems.push(`Category ${i + 1} has no English name.`);
      if (seenIds.has(c.id)) problems.push(`Two categories share the same link id “${c.id}”.`);
      seenIds.add(c.id);
      c.items.forEach((it, j) => {
        if (!it.en.trim()) problems.push(`Item ${j + 1} in “${c.name.en || 'category ' + (i + 1)}” has no English name.`);
      });
    });
    return problems;
  }

  function save() {
    readBrandForm();
    const problems = validate();
    if (problems.length) {
      showStatus(problems[0], 'err');
      return false;
    }
    try {
      Store.save(data);
    } catch (err) {
      console.error(err);
      showStatus('Could not save — browser storage may be full.', 'err');
      return false;
    }
    clearDirty();
    showStatus('Saved — the live menu is updated', 'ok');
    saveFab.classList.add('spinning');
    fabLabel.textContent = 'Saved ✓';
    setTimeout(() => {
      saveFab.classList.remove('spinning');
      fabLabel.textContent = 'Save & Publish';
    }, 1500);
    return true;
  }

  $('saveBtn').addEventListener('click', save);
  saveFab.addEventListener('click', save);

  $('resetBtn').addEventListener('click', async () => {
    if (!confirm('Discard all unpublished changes and reload the published menu?\n\nThis cannot be undone.')) return;
    Store.clearOverrides();
    await boot();
    clearDirty();
    showStatus('Reset to the published menu', 'ok');
  });

  $('viewSiteBtn').addEventListener('click', () => window.open('index.html', '_blank', 'noopener'));

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('downloadCsvBtn').addEventListener('click', () => {
    readBrandForm();
    download('menu.csv', Store.categoriesToCsv(data.categories), 'text/csv;charset=utf-8');
  });
  $('downloadFallbackBtn').addEventListener('click', () => {
    readBrandForm();
    download('menu-fallback.js', Store.fallbackFileText(data));
  });
  $('downloadConfigBtn').addEventListener('click', () => {
    readBrandForm();
    download('config.js', Store.configFileText(data));
  });

  /* ---------------- GitHub publishing ---------------- */

  const GitHub = window.NDDGitHub;

  function resultBox(hostId, kind, title, bodyHtml) {
    const host = $(hostId);
    if (!host) return;
    host.innerHTML = `<div class="result-box ${kind}"><strong>${esc(title)}</strong>${bodyHtml || ''}</div>`;
  }

  function showGitHubState(connected, info) {
    $('ghConnected').style.display = connected ? '' : 'none';
    $('ghSetup').style.display = connected ? 'none' : '';
    if (connected && info) {
      $('ghAccountInfo').textContent = `Signed in as ${info.login} · ${info.repo}`;
    }
  }

  async function refreshHistory() {
    const host = $('ghHistory');
    if (!host) return;
    host.textContent = 'Loading…';
    try {
      const commits = await GitHub.recentCommits(5);
      host.innerHTML = commits.map(c => `
        <div class="commit-row">
          <span class="commit-sha">${esc(c.sha)}</span>
          <span class="commit-msg">${esc(c.message)}</span>
          <span class="commit-date">${c.date ? new Date(c.date).toLocaleDateString() : ''}</span>
        </div>`).join('');
    } catch (err) {
      host.textContent = 'Could not load recent updates.';
    }
  }

  async function connectGitHub() {
    const btn = $('ghConnectBtn');
    const msg = $('ghConnectMsg');
    const token = $('ghToken').value.trim();

    // Every path below must end with a visible message — a silent failure here
    // looks like the button is broken.
    if (!token) {
      msg.textContent = 'Paste your token into the box first.';
      return;
    }
    if (!/^(github_pat_|ghp_|gho_|ghs_)/.test(token)) {
      msg.textContent = 'That does not look like a GitHub token — it should start with "github_pat_" or "ghp_".';
      return;
    }

    btn.disabled = true;
    msg.textContent = 'Checking your token…';

    try {
      GitHub.setToken(token);
      const info = await GitHub.verify();

      if (!info.canWrite) {
        GitHub.setToken('');
        msg.textContent = 'That token cannot edit this repository. Re-create it with "Contents: Read and write".';
        return;
      }

      $('ghToken').value = '';
      msg.textContent = '';
      showGitHubState(true, info);
      refreshHistory();
      showStatus('Connected to GitHub', 'ok');
    } catch (err) {
      GitHub.setToken('');
      msg.textContent = (err && err.message) || 'Could not connect. Please try again.';
      console.error('GitHub connect failed:', err);
    } finally {
      btn.disabled = false;
    }
  }

  async function publishToGitHub() {
    const btn = $('ghPublishBtn');
    readBrandForm();

    const problems = validate();
    if (problems.length) {
      resultBox('ghPublishResult', 'err', 'Please fix this first', `<div>${esc(problems[0])}</div>`);
      return;
    }

    // Always save locally first, so nothing is lost if the upload fails.
    Store.save(data);
    clearDirty();

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Publishing…';
    resultBox('ghPublishResult', 'ok', 'Uploading your changes to the website…', '');

    try {
      const result = await GitHub.publishFiles([
        { path: 'assets/data/menu.csv', content: Store.categoriesToCsv(data.categories) },
        { path: 'src/core/menu-fallback.js', content: Store.fallbackFileText(data) },
        { path: 'src/core/config.js', content: Store.configFileText(data) }
      ], 'Update menu from Admin Panel');

      resultBox('ghPublishResult', 'ok', 'Published successfully',
        `<div>Your changes are uploaded. The live menu updates in about a minute.</div>
         <div style="margin-top:6px">
           <a href="${esc(result.pagesUrl)}" target="_blank" rel="noopener">Open the live menu ↗</a>
           &nbsp;·&nbsp;
           <a href="${esc(result.commitUrl)}" target="_blank" rel="noopener">View this update ↗</a>
         </div>`);
      showStatus('Published to the website', 'ok');
      refreshHistory();
    } catch (err) {
      resultBox('ghPublishResult', 'err', 'Could not publish',
        `<div>${esc(err.message)}</div>
         <div style="margin-top:6px">Your changes are still saved on this device — nothing was lost.
         You can try again, or use the manual files below.</div>`);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  if ($('ghConnectBtn')) {
    // Warn about the two environments where publishing behaves differently.
    const envWarn = $('ghEnvWarning');
    if (envWarn) {
      if (location.protocol === 'file:') {
        envWarn.innerHTML = '<div class="result-box err">'
          + '<strong>Open this page through a web address, not from a folder</strong>'
          + '<div>The address bar starts with <code>file://</code>. Browsers block saved logins '
          + 'and some network requests on local files, so publishing may not work.</div>'
          + '<div style="margin-top:6px">Use the online admin panel instead: '
          + '<a href="https://anvra.github.io/New-Delhi-Darbar-Menu/admin.html" target="_blank" rel="noopener">'
          + 'anvra.github.io/New-Delhi-Darbar-Menu/admin.html ↗</a>'
          + '<br>Or, if you are testing locally, run <code>npm start</code> and open '
          + '<code>http://localhost:8080/admin.html</code>.</div></div>';
      } else if (GitHub.isSessionOnly && GitHub.isSessionOnly()) {
        envWarn.innerHTML = '<div class="result-box err">'
          + '<strong>This browser cannot remember your token</strong>'
          + '<div>Private/incognito mode is likely on. You can still publish, but you will need to '
          + 'paste the token again next time.</div></div>';
      }
    }

    $('ghConnectBtn').addEventListener('click', connectGitHub);
    $('ghToken').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); connectGitHub(); }
    });
    $('ghPublishBtn').addEventListener('click', publishToGitHub);
    $('ghRefreshBtn').addEventListener('click', refreshHistory);
    $('ghDisconnectBtn').addEventListener('click', () => {
      if (!confirm('Disconnect from GitHub? You will need to paste the token again to publish.')) return;
      GitHub.setToken('');
      showGitHubState(false);
      showStatus('Disconnected from GitHub', 'ok');
    });

    // Restore an existing connection on load.
    if (GitHub.hasToken()) {
      GitHub.verify()
        .then(info => { showGitHubState(true, info); refreshHistory(); })
        .catch(() => { GitHub.setToken(''); showGitHubState(false); });
    } else {
      showGitHubState(false);
    }
  }

  /* ---------------- backup & restore ---------------- */

  function backupFileName() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `menu-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
  }

  if ($('backupBtn')) {
    $('backupBtn').addEventListener('click', () => {
      readBrandForm();
      const payload = {
        _format: 'new-delhi-darbar-menu-backup',
        _version: 1,
        savedAt: new Date().toISOString(),
        brand: data.brand,
        notices: data.notices,
        categories: data.categories
      };
      download(backupFileName(), JSON.stringify(payload, null, 2), 'application/json');
      showStatus('Backup downloaded', 'ok');
    });
  }

  if ($('restoreBtn')) {
    $('restoreBtn').addEventListener('click', () => $('restoreFile').click());

    $('restoreFile').addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ''; // allow re-picking the same file
      if (!file) return;

      const reader = new FileReader();
      reader.onerror = () => resultBox('restoreResult', 'err', 'Could not read that file', '');
      reader.onload = () => {
        const text = String(reader.result || '');
        let restored;

        try {
          if (/\.csv$/i.test(file.name)) {
            // A bare menu.csv — restores items only, keeps brand/notices.
            const cats = Store.parseCsvText(text);
            if (!cats.length) throw new Error('No menu rows found in that CSV file.');
            restored = { categories: cats };
          } else {
            const parsed = JSON.parse(text);
            if (!parsed || !Array.isArray(parsed.categories)) {
              throw new Error('That file is not a menu backup.');
            }
            restored = parsed;
          }
        } catch (err) {
          resultBox('restoreResult', 'err', 'That file could not be used',
            `<div>${esc(err.message)}</div><div style="margin-top:6px">Choose a backup file downloaded from this panel, or a menu.csv file.</div>`);
          return;
        }

        const itemCount = restored.categories.reduce((n, c) => n + (c.items ? c.items.length : 0), 0);
        const summary = `${restored.categories.length} categories and ${itemCount} items`;
        if (!confirm(`Replace the current menu with this backup?\n\nThe backup contains ${summary}.\n\nYour current unsaved changes will be lost.`)) {
          resultBox('restoreResult', 'ok', 'Restore cancelled — nothing changed', '');
          return;
        }

        data.categories = restored.categories.map(c => ({
          id: c.id || Store.slugify(c.name && c.name.en),
          idLocked: true,
          name: Object.assign({ en: '', hi: '', gu: '' }, c.name),
          items: (c.items || []).map(i => Object.assign({ en: '', hi: '', gu: '', price: '' }, i))
        }));
        if (restored.brand) data.brand = restored.brand;
        if (Array.isArray(restored.notices)) data.notices = restored.notices;

        fillBrandForm();
        renderCategories();
        renderNotices();
        markDirty();

        resultBox('restoreResult', 'ok', 'Backup loaded',
          `<div>Restored ${esc(summary)}. Check everything looks right, then press
           <strong>Save &amp; Publish</strong> to keep it.</div>`);
        showStatus('Backup loaded — remember to publish', 'ok');
      };
      reader.readAsText(file);
    });
  }

  /* ---------------- tabs ---------------- */

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tabpage').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      $('page-' + tab.dataset.tab).classList.add('active');
    });
  });

  /* ---------------- global wiring ---------------- */

  $('appShell').addEventListener('input', markDirty);

  window.addEventListener('beforeunload', e => {
    if (!isDirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  /* ---------------- boot ---------------- */

  async function boot() {
    try {
      data = await Store.load();
    } catch (err) {
      console.error('Failed to load data', err);
      showStatus('Could not load the menu data.', 'err');
      data = { brand: {}, notices: [], categories: [] };
    }
    // Existing categories keep their published ids so customer links stay stable.
    data.categories.forEach(c => { c.idLocked = true; });
    fillBrandForm();
    renderCategories();
    renderNotices();
  }

  boot();
})();
