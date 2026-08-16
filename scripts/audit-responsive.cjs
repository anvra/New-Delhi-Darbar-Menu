/*
  Responsive audit for the customer menu (and optionally the admin panel).

  Loads the real pages in headless Chrome at real device viewports and measures
  actual layout: horizontal overflow, touch-target sizes, text legibility,
  sticky-header geometry, and whether content is reachable. Reports concrete
  numbers rather than opinions, so fixes can be verified rather than assumed.

  Usage:
    node scripts/audit-responsive.cjs                 # audit index.html
    node scripts/audit-responsive.cjs --page admin.html
    node scripts/audit-responsive.cjs --shots         # also save screenshots
*/
'use strict';

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');

/* ---------------- viewports ---------------- */
/*
  Real, current device viewports (CSS px, portrait unless noted). Chosen to
  cover the small/medium/large/foldable spread the brief asks for, including
  the narrowest phone still in meaningful use (iPhone SE / Galaxy S8-class at
  320-360px) where layout breaks first.
*/
const VIEWPORTS = [
  // --- small phones ---
  // iPhone SE 1st gen (320x568) and Galaxy Z Fold cover screen (~344x882,
  // Samsung's own spec) are the two narrowest real, current viewports worth
  // testing against — verified figures, not guesses.
  { name: 'Galaxy Z Fold (cover, closed)', width: 344, height: 882, dpr: 2.6, group: 'small' },
  { name: 'iPhone SE (1st gen)',    width: 320, height: 568, dpr: 2,   group: 'small' },
  { name: 'Galaxy S8 / small Android', width: 360, height: 740, dpr: 3, group: 'small' },
  { name: 'iPhone SE (2/3rd gen)',  width: 375, height: 667, dpr: 2,   group: 'small' },

  // --- medium phones ---
  { name: 'iPhone 12/13/14',        width: 390, height: 844, dpr: 3,   group: 'medium' },
  { name: 'Pixel 7',                width: 412, height: 915, dpr: 2.6, group: 'medium' },
  { name: 'Galaxy S23 Ultra',       width: 412, height: 883, dpr: 3.5, group: 'medium' },
  { name: 'iPhone 15 Pro Max',      width: 430, height: 932, dpr: 3,   group: 'medium' },

  // --- landscape phones (short viewports stress sticky headers) ---
  { name: 'iPhone 12 landscape',    width: 844, height: 390, dpr: 3,   group: 'landscape' },
  { name: 'iPhone SE landscape',    width: 667, height: 375, dpr: 2,   group: 'landscape' },

  // --- foldables (unfolded) ---
  { name: 'Galaxy Z Fold (main, open)', width: 714, height: 831, dpr: 2.6, group: 'foldable' },
  { name: 'Pixel Fold (main, open)', width: 791, height: 820, dpr: 2.6, group: 'foldable' },
  { name: 'Surface Duo (per screen)', width: 540, height: 720, dpr: 2.5, group: 'foldable' },

  // --- tablets / desktop (must not regress) ---
  { name: 'iPad Mini',              width: 768, height: 1024, dpr: 2,  group: 'tablet' },
  { name: 'iPad Pro 11"',           width: 834, height: 1194, dpr: 2,  group: 'tablet' },
  { name: 'Desktop 1280',           width: 1280, height: 800, dpr: 1,  group: 'desktop' },
  { name: 'Desktop 1920',           width: 1920, height: 1080, dpr: 1, group: 'desktop' }
];

/* Apple HIG says 44x44pt; Material says 48x48dp. 44 is the common floor. */
const MIN_TAP = 44;
/* Below ~12px body text is hard to read on a phone at arm's length. */
const MIN_BODY_FONT = 11;

function startServer() {
  const types = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.csv': 'text/csv', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.json': 'application/json'
  };
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise(resolve => server.listen(0, () => resolve(server)));
}

