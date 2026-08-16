/*
  New Delhi Darbar — customer menu page.

  Renders entirely from the shared store (src/core/store.js). All three language
  views come from the SAME records: English is the source of truth and Hindi /
  Gujarati are resolved per-field through the glossary, so switching language
  never shows stale or missing content.
*/
(async () => {
  'use strict';

  const { NDDStore: Store, NDDGlossary: Glossary, NDDi18n: i18n } = window;

  const STORAGE_THEME = 'ndd-theme';
  const STORAGE_LANG = 'ndd-language';

  const root = document.documentElement;
  const themeButton = document.getElementById('themeButton');
  const themeIcon = document.getElementById('themeIcon');
  const langButton = document.getElementById('langButton');
  const langMenu = document.getElementById('langMenu');
  const langButtonLabel = document.getElementById('langButtonLabel');
  const languagePicker = document.querySelector('.language-picker');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const menuGrid = document.getElementById('menuGrid');

  let DATA = { brand: {}, notices: [], categories: [] };
  let currentLang = localStorage.getItem(STORAGE_LANG) || 'en';

  /* ---------------- helpers ---------------- */

  const escapeHtml = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // Content fields are {en,hi,gu}; resolve through the glossary.
  const text = (field, lang) => Glossary.resolve(field, lang || currentLang);

  const telHref = phone => 'tel:' + String(phone).replace(/[^\d+]/g, '');

  /* ---------------- theme ---------------- */

  function applyTheme(theme) {
    root.dataset.theme = theme;
    localStorage.setItem(STORAGE_THEME, theme);
    const dark = theme === 'dark';
    if (themeMeta) themeMeta.content = dark ? '#121110' : '#f5f2ed';
    const label = i18n.t(currentLang, dark ? 'themeToLight' : 'themeToDark');
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
    themeIcon.innerHTML = dark
      ? '<circle cx="12" cy="12" r="3.2"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path>'
      : '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z"></path>';
  }

  /* ---------------- rendering ---------------- */

  function renderBrand() {
    const b = DATA.brand;
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || '';
    };

    setText('brandName', b.name);
    setText('brandTagline', b.tagline);
    setText('brandH1', b.name);

    const strip = document.getElementById('brandStrip');
    if (strip) {
      const chips = [];
      if (b.since) chips.push(`<span class="tag-chip primary">${escapeHtml(b.since)}</span>`);
      if (b.specialty) chips.push(`<span class="tag-chip specialty">${escapeHtml(b.specialty)}</span>`);
      if (b.meta) chips.push(`<span class="tag-chip meta">${escapeHtml(b.meta)}</span>`);
      strip.innerHTML = chips.join('');
    }

    const phones = Array.isArray(b.phones) ? b.phones.filter(Boolean) : [];
    const contactHtml = phones
      .map(p => `<a class="phone" href="${escapeHtml(telHref(p))}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>${escapeHtml(p)}</span></a>`)
      .join('');
    ['heroContact', 'footerContact'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = contactHtml;
    });

    const addressLink = document.getElementById('addressLink');
    const addressText = document.getElementById('addressText');
    if (addressText) addressText.textContent = b.address || '';
    if (addressLink) {
      if (b.mapUrl) {
        addressLink.href = b.mapUrl;
        addressLink.removeAttribute('aria-disabled');
      } else {
        // No map URL configured — render as plain text rather than a dead link.
        addressLink.removeAttribute('href');
        addressLink.setAttribute('aria-disabled', 'true');
      }
    }
  }

  function renderNav() {
    const nav = document.getElementById('catNav');
    if (!nav) return;
    nav.innerHTML = DATA.categories
      .map(c => `<a class="cat-link" href="#${escapeHtml(c.id)}" data-cat="${escapeHtml(c.id)}">${Store.sanitizeRichText(text(c.name))}</a>`)
      .join('');
  }

  function renderMenu() {
    if (!menuGrid) return;

    if (!DATA.categories.length) {
      menuGrid.innerHTML = '<div class="menu-status">The menu is being updated. Please check back shortly.</div>';
      return;
    }

    const sections = DATA.categories.map(cat => {
      const items = cat.items.map(it => `
        <div class="item">
          <div><div class="item-name">${Store.sanitizeRichText(text(it))}</div></div>
          ${it.price ? `<div class="price">${Store.sanitizeRichText(it.price)}</div>` : ''}
        </div>`).join('');

      return `
        <section class="card" id="${escapeHtml(cat.id)}">
          <div class="card-head">
            <h2>${Store.sanitizeRichText(text(cat.name))}</h2>
            <span class="count">${cat.items.length}</span>
          </div>
          <div class="items">${items}</div>
        </section>`;
    }).join('');

    const notices = (DATA.notices || []).map(n => {
      const bulk = (n.bulkList && n.bulkList.length)
        ? `<ul class="bulk-list">${n.bulkList.map(b => `<li>${escapeHtml(text(b))}</li>`).join('')}</ul>`
        : '';
      // Notice bodies are admin-authored rich text and may contain <strong> etc.
      // Sanitized (not raw innerHTML) so a compromised admin session or a
      // pasted-in payload can never execute script against every site visitor.
      const body = Store.sanitizeRichText(text(n.html));
      const pricing = n.bulkPricing ? Store.sanitizeRichText(text(n.bulkPricing)) : '';
      return `
        <section class="notice-section">
          <h3 class="notice-label">${escapeHtml(text(n.title))}</h3>
          <p>${body}</p>
          ${bulk}
          ${pricing ? `<p class="bulk-price">${pricing}</p>` : ''}
        </section>`;
    }).join('');

    menuGrid.innerHTML = sections +
      (notices ? `<aside class="notice" aria-label="${escapeHtml(i18n.t(currentLang, 'notes'))}">${notices}</aside>` : '');
  }

  function renderStaticStrings() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = i18n.t(currentLang, el.dataset.i18n);
    });
    const stockEl = document.getElementById('stockNote');
    if (stockEl) stockEl.textContent = text(DATA.brand.stockNote);
    const disclaimerEl = document.getElementById('pricingDisclaimer');
    if (disclaimerEl) disclaimerEl.textContent = text(DATA.brand.pricingDisclaimer);
    const langHeader = document.getElementById('langMenuHeader');
    if (langHeader) langHeader.textContent = i18n.t(currentLang, 'languageLabel');
    const lastUpdEl = document.getElementById('lastUpdatedNote');
    if (lastUpdEl && window.NDD_CONFIG.lastUpdated) {
      const d = new Date(window.NDD_CONFIG.lastUpdated);
      const opts = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
      let label = 'Last updated: ';
      if (currentLang === 'hi') label = 'अंतिम अपडेट: ';
      if (currentLang === 'gu') label = 'છેલ્લું અપડેટ: ';
      lastUpdEl.textContent = label + d.toLocaleDateString(currentLang === 'en' ? 'en-IN' : currentLang, opts);
    }
  }

  function applyLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    localStorage.setItem(STORAGE_LANG, lang);

    renderBrand();
    renderNav();
    renderMenu();
    renderStaticStrings();

    document.querySelectorAll('[data-lang]').forEach(el => {
      el.setAttribute('aria-checked', String(el.dataset.lang === lang));
    });
    if (langButtonLabel) langButtonLabel.textContent = i18n.LANG_NAMES[lang];
    applyTheme(root.dataset.theme || 'light'); // refresh theme button label in the new language
    wireCategoryNavigation();
  }

  /* ---------------- language menu ---------------- */

  function setLanguageMenu(open) {
    langMenu.classList.toggle('open', open);
    langButton.setAttribute('aria-expanded', String(open));
    if (open) {
      const selected = langMenu.querySelector('[aria-checked="true"]');
      if (selected) setTimeout(() => selected.focus(), 20);
    }
  }

  function wireLanguageMenu() {
    langButton.addEventListener('click', () => setLanguageMenu(!langMenu.classList.contains('open')));
    langButton.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setLanguageMenu(true);
      }
    });

    const options = [...langMenu.querySelectorAll('[data-lang]')];
    options.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        applyLanguage(btn.dataset.lang);
        setLanguageMenu(false);
        langButton.focus();
      });
      btn.addEventListener('keydown', e => {
        const moves = {
          ArrowDown: () => options[(index + 1) % options.length].focus(),
          ArrowUp: () => options[(index - 1 + options.length) % options.length].focus(),
          Home: () => options[0].focus(),
          End: () => options[options.length - 1].focus(),
          Escape: () => { setLanguageMenu(false); langButton.focus(); }
        };
        if (moves[e.key]) { e.preventDefault(); moves[e.key](); }
      });
    });

    document.addEventListener('click', e => {
      if (!languagePicker.contains(e.target)) setLanguageMenu(false);
    });
  }

  /* ---------------- category navigation & scroll spy ---------------- */

  let categoryObserver = null;
  let scrollLock = false;
  let scrollLockTimer = 0;

  function setActiveCategory(id) {
    document.querySelectorAll('.cat-link').forEach(link => {
      const active = link.dataset.cat === id;
      link.classList.toggle('active', active);
      if (active) {
        link.setAttribute('aria-current', 'true');
        link.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      } else {
        link.removeAttribute('aria-current');
      }
    });
    document.querySelectorAll('.card[id]').forEach(card => {
      card.classList.toggle('section-active', card.id === id);
    });
  }

  function wireCategoryNavigation() {
    if (categoryObserver) categoryObserver.disconnect();

    const links = [...document.querySelectorAll('.cat-link')];
    const cards = [...document.querySelectorAll('.card[id]')];
    if (!links.length || !cards.length) return;

    links.forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        const id = link.dataset.cat;
        const card = document.getElementById(id);
        if (!card) return;

        scrollLock = true;
        clearTimeout(scrollLockTimer);
        setActiveCategory(id);

        const headerHeight = document.querySelector('.topbar')?.offsetHeight || 66;
        const toolbarHeight = document.querySelector('.toolbar')?.offsetHeight || 54;
        const top = card.getBoundingClientRect().top + window.scrollY - headerHeight - toolbarHeight - 10;
        window.scrollTo({ top, behavior: 'smooth' });

        scrollLockTimer = setTimeout(() => { scrollLock = false; }, 800);
      });
    });

    // Highlight whichever section is nearest the top of the viewport.
    const visible = new Set();
    categoryObserver = new IntersectionObserver(entries => {
      if (scrollLock) return;
      entries.forEach(e => {
        if (e.isIntersecting) visible.add(e.target.id);
        else visible.delete(e.target.id);
      });
      if (!visible.size) return;

      let bestId = null, bestY = Infinity;
      visible.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        if (top < bestY && top > -el.offsetHeight * 0.7) { bestY = top; bestId = id; }
      });
      if (bestId) setActiveCategory(bestId);
    }, { rootMargin: '-120px 0px -40% 0px', threshold: [0, 0.1, 0.25] });

    cards.forEach(card => categoryObserver.observe(card));
    setActiveCategory(cards[0].id);
  }

  /* ---------------- boot ---------------- */

  if (menuGrid) {
    menuGrid.innerHTML = '<div class="menu-status"><div class="spinner"></div>Loading menu…</div>';
  }

  try {
    DATA = await Store.load();
  } catch (err) {
    console.error('Failed to load menu data', err);
    if (menuGrid) {
      menuGrid.innerHTML = '<div class="menu-status">Sorry — the menu could not be loaded. Please refresh the page.</div>';
    }
    return;
  }

  const savedTheme = localStorage.getItem(STORAGE_THEME);
  applyTheme(savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  applyLanguage(currentLang);
  wireLanguageMenu();

  themeButton.addEventListener('click', () => {
    applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
      e.preventDefault();
      applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    }
    if (e.key === 'Escape') setLanguageMenu(false);
  });

  // Live-update when the admin panel publishes from another tab.
  window.addEventListener('storage', e => {
    if (e.key === Store.STORAGE_CONFIG || e.key === Store.STORAGE_CSV) location.reload();
  });

  /*
    Deliberately no admin shortcut here.

    This script is served on the public menu, so any hidden gesture that
    revealed an admin route would be readable in the page source and would only
    advertise an entry point. The public build ships no admin panel at all;
    staff use the private admin environment.
  */
})();