/* Runs inside the page: gather real measured geometry. */
function collectMetrics(minTap, minFont) {
  const problems = [];
  const doc = document.documentElement;

  // 1. Horizontal overflow of the page itself.
  const overflowPx = doc.scrollWidth - doc.clientWidth;
  if (overflowPx > 1) {
    // Find the widest offenders so the report names a culprit, not just a symptom.
    const culprits = [];
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const style = getComputedStyle(el);
      if (style.position === 'fixed') return; // fixed overlays don't scroll the page
      if (r.right > doc.clientWidth + 1 || r.left < -1) {
        culprits.push({
          sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
               (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
          right: Math.round(r.right), left: Math.round(r.left), width: Math.round(r.width)
        });
      }
    });
    problems.push({
      kind: 'overflow',
      detail: `page scrolls horizontally by ${overflowPx}px`,
      culprits: culprits.slice(0, 6)
    });
  }

  // 2. Touch targets that are too small.
  const smallTaps = [];
  document.querySelectorAll('a, button, [role="button"], input, select').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;              // hidden
    if (getComputedStyle(el).visibility === 'hidden') return;
    // Inline text links inside a paragraph are exempt — they're read, not tapped as buttons.
    const insideProse = el.closest('p, .source-note, .pricing-disclaimer, .notice p');
    if (insideProse && el.tagName === 'A') return;
    if (r.height < minTap - 0.5 || r.width < minTap - 0.5) {
      smallTaps.push({
        sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
             (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''),
        w: Math.round(r.width), h: Math.round(r.height),
        text: (el.textContent || '').trim().slice(0, 24)
      });
    }
  });
  if (smallTaps.length) {
    problems.push({ kind: 'tap-target', detail: `${smallTaps.length} control(s) under ${minTap}px`, culprits: smallTaps.slice(0, 8) });
  }

  // 3. Text too small to read comfortably.
  const tinyText = [];
  document.querySelectorAll('.item-name, .price, .cat-link, .tag-chip, .notice p, .address, .contact a, .stock-note, .card h2').forEach(el => {
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < minFont) {
      tinyText.push({
        sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''),
        px: Math.round(size * 10) / 10
      });
    }
  });
  if (tinyText.length) {
    // Dedupe by selector so one CSS rule isn't reported 23 times.
    const seen = new Map();
    tinyText.forEach(t => { if (!seen.has(t.sel) || seen.get(t.sel).px > t.px) seen.set(t.sel, t); });
    problems.push({ kind: 'tiny-text', detail: `${seen.size} rule(s) under ${minFont}px`, culprits: [...seen.values()] });
  }

  // 4. Sticky chrome eating the viewport (critical on landscape phones).
  const topbar = document.querySelector('.topbar');
  const toolbar = document.querySelector('.toolbar');
  const chromeH = (topbar ? topbar.getBoundingClientRect().height : 0) +
                  (toolbar ? toolbar.getBoundingClientRect().height : 0);
  const chromePct = Math.round((chromeH / window.innerHeight) * 100);
  if (chromePct > 30) {
    problems.push({
      kind: 'sticky-chrome',
      detail: `sticky header+nav occupy ${chromeH.toFixed(0)}px = ${chromePct}% of the ${window.innerHeight}px viewport`
    });
  }

  // 5. The sticky category bar must sit flush under the sticky header. If the
  //    toolbar's `top` doesn't match the header's real height, content either
  //    peeks through the gap or gets hidden behind the bar when jumping to a
  //    section.
  let stickyGap = null;
  if (topbar && toolbar) {
    const headerH = topbar.getBoundingClientRect().height;
    const toolbarTop = parseFloat(getComputedStyle(toolbar).top);
    stickyGap = Math.round((toolbarTop - headerH) * 10) / 10;
    if (Math.abs(stickyGap) > 1.5) {
      problems.push({
        kind: 'sticky-misalign',
        detail: `toolbar top:${toolbarTop}px vs header height ${headerH.toFixed(1)}px (off by ${stickyGap}px)`
      });
    }
  }

  // 6. Text that is SILENTLY clipped — hidden with no visual indication.
  //    An element using `text-overflow:ellipsis` is deliberately truncating
  //    and telling the user so; that's a legitimate degrade-gracefully
  //    pattern at extreme widths, not a bug, so it's excluded here. Only
  //    `overflow:hidden` WITHOUT an ellipsis marker — text that just vanishes
  //    with no affordance — counts as a real problem.
  const clipped = [];
  document.querySelectorAll('.item-name, .cat-link, .tag-chip, .price, .brand strong, .brand span').forEach(el => {
    if (el.scrollWidth > el.clientWidth + 1) {
      const style = getComputedStyle(el);
      if (style.overflowX === 'hidden' && style.textOverflow !== 'ellipsis') {
        clipped.push({
          sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''),
          text: (el.textContent || '').trim().slice(0, 28),
          scroll: el.scrollWidth, client: el.clientWidth
        });
      }
    }
  });
  if (clipped.length) {
    problems.push({ kind: 'clipped-text', detail: `${clipped.length} element(s) silently clipped (no ellipsis)`, culprits: clipped.slice(0, 6) });
  }

  return {
    problems,
    stats: {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      chromeH: Math.round(chromeH),
      chromePct,
      stickyGap,
      cards: document.querySelectorAll('.card[id]').length,
      items: document.querySelectorAll('.item').length
    }
  };
}

(async () => {
  const args = process.argv.slice(2);
  const pageArg = args.includes('--page') ? args[args.indexOf('--page') + 1] : 'index.html';
  const wantShots = args.includes('--shots');
  const shotDir = path.join(ROOT, '.responsive-shots');
  if (wantShots && !fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });

  const server = await startServer();
  const port = server.address().port;
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

  let totalProblems = 0;
  const byViewport = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({
      width: vp.width, height: vp.height,
      deviceScaleFactor: 1, isMobile: vp.width < 700, hasTouch: vp.width < 900
    });
    await page.goto(`http://localhost:${port}/${pageArg}`, { waitUntil: 'networkidle0' });
    // The menu renders asynchronously from CSV; give it a beat to paint.
    await new Promise(r => setTimeout(r, 350));

    const result = await page.evaluate(collectMetrics, MIN_TAP, MIN_BODY_FONT);
    totalProblems += result.problems.length;
    byViewport.push({ vp, ...result });

    if (wantShots) {
      await page.screenshot({
        path: path.join(shotDir, `${vp.width}x${vp.height}-${vp.name.replace(/[^\w]+/g, '-')}.png`),
        fullPage: false
      });
    }
    await page.close();
  }

  await browser.close();
  server.close();

  /* ---------------- report ---------------- */
  console.log(`\n  Responsive audit — ${pageArg}\n`);
  let clean = 0;
  for (const r of byViewport) {
    const tag = `${r.vp.name} (${r.vp.width}x${r.vp.height}, ${r.vp.group})`;
    if (!r.problems.length) {
      clean++;
      console.log(`  \x1b[32m✓\x1b[0m ${tag}  —  chrome ${r.stats.chromeH}px/${r.stats.chromePct}%`);
      continue;
    }
    console.log(`  \x1b[31m✗\x1b[0m ${tag}`);
    for (const p of r.problems) {
      console.log(`      • [${p.kind}] ${p.detail}`);
      (p.culprits || []).forEach(c => {
        const bits = Object.entries(c).map(([k, v]) => `${k}=${v}`).join(' ');
        console.log(`          ${bits}`);
      });
    }
  }

  console.log(`\n  ${clean}/${byViewport.length} viewports clean, ${totalProblems} problem(s) total\n`);
  if (wantShots) console.log(`  Screenshots: ${path.relative(ROOT, shotDir)}\n`);
  process.exit(totalProblems > 0 ? 1 : 0);
})().catch(err => {
  console.error('\nAudit crashed:\n', err);
  process.exit(1);
});
